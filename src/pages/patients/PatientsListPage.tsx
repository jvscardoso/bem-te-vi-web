import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router';
import {
  Box,
  Button,
  LinearProgress,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined';
import RestoreFromTrashOutlined from '@mui/icons-material/RestoreFromTrashOutlined';
import { patientsApi, patientsKeys } from '@/api/patients';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { ListPagination } from '@/components/ListPagination';
import { PageHeader } from '@/components/PageHeader';
import { SearchField } from '@/components/SearchField';
import { ageFromBirthDate, formatCpf, formatDate } from '@/lib/format';
import { useListSearchParams } from '@/lib/useListSearchParams';

const hideOnMobile = { display: { xs: 'none', md: 'table-cell' } } as const;

export function PatientsListPage() {
  const tenantId = useTenantId();
  const { can } = useAuth();
  const navigate = useNavigate();
  const list = useListSearchParams();
  const params = { q: list.q || undefined, page: list.page, pageSize: list.pageSize };

  const query = useQuery({
    queryKey: patientsKeys.list(tenantId, params),
    queryFn: () => patientsApi.list(tenantId, params),
    placeholderData: keepPreviousData,
  });

  const canWrite = can('patients:write');

  return (
    <>
      <PageHeader
        title="Pacientes"
        actions={
          canWrite && (
            <>
              <Button component={RouterLink} to="/pacientes/removidos" startIcon={<RestoreFromTrashOutlined />}>
                Removidos
              </Button>
              <Button
                component={RouterLink}
                to="/pacientes/novo"
                variant="contained"
                startIcon={<PersonAddAlt1Outlined />}
              >
                Novo paciente
              </Button>
            </>
          )
        }
      />

      <Paper variant="outlined">
        <Stack sx={{ p: 2 }}>
          <SearchField
            value={list.search}
            onChange={list.setSearch}
            placeholder="Buscar por nome ou CPF"
            autoFocus
            sx={{ maxWidth: { sm: 400 } }}
          />
        </Stack>
        <Box sx={{ height: 4 }}>{query.isFetching && <LinearProgress />}</Box>

        {query.error ? (
          <Box sx={{ p: 2 }}>
            <ErrorMessages error={query.error} />
          </Box>
        ) : query.data && query.data.data.length === 0 ? (
          list.q ? (
            <EmptyState title="Nenhum paciente encontrado" description={`Nenhum resultado para "${list.q}".`} />
          ) : (
            <EmptyState
              title="Nenhum paciente cadastrado"
              description={canWrite ? 'Cadastre o primeiro paciente da clínica.' : undefined}
              action={
                canWrite && (
                  <Button component={RouterLink} to="/pacientes/novo" variant="contained">
                    Novo paciente
                  </Button>
                )
              }
            />
          )
        ) : (
          <TableContainer>
            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>CPF</TableCell>
                  <TableCell sx={hideOnMobile}>Nascimento</TableCell>
                  <TableCell sx={hideOnMobile}>Telefone</TableCell>
                  <TableCell sx={hideOnMobile}>Email</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data?.data.map((patient) => {
                  const age = ageFromBirthDate(patient.birthDate);
                  return (
                    <TableRow
                      key={patient.id}
                      hover
                      onClick={() => navigate(`/pacientes/${patient.id}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`/pacientes/${patient.id}`}
                          underline="hover"
                          color="inherit"
                          sx={{ fontWeight: 500 }}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {patient.fullName}
                        </Link>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatCpf(patient.cpf) || '—'}</TableCell>
                      <TableCell sx={{ ...hideOnMobile, whiteSpace: 'nowrap' }}>
                        {patient.birthDate ? `${formatDate(patient.birthDate)} (${age} anos)` : '—'}
                      </TableCell>
                      <TableCell sx={{ ...hideOnMobile, whiteSpace: 'nowrap' }}>{patient.phone || '—'}</TableCell>
                      <TableCell sx={hideOnMobile}>{patient.email || '—'}</TableCell>
                    </TableRow>
                  );
                })}
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
