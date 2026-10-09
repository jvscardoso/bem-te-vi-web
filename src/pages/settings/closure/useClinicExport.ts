import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantsApi } from '@/api/tenants';
import { useTenantId } from '@/auth/AuthContext';
import { saveJson } from '@/lib/download';

/**
 * "Exportar todos os dados" da clínica: busca autenticada e download do JSON. O nome segue o da
 * API (`clinica-<subdominio>-<AAAA-MM-DD>.json`), montado aqui porque a API não expõe o
 * `Content-Disposition` no CORS.
 */
export function useClinicExport() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => tenantsApi.exportAll(tenantId),
    onSuccess: (data) => {
      saveJson(data, `clinica-${data.clinic.subdomain}-${data.exportedAt.slice(0, 10)}.json`);
      // A exportação entra na trilha de auditoria.
      void queryClient.invalidateQueries({ queryKey: ['audit-logs', tenantId] });
    },
  });
}
