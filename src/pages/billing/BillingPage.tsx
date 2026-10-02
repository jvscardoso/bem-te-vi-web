import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Box,
  Button,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { billingApi, billingKeys, type ChargeListParams } from '@/api/billing';
import { patientsApi, patientsKeys } from '@/api/patients';
import type { ChargeStatusFilter } from '@/api/types';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { ListPagination } from '@/components/ListPagination';
import { PageHeader } from '@/components/PageHeader';
import { PatientPicker, type PatientOption } from '@/components/PatientPicker';
import { PAGE_SIZE_OPTIONS } from '@/lib/useListSearchParams';
import { ChargeDialog } from './ChargeDialog';
import { ChargesTable } from './ChargesTable';
import { STATUS_FILTERS } from './status';
import { SummaryCards } from './SummaryCards';

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
