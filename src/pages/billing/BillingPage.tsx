import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { billingApi, billingKeys, type ChargeListParams } from '@/api/billing';
import { patientsApi, patientsKeys } from '@/api/patients';
import type { ChargeStatusFilter } from '@/api/types';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { ListPagination } from '@/components/ListPagination';
import { PageHeader } from '@/components/PageHeader';
import { PatientPicker, type PatientOption } from '@/components/PatientPicker';
import { formatMonthYear } from '@/lib/dates';
import { formatCents } from '@/lib/format';
import { PAGE_SIZE_OPTIONS } from '@/lib/useListSearchParams';
import { ChargeDialog } from './ChargeDialog';
import { ChargesTable } from './ChargesTable';
import { STATUS_FILTERS } from './status';

const isStatusFilter = (value: string | null): value is ChargeStatusFilter =>
  STATUS_FILTERS.some((item) => item.value && item.value === value);

export function BillingPage() {
  const tenantId = useTenantId();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  // O filtro guarda o nome para exibir; a URL guarda só o id.
  const [patient, setPatient] = useState<PatientOption | null>(null);

  const update = (changes: Record<string, string | number | null>) =>
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

  const statusParam = params.get('situacao');
  const status = isStatusFilter(statusParam) ? statusParam : undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSizeParam = Number(params.get('pageSize'));
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam) ? pageSizeParam : 20;

  const listParams: ChargeListParams = {
    status,
    patientId: params.get('paciente') ?? undefined,
    from: params.get('de') ?? undefined,
    to: params.get('ate') ?? undefined,
    page,
    pageSize,
  };

  const query = useQuery({
    queryKey: billingKeys.list(tenantId, listParams),
    queryFn: () => billingApi.list(tenantId, listParams),
    placeholderData: keepPreviousData,
  });

  // Filtro vindo da URL (reload, link): busca o nome para exibir no campo.
  const filteredPatient = useQuery({
    queryKey: patientsKeys.detail(tenantId, listParams.patientId ?? ''),
    queryFn: () => patientsApi.get(tenantId, listParams.patientId!),
    enabled: !!listParams.patientId && !patient,
  });
  const patientValue = patient ?? (listParams.patientId && filteredPatient.data ? filteredPatient.data : null);

  const filtered = !!(status || listParams.patientId || listParams.from || listParams.to);

  return (
    <>
      <PageHeader
        title="Financeiro"
        actions={
          can('billing:write') && (
            <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setCreating(true)}>
              Nova cobrança
            </Button>
          )
        }
      />

      <SummaryCards />

      <Paper variant="outlined">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ p: 2 }}>
          <TextField
            select
            size="small"
            label="Situação"
            value={status ?? ''}
            onChange={(event) => update({ situacao: event.target.value, page: 1 })}
            sx={{ minWidth: 160 }}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          >
            {STATUS_FILTERS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ minWidth: { md: 280 }, flexGrow: { md: 1 } }}>
            <PatientPicker
              size="small"
              label="Paciente"
              value={patientValue}
              onChange={(value) => {
                setPatient(value);
                update({ paciente: value?.id ?? null, page: 1 });
              }}
            />
          </Box>
          <TextField
            size="small"
            type="date"
            label="Vencimento de"
            value={listParams.from ?? ''}
            onChange={(event) => update({ de: event.target.value, page: 1 })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            size="small"
            type="date"
            label="até"
            value={listParams.to ?? ''}
            onChange={(event) => update({ ate: event.target.value, page: 1 })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {filtered && (
            <Button
              size="small"
              onClick={() => {
                setPatient(null);
                setParams({}, { replace: true });
              }}
            >
              Limpar filtros
            </Button>
          )}
        </Stack>
        <Box sx={{ height: 4 }}>{query.isFetching && <LinearProgress />}</Box>

        {query.error ? (
          <Box sx={{ p: 2 }}>
            <ErrorMessages error={query.error} />
          </Box>
        ) : query.data?.data.length === 0 ? (
          <EmptyState
            title={filtered ? 'Nenhuma cobrança encontrada' : 'Nenhuma cobrança registrada'}
            description={filtered ? 'Ajuste os filtros para ver outras cobranças.' : undefined}
          />
        ) : (
          query.data && <ChargesTable charges={query.data.data} />
        )}

        {query.data && query.data.meta.total > 0 && (
          <ListPagination
            meta={query.data.meta}
            onPageChange={(value) => update({ page: value })}
            onPageSizeChange={(value) => update({ pageSize: value === 20 ? null : value, page: 1 })}
          />
        )}
      </Paper>

      {creating && (
        <ChargeDialog onClose={() => setCreating(false)} onSaved={(charge) => navigate(`/financeiro/cobrancas/${charge.id}`)} />
      )}
    </>
  );
}

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, from: start.toISOString(), to: new Date(end.getTime() - 1).toISOString() };
}

/** Cards do resumo. Pendente/atrasado/cancelado são o estado atual; recebido é do mês escolhido. */
function SummaryCards() {
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
