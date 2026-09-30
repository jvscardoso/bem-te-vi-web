import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDebouncedValue } from './useDebouncedValue';

export const PAGE_SIZE_OPTIONS = [20, 50, 100];

/**
 * Estado de listagem paginada com busca, guardado na URL (?q=&page=&pageSize=)
 * para sobreviver a reload e ao "voltar" do navegador.
 * `search` é o texto digitado; `q` é o valor com debounce que vai para a API.
 */
export function useListSearchParams(defaultPageSize = 20) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSizeParam = Number(params.get('pageSize'));
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam) ? pageSizeParam : defaultPageSize;

  const [search, setSearch] = useState(q);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const update = useCallback(
    (changes: Record<string, string | number | null>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === '' || (key === 'page' && value === 1)) next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // Nova busca sempre volta para a primeira página.
  useEffect(() => {
    if (debouncedSearch !== q) update({ q: debouncedSearch, page: 1 });
  }, [debouncedSearch, q, update]);

  return {
    search,
    setSearch,
    q,
    page,
    pageSize,
    setPage: (value: number) => update({ page: value }),
    setPageSize: (value: number) => update({ pageSize: value === defaultPageSize ? null : value, page: 1 }),
  };
}
