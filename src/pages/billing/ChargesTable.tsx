import { Link as RouterLink, useNavigate } from 'react-router';
import { Chip, Link, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import type { Charge } from '@/api/types';
import { formatCents, formatDate } from '@/lib/format';
import { chargeDisplayStatus, DISPLAY_STATUS } from './status';

const hideOnMobile = { display: { xs: 'none', md: 'table-cell' } } as const;

interface ChargesTableProps {
  charges: Charge[];
  /** Esconde a coluna de paciente (na ficha do próprio paciente). */
  hidePatient?: boolean;
}

export function ChargesTable({ charges, hidePatient }: ChargesTableProps) {
  const navigate = useNavigate();

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Vencimento</TableCell>
            {!hidePatient && <TableCell>Paciente</TableCell>}
            <TableCell sx={hideOnMobile}>Descrição</TableCell>
            <TableCell align="right">Valor</TableCell>
            <TableCell align="right" sx={hideOnMobile}>
              Saldo
            </TableCell>
            <TableCell>Situação</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {charges.map((charge) => {
            const status = DISPLAY_STATUS[chargeDisplayStatus(charge)];
            const path = `/financeiro/cobrancas/${charge.id}`;
            return (
              <TableRow key={charge.id} hover onClick={() => navigate(path)} sx={{ cursor: 'pointer' }}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Link
                    component={RouterLink}
                    to={path}
                    color="inherit"
                    underline="hover"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {formatDate(charge.dueDate)}
                  </Link>
                </TableCell>
                {!hidePatient && <TableCell sx={{ fontWeight: 500 }}>{charge.patient.fullName}</TableCell>}
                <TableCell sx={{ ...hideOnMobile, maxWidth: 280 }}>
                  <Typography variant="body2" noWrap>
                    {charge.description}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {formatCents(charge.amountCents)}
                </TableCell>
                <TableCell align="right" sx={{ ...hideOnMobile, whiteSpace: 'nowrap' }}>
                  {charge.status === 'pending' ? formatCents(charge.balanceCents) : '—'}
                </TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" label={status.label} color={status.color} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
