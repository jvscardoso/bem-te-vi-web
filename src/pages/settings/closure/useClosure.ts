import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantKeys, tenantsApi, type ClosureState } from '@/api/tenants';
import type { Tenant } from '@/api/types';
import { useAuth, useTenantId } from '@/auth/AuthContext';

/**
 * Estado do encerramento da conta. Só quem tem `tenant:manage` consegue consultar: para os demais
 * usuários a API não informa o pedido, então eles não veem aviso.
 */
export function useClosureState() {
  const tenantId = useTenantId();
  const { can } = useAuth();
  return useQuery({
    queryKey: tenantKeys.closure(tenantId),
    queryFn: () => tenantsApi.closure(tenantId),
    enabled: can('tenant:manage'),
    staleTime: 5 * 60_000,
  });
}

/** Grava a resposta do pedido/cancelamento no cache (aba, banner e dados da clínica). */
function useApplyClosure() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return (state: ClosureState) => {
    queryClient.setQueryData(tenantKeys.closure(tenantId), state);
    queryClient.setQueryData(tenantKeys.detail(tenantId), (old?: Tenant) =>
      old ? { ...old, closureRequestedAt: state.closureRequestedAt } : old,
    );
    void queryClient.invalidateQueries({ queryKey: ['audit-logs', tenantId] });
  };
}

export function useRequestClosure() {
  const tenantId = useTenantId();
  const apply = useApplyClosure();
  return useMutation({
    mutationFn: (password: string) => tenantsApi.requestClosure(tenantId, password),
    onSuccess: apply,
  });
}

export function useCancelClosure() {
  const tenantId = useTenantId();
  const apply = useApplyClosure();
  return useMutation({ mutationFn: () => tenantsApi.cancelClosure(tenantId), onSuccess: apply });
}
