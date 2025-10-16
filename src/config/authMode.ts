export type AuthMode = 'native' | 'clerk';

export function getAuthMode(): AuthMode {
  const raw = (process.env.AUTH_MODE || '').trim().toLowerCase();
  return raw === 'native' ? 'native' : 'clerk';
}

export function isClerkMode(): boolean {
  return getAuthMode() === 'clerk';
}

export function isNativeMode(): boolean {
  return getAuthMode() === 'native';
}