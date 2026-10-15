import { useQuery } from '@tanstack/react-query';
import { configsApi, configsKeys } from '@/api/configs';
import { useTenantId } from '@/auth/AuthContext';
import { normalizeWidgets } from './layout';

/** Layout salvo da tela inicial (ou o padrão do front, com `home: null`), já pronto para desenhar. */
export function useHomeLayout() {
  const tenantId = useTenantId();
  const query = useQuery({
    queryKey: configsKeys.detail(tenantId),
    queryFn: () => configsApi.get(tenantId),
    staleTime: 5 * 60_000,
  });
  const saved = query.data?.layouts.home ?? null;
  return { query, saved, widgets: normalizeWidgets(saved) };
}
