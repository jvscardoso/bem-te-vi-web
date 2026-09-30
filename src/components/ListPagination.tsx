import { TablePagination } from '@mui/material';
import type { Page } from '@/api/types';
import { PAGE_SIZE_OPTIONS } from '@/lib/useListSearchParams';

interface ListPaginationProps {
  meta: Page<unknown>['meta'];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/** Paginação para o envelope { data, meta } da API (páginas começam em 1). */
export function ListPagination({ meta, onPageChange, onPageSizeChange }: ListPaginationProps) {
  return (
    <TablePagination
      component="div"
      count={meta.total}
      page={Math.min(meta.page - 1, Math.max(meta.totalPages - 1, 0))}
      rowsPerPage={meta.pageSize}
      rowsPerPageOptions={PAGE_SIZE_OPTIONS}
      onPageChange={(_, page) => onPageChange(page + 1)}
      onRowsPerPageChange={(event) => onPageSizeChange(Number(event.target.value))}
    />
  );
}
