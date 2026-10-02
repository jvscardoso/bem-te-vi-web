import type { QueryClient } from '@tanstack/react-query';
import type { PublicBranding } from '@/api/types';

/**
 * Aplica na hora uma alteração de marca/nome ao tema do app.
 *
 * Não basta invalidar: `GET /public/branding` responde com `Cache-Control: max-age=60`,
 * então o navegador devolveria a versão antiga por até 1 minuto. Atualizamos o cache
 * do React Query direto — só para a marca desta clínica (identificada pelo nome
 * anterior), sem tocar na de outro endereço.
 */
export function applyBrandingToCache(queryClient: QueryClient, clinicName: string, patch: Partial<PublicBranding>) {
  queryClient.setQueriesData<PublicBranding>({ queryKey: ['public-branding'] }, (current) =>
    current && current.name === clinicName ? { ...current, ...patch } : current,
  );
}
