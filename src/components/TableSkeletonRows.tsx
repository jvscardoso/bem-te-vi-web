import { Skeleton, TableCell, TableRow, type SxProps, type Theme } from '@mui/material';

interface TableSkeletonRowsProps {
  /**
   * Colunas da tabela: a quantidade ou o `sx` de cada uma, para esconder no celular as mesmas
   * colunas que o cabeçalho esconde.
   */
  columns: number | (SxProps<Theme> | undefined)[];
  rows?: number;
}

/** Linhas de esqueleto no primeiro carregamento de uma lista (sem dados ainda para mostrar). */
export function TableSkeletonRows({ columns, rows = 5 }: TableSkeletonRowsProps) {
  const cells = typeof columns === 'number' ? Array.from({ length: columns }, () => undefined) : columns;
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row} aria-hidden>
          {cells.map((sx, cell) => (
            <TableCell key={cell} sx={sx}>
              {/* Larguras variadas por coluna: parece texto, não uma grade de blocos iguais. */}
              <Skeleton variant="text" width={cell === 0 ? '70%' : `${40 + ((row + cell) % 3) * 15}%`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
