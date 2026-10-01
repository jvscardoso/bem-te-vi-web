import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Box, Button, LinearProgress, Paper, Stack } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { billingApi, billingKeys } from '@/api/billing';
import type { Patient } from '@/api/types';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { ListPagination } from '@/components/ListPagination';
import { ChargeDialog } from '@/pages/billing/ChargeDialog';
import { ChargesTable } from '@/pages/billing/ChargesTable';

export function PatientChargesTab({ patient }: { patient: Patient }) {
  const tenantId = useTenantId();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [creating, setCreating] = useState(false);
  const params = { patientId: patient.id, page, pageSize };

  const query = useQuery({
    queryKey: billingKeys.list(tenantId, params),
    queryFn: () => billingApi.list(tenantId, params),
    placeholderData: keepPreviousData,
  });

  const newButton = can('billing:write') && (
    <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setCreating(true)}>
      Nova cobrança
    </Button>
  );

  return (
    <Stack spacing={2} sx={{ maxWidth: 960 }}>
      {query.data && query.data.meta.total > 0 && <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>{newButton}</Stack>}
      <Paper variant="outlined">
        <Box sx={{ height: 4 }}>{query.isFetching && <LinearProgress />}</Box>
        {query.error ? (
          <Box sx={{ p: 2 }}>
            <ErrorMessages error={query.error} />
          </Box>
        ) : query.data?.data.length === 0 ? (
          <EmptyState title="Nenhuma cobrança" description="Este paciente ainda não tem cobranças." action={newButton} />
        ) : (
          query.data && <ChargesTable charges={query.data.data} hidePatient />
        )}
        {query.data && query.data.meta.total > 0 && (
          <ListPagination
            meta={query.data.meta}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        )}
      </Paper>

      {creating && (
        <ChargeDialog
          draft={{ patient: { id: patient.id, fullName: patient.fullName } }}
          onClose={() => setCreating(false)}
          onSaved={(charge) => navigate(`/financeiro/cobrancas/${charge.id}`)}
        />
      )}
    </Stack>
  );
}
