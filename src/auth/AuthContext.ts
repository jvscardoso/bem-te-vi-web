import { createContext, useContext } from 'react';
import type { Me, SubscriptionState } from '@/api/types';
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
  /**
   * Permissões efetivas: as de `/auth/me`, sem as de escrita enquanto a assinatura está em só
   * leitura (a API recusaria com 402). Use para mostrar ou esconder telas e ações.
   */
  can: (required?: PermissionRequirement) => boolean;
  /** Permissões do papel, ignorando a assinatura (ex.: para explicar por que uma tela está fechada). */
  hasRole: (required?: PermissionRequirement) => boolean;
  /** Assinatura da clínica; null na plataforma (e sem sessão). */
  subscription: SubscriptionState | null;
  /** Clínica em só leitura: telas de administração desabilitam o que altera dados. */
  readOnly: boolean;
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
