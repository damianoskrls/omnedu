import { jwtDecode } from 'jose';
import { useState, useEffect } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  schoolId: string | null;
  role: string | null;
  memberships: { schoolId: string; schoolName: string; role: string }[];
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '=='.slice(0, (4 - b64.length % 4) % 4);
    const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      isSuperAdmin: payload.isSuperAdmin,
      schoolId: payload.schoolId,
      role: payload.role,
      memberships: payload.memberships ?? [],
    };
  } catch {
    return null;
  }
}

export function useStoredUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    sync();
    window.addEventListener('auth-changed', sync);
    return () => window.removeEventListener('auth-changed', sync);
  }, []);
  return user;
}

export function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
  window.dispatchEvent(new Event('auth-changed'));
}

export function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}
