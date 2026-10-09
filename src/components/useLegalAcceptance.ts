import { useQuery } from '@tanstack/react-query';
import { legalApi, legalKeys, toLegalAcceptance, type LegalAcceptance } from '@/api/legal';

/** Versões vigentes dos Termos e da Política, para enviar junto com o aceite. */
export function useLegalAcceptance(): {
  acceptance: LegalAcceptance | null;
  error: unknown;
  /** Busca as versões de novo (depois de um 400 de versão desatualizada). */
  refresh: () => Promise<unknown>;
} {
  const query = useQuery({ queryKey: legalKeys.current, queryFn: legalApi.current, staleTime: 5 * 60_000 });
  return {
    acceptance: query.data ? toLegalAcceptance(query.data) : null,
    error: query.error,
    refresh: query.refetch,
  };
}
