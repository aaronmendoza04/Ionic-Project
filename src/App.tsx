import React, { useState, useEffect } from 'react';
import {
  IonApp,
  IonPage,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonButton,
  IonSpinner,
  IonToast,
  IonRouterOutlet,
  setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  Ship,
  Truck,
  ScanLine,
  Lock,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  KeyRound,
  IdCard,
  BadgeCheck,
  UserPlus,
  HelpCircle,
  ShieldCheck,
  Calendar,
  Phone,
  Building2,
  Eye,
  EyeOff,
} from 'lucide-react';
import Tab1 from './pages/Tab1';
import Tab2 from './pages/Tab2';
import Tab3 from './pages/Tab3';
import { supabase } from './lib/supabase';
import type { AuthRpcResponse, AuthUser, UserRole } from './types/auth';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import '@ionic/react/css/palettes/dark.system.css';

import './theme/variables.css';

setupIonicReact();

type LoginMode = 'driver' | 'staff';
type AuthView = 'login' | 'register' | 'recovery';
type RecoveryStep = 'license' | 'verify';

interface RegistrationForm {
  licenseNumber: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
  companyName: string;
  plate: string;
  pin: string;
  confirmPin: string;
}

const EMPTY_REGISTRATION: RegistrationForm = {
  licenseNumber: '',
  fullName: '',
  dateOfBirth: '',
  phone: '',
  companyName: '',
  plate: '',
  pin: '',
  confirmPin: '',
};

const PIN_PATTERN = /^\d{6}$/;
const LOCK_THRESHOLD = 3;

/** Vite's BASE_URL is "/" locally and "/Ionic-Project/" on GitHub Pages. */
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

const digitsOnly = (value?: string | null) => (value ?? '').replace(/\D/g, '').slice(0, 6);

const describeAuthError = (result: AuthRpcResponse): string => {
  switch (result.error) {
    case 'invalid_credentials':
      return 'Invalid ID number or PIN. Please check your details and try again.';
    case 'account_locked':
      return `This profile is locked after ${LOCK_THRESHOLD} failed identity checks. Please visit a PPA terminal counter for a physical identity override.`;
    case 'invalid_answers': {
      const remaining = result.attemptsRemaining ?? 0;
      return `The date of birth or truck plate did not match. ${remaining} recovery attempt${remaining === 1 ? '' : 's'} remaining before this profile is locked.`;
    }
    case 'not_found':
      return 'No driver profile matches that license number. Check the number or complete First-Time Setup.';
    case 'license_exists':
      return 'A driver profile already exists for this license number. Sign in or use Forgot PIN.';
    case 'invalid_pin':
      return 'Your PIN must be exactly 6 digits.';
    case 'invalid_details':
      return 'Please complete every field with valid details.';
    case 'server_error':
      return result.message
        ? `Authentication service error: ${result.message}`
        : 'The authentication service is unavailable. Please try again.';
    default:
      return 'Unable to complete this request. Please try again.';
  }
};

const AuthAlert: React.FC<{ message: string }> = ({ message }) => (
  <div className="auth-alert" role="alert">
    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
    <span>{message}</span>
  </div>
);

interface PremiumInputProps {
  id: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password' | 'date' | 'tel';
  placeholder?: string;
  autoComplete?: string;
  autoCapitalize?: string;
  maxLength?: number;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  max?: string;
}

/**
 * Glassmorphic input used across all authentication forms.
 * The leading Lucide icon is decorative and never intercepts clicks;
 * password fields get an internal show/hide control.
 */
