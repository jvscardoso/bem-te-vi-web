import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router';
import {
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { patientsApi, patientsKeys } from '@/api/patients';
import { useTenantId } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { ListPagination } from '@/components/ListPagination';
import { PageHeader } from '@/components/PageHeader';
import { SearchField } from '@/components/SearchField';
import { useNotify } from '@/components/notifications/NotificationContext';
import { formatCpf, formatDateTime } from '@/lib/format';
import { useListSearchParams } from '@/lib/useListSearchParams';

export function RemovedPatientsPage() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotify();
  const list = useListSearchParams();
  const params = { q: list.q || undefined, page: list.page, pageSize: list.pageSize };

  const query = useQuery({
    queryKey: patientsKeys.removed(tenantId, params),
    queryFn: () => patientsApi.removed(tenantId, params),
    placeholderData: keepPreviousData,
  });

  const restore = useMutation({
    mutationFn: (id: string) => patientsApi.restore(tenantId, id),
    onSuccess: (patient) => {
      queryClient.setQueryData(patientsKeys.detail(tenantId, patient.id), patient);
      void queryClient.invalidateQueries({ queryKey: patientsKeys.all(tenantId) });
      notify(`${patient.fullName} foi restaurado(a).`);
      navigate(`/pacientes/${patient.id}`);
    },
  });

  return (
    <>
      <PageHeader
        title="Pacientes removidos"
        subtitle="Pacientes removidos mantêm dados, anamneses e histórico, e podem ser restaurados."
        actions={
          <Button component={RouterLink} to="/pacientes" startIcon={<ArrowBack />}>
            Pacientes
          </Button>
        }
      />

      <Paper variant="outlined">
        <Stack sx={{ p: 2 }}>
          <SearchField
            value={list.search}
            onChange={list.setSearch}
            placeholder="Buscar por nome ou CPF"
            sx={{ maxWidth: { sm: 400 } }}
          />
        </Stack>
        <Box sx={{ height: 4 }}>{query.isFetching && <LinearProgress />}</Box>

        {restore.error && (
          <Box sx={{ px: 2, pb: 2 }}>
            <ErrorMessages error={restore.error} />
          </Box>
        )}

        {query.error ? (
          <Box sx={{ p: 2 }}>
            <ErrorMessages error={query.error} />
          </Box>
        ) : query.data && query.data.data.length === 0 ? (
          <EmptyState
            title={list.q ? 'Nenhum paciente encontrado' : 'Nenhum paciente removido'}
            description={list.q ? `Nenhum resultado para "${list.q}".` : undefined}
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>CPF</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Removido em</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data?.data.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell sx={{ fontWeight: 500 }}>{patient.fullName}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatCpf(patient.cpf) || '—'}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, whiteSpace: 'nowrap' }}>
                      {formatDateTime(patient.deletedAt)}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => restore.mutate(patient.id)}
                        loading={restore.isPending && restore.variables === patient.id}
                        disabled={restore.isPending && restore.variables !== patient.id}
                      >
                        Restaurar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {query.data && query.data.meta.total > 0 && (
          <ListPagination meta={query.data.meta} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />
        )}
      </Paper>
    </>
  );
}
