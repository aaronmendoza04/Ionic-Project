export type UserRole = 'driver' | 'guard' | 'admin';

export interface AuthUser {
  id: string;
  role: UserRole;
  name: string;
  /** Driver-only fields */
  licenseNumber?: string;
  phone?: string;
  companyName?: string;
  registeredPlates?: string[];
  /** Terminal staff-only field */
  badgeNumber?: string;
}

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'account_locked'
  | 'invalid_answers'
  | 'not_found'
  | 'license_exists'
  | 'invalid_pin'
  | 'invalid_details'
  | 'server_error';

export interface AuthRpcResponse {
  ok: boolean;
  error?: AuthErrorCode;
  message?: string;
  user?: AuthUser;
  attemptsRemaining?: number;
}
