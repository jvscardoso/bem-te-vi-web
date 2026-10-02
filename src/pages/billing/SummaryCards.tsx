import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Box, IconButton, Paper, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { billingApi, billingKeys } from '@/api/billing';
import { useTenantId } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { formatMonthYear } from '@/lib/dates';
import { formatCents } from '@/lib/format';

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, from: start.toISOString(), to: new Date(end.getTime() - 1).toISOString() };
}

/** Cards do resumo. Pendente/atrasado/cancelado são o estado atual; recebido é do mês escolhido. */
export function SummaryCards() {
  const tenantId = useTenantId();
  const [monthOffset, setMonthOffset] = useState(0);
  const { start, from, to } = monthRange(monthOffset);

  const query = useQuery({
    queryKey: billingKeys.summary(tenantId, from, to),
    queryFn: () => billingApi.summary(tenantId, from, to),
    placeholderData: keepPreviousData,
  });

  if (query.error) return <ErrorMessages error={query.error} sx={{ mb: 3 }} />;

  const data = query.data;
  const cards = [
    { key: 'pending', label: 'A receber', hint: 'Pendentes em dia', value: data?.pending, color: 'info.main' },
    { key: 'overdue', label: 'Em atraso', hint: 'Pendentes vencidas', value: data?.overdue, color: 'error.main' },
    { key: 'cancelled', label: 'Canceladas', hint: 'Total cancelado', value: data?.cancelled, color: 'text.secondary' },
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        mb: 3,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
      }}
    >
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            Recebido em
          </Typography>
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <Tooltip title="Mês anterior">
              <IconButton size="small" aria-label="Mês anterior" onClick={() => setMonthOffset((value) => value - 1)}>
                <ChevronLeft fontSize="small" />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" sx={{ minWidth: 120, textAlign: 'center' }}>
              {formatMonthYear(start)}
            </Typography>
            <Tooltip title="Próximo mês">
              <span>
                <IconButton
                  size="small"
                  aria-label="Próximo mês"
                  disabled={monthOffset >= 0}
                  onClick={() => setMonthOffset((value) => value + 1)}
                >
                  <ChevronRight fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
        <Amount
          value={data?.paidInPeriod}
          color="success.main"
          caption={(count) => `${count} ${count === 1 ? 'pagamento' : 'pagamentos'}`}
        />
      </Paper>
      {cards.map((card) => (
        <Paper key={card.key} variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: '30px' }}>
            {card.label}
          </Typography>
          <Amount
            value={card.value}
            color={card.color}
            caption={(count) => `${count} ${count === 1 ? 'cobrança' : 'cobranças'} · ${card.hint.toLowerCase()}`}
          />
        </Paper>
      ))}
    </Box>
  );
}

interface AmountProps {
  value?: { count: number; amountCents: number };
  color: string;
  caption: (count: number) => string;
}

function Amount({ value, color, caption }: AmountProps) {
  if (!value) return <Skeleton width="60%" height={40} />;
  return (
    <>
      <Typography variant="h5" sx={{ fontWeight: 700, color, mt: 0.5 }}>
        {formatCents(value.amountCents)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {caption(value.count)}
      </Typography>
    </>
  );
}
