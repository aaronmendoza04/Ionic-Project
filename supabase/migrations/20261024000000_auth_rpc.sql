-- ============================================================================
-- PortPass production authentication RPCs
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor (or save as a migration and run
-- `supabase db push`).
--
-- Why RPCs?
--   `crypt(input_pin, pin_hash)` is a PostgreSQL function, so PIN verification
--   and hashing must happen in the database. These functions are SECURITY
--   DEFINER so the browser only ever receives the authenticated user's public
--   profile — never `pin_hash`, and never table-level access.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- 1. Driver login
-- ----------------------------------------------------------------------------
create or replace function public.auth_driver_login(
  p_license_number text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_driver public.driver_profiles%rowtype;
begin
  if p_license_number is null
     or btrim(p_license_number) = ''
     or p_pin is null
     or p_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  select *
    into v_driver
    from public.driver_profiles
   where upper(btrim(license_number)) = upper(btrim(p_license_number))
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  if coalesce(v_driver.is_locked, false) then
    return jsonb_build_object('ok', false, 'error', 'account_locked');
  end if;

  if v_driver.pin_hash is null
     or v_driver.pin_hash <> crypt(p_pin, v_driver.pin_hash) then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  -- A successful sign-in clears any partially accumulated recovery failures.
  if coalesce(v_driver.recovery_attempts, 0) > 0 then
    update public.driver_profiles
       set recovery_attempts = 0
     where id = v_driver.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'user', jsonb_build_object(
      'id', v_driver.id,
      'role', 'driver',
      'name', v_driver.full_name,
      'licenseNumber', v_driver.license_number,
      'phone', v_driver.phone,
      'companyName', v_driver.company_name,
      'registeredPlates', coalesce(to_jsonb(v_driver.registered_plates), '[]'::jsonb)
    )
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Terminal staff login (role determines Admin vs Guard portal)
-- ----------------------------------------------------------------------------
create or replace function public.auth_staff_login(
  p_badge_number text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.terminal_staff%rowtype;
begin
  if p_badge_number is null
     or btrim(p_badge_number) = ''
     or p_pin is null
     or p_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  select *
    into v_staff
    from public.terminal_staff
   where upper(btrim(badge_number)) = upper(btrim(p_badge_number))
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  if v_staff.pin_hash is null
     or v_staff.pin_hash <> crypt(p_pin, v_staff.pin_hash) then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  if v_staff.role::text not in ('guard', 'admin') then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  return jsonb_build_object(
    'ok', true,
    'user', jsonb_build_object(
      'id', v_staff.id,
      'role', v_staff.role::text,
      'name', v_staff.full_name,
      'badgeNumber', v_staff.badge_number
    )
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Driver first-time registration
-- ----------------------------------------------------------------------------
create or replace function public.auth_driver_register(
  p_license_number text,
  p_full_name text,
  p_date_of_birth date,
  p_phone text,
  p_company_name text,
  p_plate text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_driver public.driver_profiles%rowtype;
begin
  if p_license_number is null or btrim(p_license_number) = ''
     or p_full_name is null or btrim(p_full_name) = ''
     or p_date_of_birth is null or p_date_of_birth > current_date
     or p_phone is null or btrim(p_phone) = ''
     or p_company_name is null or btrim(p_company_name) = ''
     or p_plate is null or btrim(p_plate) = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_details');
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_pin');
  end if;

  insert into public.driver_profiles (
    id,
    license_number,
    pin_hash,
    full_name,
    phone,
    company_name,
    date_of_birth,
    registered_plates,
    recovery_attempts,
    is_locked
  )
  values (
    gen_random_uuid(),
    upper(btrim(p_license_number)),
    crypt(p_pin, gen_salt('bf', 10)),
    btrim(p_full_name),
    btrim(p_phone),
    btrim(p_company_name),
    p_date_of_birth,
    array[upper(btrim(p_plate))],
    0,
    false
  )
  returning * into v_driver;

  return jsonb_build_object(
    'ok', true,
    'user', jsonb_build_object(
      'id', v_driver.id,
      'role', 'driver',
      'name', v_driver.full_name,
      'licenseNumber', v_driver.license_number,
      'phone', v_driver.phone,
      'companyName', v_driver.company_name,
      'registeredPlates', coalesce(to_jsonb(v_driver.registered_plates), '[]'::jsonb)
    )
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'license_exists');
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. PIN recovery — step 1: does the profile exist and is it usable?
-- ----------------------------------------------------------------------------
create or replace function public.auth_driver_recovery_lookup(
  p_license_number text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_driver public.driver_profiles%rowtype;
begin
  if p_license_number is null or btrim(p_license_number) = '' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select *
    into v_driver
    from public.driver_profiles
   where upper(btrim(license_number)) = upper(btrim(p_license_number))
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if coalesce(v_driver.is_locked, false) then
    return jsonb_build_object('ok', false, 'error', 'account_locked');
  end if;

  return jsonb_build_object(
    'ok', true,
    'attemptsRemaining', greatest(0, 3 - coalesce(v_driver.recovery_attempts, 0))
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. PIN recovery — step 2: verify DOB + plate, then reset the PIN
-- ----------------------------------------------------------------------------
create or replace function public.auth_driver_reset_pin(
  p_license_number text,
  p_date_of_birth date,
  p_plate text,
  p_new_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_driver public.driver_profiles%rowtype;
  v_match boolean;
begin
  if p_new_pin is null or p_new_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_pin');
  end if;

  select *
    into v_driver
    from public.driver_profiles
   where upper(btrim(license_number)) = upper(btrim(p_license_number))
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if coalesce(v_driver.is_locked, false) then
    return jsonb_build_object('ok', false, 'error', 'account_locked');
  end if;

  v_match := coalesce(v_driver.date_of_birth = p_date_of_birth, false)
    and exists (
      select 1
        from unnest(coalesce(v_driver.registered_plates, array[]::text[])) as plate
       where upper(btrim(plate)) = upper(btrim(coalesce(p_plate, '')))
    );

  if not v_match then
    update public.driver_profiles
       set recovery_attempts = coalesce(recovery_attempts, 0) + 1,
           is_locked = (coalesce(recovery_attempts, 0) + 1) >= 3
     where id = v_driver.id
    returning * into v_driver;

    if coalesce(v_driver.is_locked, false) then
      return jsonb_build_object(
        'ok', false,
        'error', 'account_locked',
        'attemptsRemaining', 0
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'error', 'invalid_answers',
      'attemptsRemaining', greatest(0, 3 - coalesce(v_driver.recovery_attempts, 0))
    );
  end if;

  update public.driver_profiles
     set pin_hash = crypt(p_new_pin, gen_salt('bf', 10)),
         recovery_attempts = 0,
         is_locked = false
   where id = v_driver.id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- Privileges: the browser may only call these five functions.
-- ----------------------------------------------------------------------------
revoke all on function public.auth_driver_login(text, text) from public;
revoke all on function public.auth_staff_login(text, text) from public;
revoke all on function public.auth_driver_register(text, text, date, text, text, text, text) from public;
revoke all on function public.auth_driver_recovery_lookup(text) from public;
revoke all on function public.auth_driver_reset_pin(text, date, text, text) from public;

grant execute on function public.auth_driver_login(text, text) to anon, authenticated;
grant execute on function public.auth_staff_login(text, text) to anon, authenticated;
grant execute on function public.auth_driver_register(text, text, date, text, text, text, text) to anon, authenticated;
grant execute on function public.auth_driver_recovery_lookup(text) to anon, authenticated;
grant execute on function public.auth_driver_reset_pin(text, date, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Defense in depth: pin_hash must never be readable through PostgREST.
-- Enabling RLS with no policies blocks direct table access for anon/auth;
-- the SECURITY DEFINER functions above still work as the function owner.
-- ----------------------------------------------------------------------------
alter table public.driver_profiles enable row level security;
alter table public.terminal_staff enable row level security;

revoke all on table public.driver_profiles from anon, authenticated;
revoke all on table public.terminal_staff from anon, authenticated;
