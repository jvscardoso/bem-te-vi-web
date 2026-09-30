import { createContext, useContext } from 'react';
import type { Me } from '@/api/types';
import type { PermissionRequirement } from './permissions';

export type AuthStatus = 'anonymous' | 'loading' | 'authenticated' | 'error';

export interface AuthContextValue {
  status: AuthStatus;
  user: Me | null;
  /** Erro ao carregar /auth/me que não seja 401 (ex.: API fora do ar). */
  error: unknown;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => void;
  /** Substitui o token (ex.: após trocar a própria senha). */
  replaceToken: (accessToken: string) => void;
  refresh: () => Promise<unknown>;
  can: (required?: PermissionRequirement) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return context;
}

/** Tenant do usuário logado — só para telas atrás de <RequireAuth>. */
export function useTenantId(): string {
  const { user } = useAuth();
  if (!user) throw new Error('useTenantId exige usuário autenticado');
  return user.tenantId;
}