const PremiumInput: React.FC<PremiumInputProps> = ({
  id,
  icon,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  autoCapitalize,
  maxLength,
  inputMode,
  max,
}) => {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const isPin = inputMode === 'numeric';

  return (
    <div
      className={`premium-input-group${isPassword ? ' has-toggle' : ''}${isPin ? ' is-pin' : ''}`}
    >
      <span className="premium-input-icon" aria-hidden="true">
        {icon}
      </span>
      <input
        id={id}
        type={isPassword && revealed ? 'text' : type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        inputMode={inputMode}
        max={max}
        spellCheck={false}
      />
      {isPassword && (
        <button
          type="button"
          className="premium-input-toggle"
          onClick={() => setRevealed((current) => !current)}
          aria-label={revealed ? 'Hide PIN' : 'Show PIN'}
          aria-pressed={revealed}
        >
          {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      )}
    </div>
  );
};

/* ----------------------- ROLE-BASED NAVIGATION ----------------------- */
const DEFAULT_ROUTE_BY_ROLE: Record<UserRole, string> = {
  driver: '/driver',
  admin: '/admin',
  guard: '/guard',
};

const defaultRouteFor = (role: UserRole): string => DEFAULT_ROUTE_BY_ROLE[role] ?? '/';

/**
 * React Router v6 replaced `<Redirect>` with `<Navigate>`. Aliasing the
 * component keeps the declarative route table readable and lets
 * `@ionic/react-router` recognise redirect routes by their underlying
 * `Navigate` type. The optional `from` prop is documentation only; the
 * parent `<Route path>` performs the actual matching.
 */
const Redirect = Navigate as unknown as React.FC<{
  from?: string;
  to: string;
  replace?: boolean;
}>;

interface ProtectedRouteProps {
  user: AuthUser | null;
  allowedRole: UserRole;
  children: React.ReactNode;
}

/**
 * Guards a portal route by role. A signed-in user who reaches another role's
 * URL is sent to their own dashboard instead of being shown the wrong portal.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ user, allowedRole, children }) => {
  if (!user) {
    return <Redirect to="/" replace />;
  }
  if (user.role !== allowedRole) {
    return <Redirect to={defaultRouteFor(user.role)} replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  /* ---------------------------------------------------------------- */
  /* Authenticated session — held in memory only. A refresh logs out.  */
  /* ---------------------------------------------------------------- */
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 2400);
    return () => clearTimeout(t);
  }, []);

  const [view, setView] = useState<AuthView>('login');
  const [loginMode, setLoginMode] = useState<LoginMode>('driver');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  /* Login fields */
  const [licenseNumber, setLicenseNumber] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [pin, setPin] = useState('');

  /* First-time registration fields */
  const [registration, setRegistration] = useState<RegistrationForm>(EMPTY_REGISTRATION);

  /* PIN recovery fields */
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('license');
  const [recoveryLicense, setRecoveryLicense] = useState('');
  const [recoveryDob, setRecoveryDob] = useState('');
  const [recoveryPlate, setRecoveryPlate] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  const updateRegistration = (field: keyof RegistrationForm, value: string) => {
    setRegistration((prev) => ({ ...prev, [field]: value }));
  };

  const callAuthRpc = async (
    fn: string,
    args: Record<string, unknown>
  ): Promise<AuthRpcResponse> => {
    try {
      const { data, error } = await supabase.rpc(fn, args);
      if (error) {
        return { ok: false, error: 'server_error', message: error.message };
      }
      return (data as AuthRpcResponse) ?? { ok: false, error: 'server_error' };
    } catch (err) {
      return {
        ok: false,
        error: 'server_error',
        message: err instanceof Error ? err.message : undefined,
      };
    }
  };

  const clearRecovery = () => {
    setRecoveryStep('license');
    setRecoveryLicense('');
    setRecoveryDob('');
    setRecoveryPlate('');
    setNewPin('');
    setConfirmNewPin('');
  };

  const goToLogin = () => {
    setView('login');
    setErrorMsg('');
    setPin('');
    clearRecovery();
  };

  const openRegistration = () => {
    setView('register');
    setErrorMsg('');
    setPin('');
  };

  const openRecovery = () => {
    setView('recovery');
    setRecoveryStep('license');
    setErrorMsg('');
    setPin('');
  };

  /* ----------------------------- LOGIN ----------------------------- */
  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setErrorMsg('');

    if (loginMode === 'driver') {
      const license = licenseNumber.trim();
      if (!license) {
        setErrorMsg('Enter your driver license number.');
        return;
      }
      if (!PIN_PATTERN.test(pin)) {
        setErrorMsg('Enter your 6-digit PIN.');
        return;
      }

      setBusy(true);
      const result = await callAuthRpc('auth_driver_login', {
        p_license_number: license,
        p_pin: pin,
      });
      setBusy(false);

      if (!result.ok || !result.user) {
        setErrorMsg(describeAuthError(result));
        return;
      }

      setPin('');
      setUser(result.user);
      setToastMsg(`Welcome back, ${result.user.name}.`);
      return;
    }

    const badge = badgeNumber.trim();
    if (!badge) {
      setErrorMsg('Enter your terminal staff badge number.');
      return;
    }
    if (!PIN_PATTERN.test(pin)) {
      setErrorMsg('Enter your 6-digit PIN.');
      return;
    }

    setBusy(true);
    const result = await callAuthRpc('auth_staff_login', {
      p_badge_number: badge,
      p_pin: pin,
    });
    setBusy(false);

    if (!result.ok || !result.user) {
      setErrorMsg(describeAuthError(result));
      return;
    }

    setPin('');
    setUser(result.user);
    setToastMsg(`Signed in as ${result.user.name} (${result.user.role}).`);
  };

  /* -------------------- FIRST-TIME REGISTRATION -------------------- */
  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setErrorMsg('');

    const requiredFields: Array<[keyof RegistrationForm, string]> = [
      ['licenseNumber', 'license number'],
      ['fullName', 'full name'],
      ['dateOfBirth', 'date of birth'],
      ['phone', 'mobile number'],
      ['companyName', 'company name'],
      ['plate', 'truck plate'],
    ];

    for (const [field, label] of requiredFields) {
      if (!registration[field].trim()) {
        setErrorMsg(`Enter your ${label}.`);
        return;
      }
    }

    if (!PIN_PATTERN.test(registration.pin)) {
      setErrorMsg('Your PIN must be exactly 6 digits.');
      return;
    }
    if (registration.pin !== registration.confirmPin) {
      setErrorMsg('The PIN confirmation does not match.');
      return;
    }

    setBusy(true);
    const result = await callAuthRpc('auth_driver_register', {
      p_license_number: registration.licenseNumber.trim(),
      p_full_name: registration.fullName.trim(),
      p_date_of_birth: registration.dateOfBirth,
      p_phone: registration.phone.trim(),
      p_company_name: registration.companyName.trim(),
      p_plate: registration.plate.trim(),
      p_pin: registration.pin,
    });
    setBusy(false);

    if (!result.ok || !result.user) {
      setErrorMsg(describeAuthError(result));
      return;
    }

    try {
      localStorage.setItem(`portpass_profile_${registration.licenseNumber.trim().toUpperCase()}`, JSON.stringify({
        phone: registration.phone.trim(),
        company: registration.companyName.trim(),
        plate: registration.plate.trim().toUpperCase(),
      }));
    } catch {}
    setRegistration(EMPTY_REGISTRATION);
    setPin('');
    setUser(result.user);
    setToastMsg(`Profile created. Welcome to PortPass, ${result.user.name}.`);
  };

  /* -------------------------- PIN RECOVERY ------------------------- */
  const handleRecoveryLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setErrorMsg('');

    const license = recoveryLicense.trim();
    if (!license) {
      setErrorMsg('Enter the license number on your driver profile.');
      return;
    }

    setBusy(true);
    const result = await callAuthRpc('auth_driver_recovery_lookup', {
      p_license_number: license,
    });
    setBusy(false);

    if (!result.ok) {
      setErrorMsg(describeAuthError(result));
      return;
    }

    setRecoveryLicense(license);
    setRecoveryStep('verify');
  };

  const handleResetPin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setErrorMsg('');

    if (!recoveryDob) {
      setErrorMsg('Enter your date of birth for identity verification.');
      return;
    }
    if (!recoveryPlate.trim()) {
      setErrorMsg('Enter a truck plate registered to this profile.');
      return;
    }
    if (!PIN_PATTERN.test(newPin)) {
      setErrorMsg('Your new PIN must be exactly 6 digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setErrorMsg('The new PIN confirmation does not match.');
      return;
    }

    setBusy(true);
    const result = await callAuthRpc('auth_driver_reset_pin', {
      p_license_number: recoveryLicense,
      p_date_of_birth: recoveryDob,
      p_plate: recoveryPlate.trim(),
      p_new_pin: newPin,
    });
    setBusy(false);

    if (!result.ok) {
      setErrorMsg(describeAuthError(result));
      return;
    }

    const resetLicense = recoveryLicense;
    clearRecovery();
    setView('login');
    setLoginMode('driver');
    setLicenseNumber(resetLicense);
    setPin('');
    setErrorMsg('');
    setToastMsg('PIN reset successfully. Sign in with your new PIN.');
  };

  const handleLogout = () => {
    setUser(null);
    setView('login');
    setLoginMode('driver');
    setLicenseNumber('');
    setBadgeNumber('');
    setPin('');
    setRegistration(EMPTY_REGISTRATION);
    clearRecovery();
    setErrorMsg('');
    /*
     * The authenticated router unmounts with the session. Reset the browser
     * URL to the root so a later sign-in starts from the role fallback
     * redirect rather than a stale portal path from the previous user.
     */
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', import.meta.env.BASE_URL);
    }
  };

  /* --------------------- ROLE-SCOPED PORTALS ----------------------- */
  const renderAuthenticatedApp = (session: AuthUser) => (
    <IonReactRouter basename={ROUTER_BASENAME}>
      <IonRouterOutlet>
        <Routes>
          <Route
            path="/driver"
            element={
              <ProtectedRoute user={session} allowedRole="driver">
                <Tab1 key={session.id} currentDriver={session} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute user={session} allowedRole="admin">
                <Tab2 key={session.id} staffName={session.name} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guard"
            element={
              <ProtectedRoute user={session} allowedRole="guard">
                <Tab3 key={session.id} staffName={session.name} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Successful login lands on "/" and is forwarded to the role dashboard. */}
          <Route
            path="/"
            element={<Redirect from="/" to={defaultRouteFor(session.role)} replace />}
          />
          <Route path="*" element={<Redirect to={defaultRouteFor(session.role)} replace />} />
        </Routes>
      </IonRouterOutlet>
    </IonReactRouter>
  );

  return (
    <IonApp>
      {showSplash && (
        <div className="splash-overlay">
          <div className="splash-logo">
            <Ship size={56} />
          </div>
          <div className="splash-title">PortPass</div>
          <div className="splash-subtitle">Maritime Logistics OS</div>
          <div className="splash-loader"><span></span></div>
        </div>
      )}
      {user ? (
        renderAuthenticatedApp(user)
      ) : (
        <IonPage>
          <IonContent fullscreen>
            <div className="auth-shell">
              <header className="auth-brand animate-enter">
                <div className="auth-brand-mark">
                  <Ship size={26} />
                </div>
                <div className="auth-brand-eyebrow">PHILIPPINE PORTS AUTHORITY</div>
                <h1>
                  PortPass <span>OS</span>
                </h1>
                <p>
                  {view === 'login'
                    ? 'Secure terminal clearance gateway'
                    : view === 'register'
                      ? 'Create your driver credential'
                      : 'Recover access to your driver profile'}
                </p>
              </header>

              <main className="auth-card glass-card animate-enter">
                {view !== 'login' && (
                  <button type="button" className="auth-back" onClick={goToLogin}>
                    <ArrowLeft size={15} /> Back to sign in
                  </button>
                )}

                {/* --------------------------- LOGIN --------------------------- */}
                {view === 'login' && (
                  <>
                    <IonSegment
                      mode="ios"
                      className="auth-segment"
                      value={loginMode}
                      onIonChange={(event) => {
                        setLoginMode((event.detail.value as LoginMode) ?? 'driver');
                        setErrorMsg('');
                        setPin('');
                      }}
                    >
                      <IonSegmentButton value="driver">
                        <Truck size={16} />
                        <span>Driver Login</span>
                      </IonSegmentButton>
                      <IonSegmentButton value="staff">
                        <ScanLine size={16} />
                        <span>Terminal Staff</span>
                      </IonSegmentButton>
                    </IonSegment>

                    <form onSubmit={handleLogin} noValidate>
                      {loginMode === 'driver' ? (
                        <div className="auth-field">
                          <label htmlFor="license-number">Driver License Number</label>
                          <PremiumInput
                            id="license-number"
                            icon={<IdCard size={17} />}
                            placeholder="e.g. LTO-NCR-00012345"
                            value={licenseNumber}
                            onChange={setLicenseNumber}
                            autoComplete="username"
                            autoCapitalize="characters"
                          />
                        </div>
                      ) : (
                        <div className="auth-field">
                          <label htmlFor="badge-number">Terminal Staff Badge Number</label>
                          <PremiumInput
                            id="badge-number"
                            icon={<BadgeCheck size={17} />}
                            placeholder="e.g. PPA-GRD-0187"
                            value={badgeNumber}
                            onChange={setBadgeNumber}
                            autoComplete="username"
                            autoCapitalize="characters"
                          />
                        </div>
                      )}

                      <div className="auth-field">
                        <label htmlFor="login-pin">6-Digit PIN</label>
                        <PremiumInput
                          id="login-pin"
                          icon={<Lock size={17} />}
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="••••••"
                          value={pin}
                          onChange={(value) => setPin(digitsOnly(value))}
                          autoComplete="current-password"
                        />
                      </div>

                      {errorMsg && <AuthAlert message={errorMsg} />}

                      <IonButton
                        expand="block"
                        type="submit"
                        className="auth-submit"
                        disabled={busy}
                      >
                        {busy ? (
                          <IonSpinner name="crescent" />
                        ) : (
                          <>
                            <Lock size={16} /> Sign In <ArrowRight size={16} />
                          </>
                        )}
                      </IonButton>
                    </form>

                    {loginMode === 'driver' ? (
                      <div className="auth-links">
                        <button type="button" onClick={openRegistration}>
                          <UserPlus size={14} /> First-time setup
                        </button>
                        <button type="button" onClick={openRecovery}>
                          <HelpCircle size={14} /> Forgot PIN?
                        </button>
                      </div>
                    ) : (
                      <p className="auth-hint">
                        Admin and guard portals are assigned from the role column on your
                        terminal_staff record.
                      </p>
                    )}
                  </>
                )}

                {/* ---------------------- DRIVER REGISTRATION ------------------- */}
                {view === 'register' && (
                  <>
                    <h2 className="auth-title">First-Time Driver Setup</h2>
                    <p className="auth-subtitle">
                      Your PIN is hashed with bcrypt inside PostgreSQL before it is stored.
                    </p>

                    <form onSubmit={handleRegister} noValidate>
                      <div className="auth-field">
                        <label htmlFor="reg-license">License Number</label>
                        <PremiumInput
                          id="reg-license"
                          icon={<IdCard size={17} />}
                          placeholder="LTO-NCR-00012345"
                          value={registration.licenseNumber}
                          onChange={(value) => updateRegistration('licenseNumber', value)}
                          autoCapitalize="characters"
                        />
                      </div>

                      <div className="auth-field">
                        <label htmlFor="reg-name">Full Name</label>
                        <PremiumInput
                          id="reg-name"
                          icon={<BadgeCheck size={17} />}
                          placeholder="Aaron Mendoza"
                          value={registration.fullName}
                          onChange={(value) => updateRegistration('fullName', value)}
                          autoComplete="name"
                        />
                      </div>

                      <div className="auth-grid-2">
                        <div className="auth-field">
                          <label htmlFor="reg-dob">Date of Birth</label>
                          <PremiumInput
                            id="reg-dob"
                            icon={<Calendar size={17} />}
                            type="date"
                            max={new Date().toISOString().slice(0, 10)}
                            value={registration.dateOfBirth}
                            onChange={(value) => updateRegistration('dateOfBirth', value)}
                          />
                        </div>
                        <div className="auth-field">
                          <label htmlFor="reg-phone">Mobile Number</label>
                          <PremiumInput
                            id="reg-phone"
                            icon={<Phone size={17} />}
                            type="tel"
                            inputMode="tel"
                            placeholder="0917 555 0192"
                            value={registration.phone}
                            onChange={(value) => updateRegistration('phone', value)}
                            autoComplete="tel"
                          />
                        </div>
                      </div>

                      <div className="auth-field">
                        <label htmlFor="reg-company">Company Name</label>
                        <PremiumInput
                          id="reg-company"
                          icon={<Building2 size={17} />}
                          placeholder="Mindoro Island Freight"
                          value={registration.companyName}
                          onChange={(value) => updateRegistration('companyName', value)}
                          autoComplete="organization"
                        />
                      </div>

                      <div className="auth-field">
                        <label htmlFor="reg-plate">Registered Truck Plate</label>
                        <PremiumInput
                          id="reg-plate"
                          icon={<Truck size={17} />}
                          placeholder="NDA-8841"
                          value={registration.plate}
                          onChange={(value) => updateRegistration('plate', value)}
                          autoCapitalize="characters"
                        />
                      </div>

                      <div className="auth-grid-2">
                        <div className="auth-field">
                          <label htmlFor="reg-pin">Create 6-Digit PIN</label>
                          <PremiumInput
                            id="reg-pin"
                            icon={<KeyRound size={17} />}
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="••••••"
                            value={registration.pin}
                            onChange={(value) => updateRegistration('pin', digitsOnly(value))}
                          />
                        </div>
                        <div className="auth-field">
                          <label htmlFor="reg-pin-confirm">Confirm PIN</label>
                          <PremiumInput
                            id="reg-pin-confirm"
                            icon={<KeyRound size={17} />}
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="••••••"
                            value={registration.confirmPin}
                            onChange={(value) => updateRegistration('confirmPin', digitsOnly(value))}
                          />
                        </div>
                      </div>

                      {errorMsg && <AuthAlert message={errorMsg} />}

                      <IonButton
                        expand="block"
                        type="submit"
                        className="auth-submit"
                        disabled={busy}
                      >
                        {busy ? (
                          <IonSpinner name="crescent" />
                        ) : (
                          <>
                            <UserPlus size={16} /> Create Driver Profile
                          </>
                        )}
                      </IonButton>
                    </form>
                  </>
                )}

                {/* ------------------------- PIN RECOVERY ---------------------- */}
                {view === 'recovery' && (
                  <>
                    <h2 className="auth-title">Forgot PIN</h2>
                    <p className="auth-subtitle">
                      Identity is verified against the date of birth and registered truck plate
                      on file.
                    </p>

                    {recoveryStep === 'license' ? (
                      <form onSubmit={handleRecoveryLookup} noValidate>
                        <div className="auth-field">
                          <label htmlFor="recovery-license">License Number</label>
                          <PremiumInput
                            id="recovery-license"
                            icon={<IdCard size={17} />}
                            placeholder="LTO-NCR-00012345"
                            value={recoveryLicense}
                            onChange={setRecoveryLicense}
                            autoCapitalize="characters"
                          />
                        </div>

                        {errorMsg && <AuthAlert message={errorMsg} />}

                        <IonButton
                          expand="block"
                          type="submit"
                          className="auth-submit"
                          disabled={busy}
                        >
                          {busy ? (
                            <IonSpinner name="crescent" />
                          ) : (
                            <>
                              Continue <ArrowRight size={16} />
                            </>
                          )}
                        </IonButton>
                      </form>
                    ) : (
                      <form onSubmit={handleResetPin} noValidate>
                        <div className="auth-recovery-context">
                          <ShieldCheck size={16} />
                          <span>
                            Verifying profile <strong>{recoveryLicense}</strong>
                          </span>
                        </div>

                        <div className="auth-field">
                          <label htmlFor="recovery-dob">Date of Birth</label>
                          <PremiumInput
                            id="recovery-dob"
                            icon={<Calendar size={17} />}
                            type="date"
                            max={new Date().toISOString().slice(0, 10)}
                            value={recoveryDob}
                            onChange={setRecoveryDob}
                          />
                        </div>

                        <div className="auth-field">
                          <label htmlFor="recovery-plate">Registered Truck Plate</label>
                          <PremiumInput
                            id="recovery-plate"
                            icon={<Truck size={17} />}
                            placeholder="NDA-8841"
                            value={recoveryPlate}
                            onChange={setRecoveryPlate}
                            autoCapitalize="characters"
                          />
                        </div>

                        <div className="auth-grid-2">
                          <div className="auth-field">
                            <label htmlFor="recovery-pin">New 6-Digit PIN</label>
                            <PremiumInput
                              id="recovery-pin"
                              icon={<KeyRound size={17} />}
                              type="password"
                              inputMode="numeric"
                              maxLength={6}
                              placeholder="••••••"
                              value={newPin}
                              onChange={(value) => setNewPin(digitsOnly(value))}
                            />
                          </div>
                          <div className="auth-field">
                            <label htmlFor="recovery-pin-confirm">Confirm New PIN</label>
                            <PremiumInput
                              id="recovery-pin-confirm"
                              icon={<KeyRound size={17} />}
                              type="password"
                              inputMode="numeric"
                              maxLength={6}
                              placeholder="••••••"
                              value={confirmNewPin}
                              onChange={(value) => setConfirmNewPin(digitsOnly(value))}
                            />
                          </div>
                        </div>

                        <div className="auth-warning">
                          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                          <span>
                            Three failed identity checks will lock this profile and require a
                            physical terminal override.
                          </span>
                        </div>

                        {errorMsg && <AuthAlert message={errorMsg} />}

                        <IonButton
                          expand="block"
                          type="submit"
                          className="auth-submit"
                          disabled={busy}
                        >
                          {busy ? (
                            <IonSpinner name="crescent" />
                          ) : (
                            <>
                              <KeyRound size={16} /> Reset PIN
                            </>
                          )}
                        </IonButton>
                      </form>
                    )}
                  </>
                )}
              </main>

              <footer className="auth-footer">
                Protected by PostgreSQL pgcrypto (bcrypt) · Session held in memory only
              </footer>
            </div>
          </IonContent>
        </IonPage>
      )}

      <IonToast
        isOpen={!!toastMsg}
        message={toastMsg}
        duration={3200}
        position="top"
        onDidDismiss={() => setToastMsg('')}
      />
    </IonApp>
  );
};

export default App;
