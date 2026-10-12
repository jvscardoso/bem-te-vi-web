import { useQuery } from '@tanstack/react-query';
import { configsApi, configsKeys, EMPTY_CONFIGS } from '@/api/configs';
import { useTenantId } from '@/auth/AuthContext';
import { isApiError } from '@/lib/errors';
import { normalizeWidgets } from './layout';

/** Layout salvo da tela inicial (ou o padrão do front), já pronto para desenhar. */
export function useHomeLayout() {
  const tenantId = useTenantId();
  const query = useQuery({
    queryKey: configsKeys.detail(tenantId),
    // 404: a API ainda não tem a rota (task 18). Equivale a "nada configurado", e vale o padrão.
    queryFn: () =>
      configsApi.get(tenantId).catch((error: unknown) => {
        if (isApiError(error, 404)) return EMPTY_CONFIGS;
        throw error;
      }),
    staleTime: 5 * 60_000,
  });
  const saved = query.data?.layouts.home ?? null;
  return { query, saved, widgets: normalizeWidgets(saved) };
}
