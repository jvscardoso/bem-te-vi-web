import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { refreshSession } from '@/api/client';
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext';
import { hasPermissions } from './permissions';
import { session } from './session';

const meQueryKey = ['auth', 'me'] as const;

/** Chaves de cache que não pertencem ao usuário logado (ex.: marca pública). */
const PUBLIC_QUERY_ROOTS = new Set<unknown>(['public-branding']);

function clearUserData(queryClient: QueryClient) {
  queryClient.cancelQueries({ predicate: (query) => !PUBLIC_QUERY_ROOTS.has(query.queryKey[0]) });
  queryClient.removeQueries({ predicate: (query) => !PUBLIC_QUERY_ROOTS.has(query.queryKey[0]) });
  queryClient.getMutationCache().clear();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const token = useSyncExternalStore(session.subscribe, session.getToken);
  // O token fica só em memória e some no reload; o cookie de refresh, não. Ao abrir a página,
  // tenta recuperar a sessão por ele antes de decidir entre o app e o login.
  const [restoring, setRestoring] = useState(() => session.getToken() === null);

  useEffect(() => {
    if (!restoring) return;
    let active = true;
    // Sem sessão (401) ou API fora do ar: segue para o login, que mostra o erro se houver.
    refreshSession()
      .catch(() => null)
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [restoring]);

  // Permissões e status são relidos do servidor ao abrir o app e ao voltar o
  // foco para a aba, pois um admin pode alterá-los a qualquer momento.
  const meQuery = useQuery({
    queryKey: meQueryKey,
    queryFn: authApi.me,
    enabled: token !== null,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Sem sessão, nada do usuário anterior pode ficar em cache.
  useEffect(() => {
    if (token === null) clearUserData(queryClient);
  }, [token, queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { accessToken } = await authApi.login(email, password);
      clearUserData(queryClient);
      session.setToken(accessToken);
      return queryClient.fetchQuery({ queryKey: meQueryKey, queryFn: authApi.me });
    },
    [queryClient],
  );

  // Encerra no servidor antes de limpar aqui; se a chamada falhar (rede), a sessão local cai mesmo assim.
  const logout = useCallback(() => {
    void authApi
      .logout()
      .catch(() => undefined)
      .finally(() => session.clear('logout'));
  }, []);

  const replaceToken = useCallback((accessToken: string) => session.setToken(accessToken), []);

  const { data: me, error, refetch } = meQuery;
  const user = token !== null ? (me ?? null) : null;

  let status: AuthStatus;
  if (restoring) status = 'loading';
  else if (token === null) status = 'anonymous';
  else if (user) status = 'authenticated';
  else if (error) status = 'error';
  else status = 'loading';

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error: status === 'error' ? error : null,
      login,
      logout,
      replaceToken,
      refresh: refetch,
      can: (required) => (user ? hasPermissions(user.permissions, required) : false),
    }),
    [status, user, error, login, logout, replaceToken, refetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
