import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi, subscriptionKeys, type ContractInput } from '@/api/subscription';
import { useTenantId } from '@/auth/AuthContext';

/** Planos públicos; mudam raramente, então ficam em cache por uma hora. */
export function usePlans() {
  return useQuery({ queryKey: subscriptionKeys.plans, queryFn: subscriptionApi.plans, staleTime: 60 * 60_000 });
}

/** Detalhes da assinatura (`tenant:manage`). Responde mesmo com a clínica bloqueada. */
export function useSubscriptionDetails(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: subscriptionKeys.detail(tenantId),
    queryFn: () => subscriptionApi.get(tenantId),
    enabled,
  });
}

export function useContractSubscription() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ContractInput) => subscriptionApi.contract(tenantId, input),
    onSuccess: (details) => {
      queryClient.setQueryData(subscriptionKeys.detail(tenantId), details);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
