import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { platformApi, platformKeys, type TenantStatus } from '@/api/platform';
import type { PlatformTenant } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { ListPagination } from '@/components/ListPagination';
import { PageHeader } from '@/components/PageHeader';
import { SearchField } from '@/components/SearchField';
import { useNotify } from '@/components/notifications/NotificationContext';
import { formatDate } from '@/lib/format';
import { useListSearchParams } from '@/lib/useListSearchParams';

const APP_BASE_DOMAIN = import.meta.env.VITE_APP_BASE_DOMAIN?.trim() || null;
const hideOnMobile = { display: { xs: 'none', md: 'table-cell' } } as const;

const STATUS: Record<TenantStatus, { label: string; color: 'success' | 'error' }> = {
  active: { label: 'Ativa', color: 'success' },
  suspended: { label: 'Suspensa', color: 'error' },
};

/** /plataforma/clinicas — exige platform:manage. */
export function TenantsPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const list = useListSearchParams();
  const params = { q: list.q || undefined, page: list.page, pageSize: list.pageSize };
  const [pending, setPending] = useState<{ tenant: PlatformTenant; status: TenantStatus } | null>(null);

  const query = useQuery({
    queryKey: platformKeys.list(params),
    queryFn: () => platformApi.tenants(params),
    placeholderData: keepPreviousData,
  });

  const changeStatus = useMutation({
    mutationFn: ({ tenant, status }: { tenant: PlatformTenant; status: TenantStatus }) =>
      platformApi.setStatus(tenant.id, status),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: platformKeys.all });
      notify(result.status === 'suspended' ? `${result.name} foi suspensa.` : `${result.name} foi reativada.`);
      setPending(null);
    },
  });

  const suspending = pending?.status === 'suspended';

  return (
    <>
      <PageHeader
        title="Clínicas"
        subtitle="Clínicas cadastradas na plataforma. O backoffice não tem acesso a pacientes, agenda ou financeiro."
      />

      <Paper variant="outlined">
        <Stack sx={{ p: 2 }}>
          <SearchField
            value={list.search}
            onChange={list.setSearch}
            placeholder="Buscar por nome, subdomínio ou domínio"
            autoFocus
            sx={{ maxWidth: { sm: 420 } }}
          />
        </Stack>
        <Box sx={{ height: 4 }}>{query.isFetching && <LinearProgress />}</Box>

        {query.error ? (
          <Box sx={{ p: 2 }}>
            <ErrorMessages error={query.error} />
          </Box>
        ) : query.data?.data.length === 0 ? (
          <EmptyState
            title={list.q ? 'Nenhuma clínica encontrada' : 'Nenhuma clínica cadastrada'}
            description={list.q ? `Nenhum resultado para "${list.q}".` : undefined}
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Clínica</TableCell>
                  <TableCell sx={hideOnMobile}>Endereço</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell align="right" sx={hideOnMobile}>
                    Usuários
                  </TableCell>
                  <TableCell align="right" sx={hideOnMobile}>
                    Pacientes
                  </TableCell>
                  <TableCell sx={hideOnMobile}>Criada em</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data?.data.map((tenant) => {
                  const status = STATUS[tenant.status];
                  return (
                    <TableRow key={tenant.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{tenant.name}</TableCell>
                      <TableCell sx={hideOnMobile}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {APP_BASE_DOMAIN ? `${tenant.subdomain}.${APP_BASE_DOMAIN}` : tenant.subdomain}
                        </Typography>
                        {tenant.customDomain && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {tenant.customDomain}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={status.label} color={status.color} />
                      </TableCell>
                      <TableCell align="right" sx={hideOnMobile}>
                        {tenant._count.users}
                      </TableCell>
                      <TableCell align="right" sx={hideOnMobile}>
                        {tenant._count.patients}
                      </TableCell>
                      <TableCell sx={{ ...hideOnMobile, whiteSpace: 'nowrap' }}>{formatDate(tenant.createdAt)}</TableCell>
                      <TableCell align="right">
                        {tenant.status === 'active' ? (
                          <Button size="small" color="error" onClick={() => setPending({ tenant, status: 'suspended' })}>
                            Suspender
                          </Button>
                        ) : (
                          <Button size="small" onClick={() => setPending({ tenant, status: 'active' })}>
                            Reativar
                          </Button>
                        )}
                      </TableCell>
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

      <ConfirmDialog
        open={pending !== null}
        title={suspending ? `Suspender ${pending?.tenant.name}?` : `Reativar ${pending?.tenant.name}?`}
        description={
          suspending ? (
            <>
              O efeito é imediato: toda a equipe da clínica é desconectada e não consegue mais entrar, e o endereço da
              clínica deixa de exibir a marca. Os dados são mantidos e a clínica pode ser reativada depois.
            </>
          ) : (
            'A equipe da clínica volta a conseguir entrar e o endereço da clínica volta a exibir a marca.'
          )
        }
        confirmLabel={suspending ? 'Suspender' : 'Reativar'}
        confirmColor={suspending ? 'error' : 'primary'}
        loading={changeStatus.isPending}
        error={changeStatus.error}
        onConfirm={() => pending && changeStatus.mutate(pending)}
        onClose={() => {
          setPending(null);
          changeStatus.reset();
        }}
      />
    </>
  );
}
