import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { platformApi, platformKeys, type ClosureFilter, type TenantStatus } from '@/api/platform';
import type { PlatformTenant } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { ListPagination } from '@/components/ListPagination';
import { PageHeader } from '@/components/PageHeader';
import { SearchField } from '@/components/SearchField';
import { useNotify } from '@/components/notifications/NotificationContext';
import { TableSkeletonRows } from '@/components/TableSkeletonRows';
import { formatDate } from '@/lib/format';
import { ACCESS_LABELS, CYCLE_LABELS, STATUS_LABELS } from '@/pages/settings/subscription/subscriptionText';
import { usePlans } from '@/pages/settings/subscription/useSubscription';
import { DeleteTenantDialog } from './DeleteTenantDialog';
import { useListSearchParams } from '@/lib/useListSearchParams';

const APP_BASE_DOMAIN = import.meta.env.VITE_APP_BASE_DOMAIN?.trim() || null;
const hideOnMobile = { display: { xs: 'none', md: 'table-cell' } } as const;

// Filtro de encerramento na URL (?encerramento=pedido|liberado), traduzido para o parâmetro da API.
const CLOSURE_FILTERS: { param: string; value: ClosureFilter; label: string; empty: string }[] = [
  { param: 'pedido', value: 'requested', label: 'Encerramento pedido', empty: 'Nenhuma clínica pediu o encerramento' },
  { param: 'liberado', value: 'deletable', label: 'Prontas para excluir', empty: 'Nenhuma clínica pronta para excluir' },
];

const STATUS: Record<TenantStatus, { label: string; color: 'success' | 'error' }> = {
  active: { label: 'Ativa', color: 'success' },
  suspended: { label: 'Suspensa', color: 'error' },
};

/** /plataforma/clinicas — exige platform:manage. */
export function TenantsPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const list = useListSearchParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const closureFilter = CLOSURE_FILTERS.find((item) => item.param === searchParams.get('encerramento'));
  const params = { q: list.q || undefined, closure: closureFilter?.value, page: list.page, pageSize: list.pageSize };
  // Momento de referência para "a carência já passou" (React Compiler exige render puro).
  const [now] = useState(() => Date.now());

  // Trocar o filtro volta para a primeira página.
  const setClosureFilter = (param: string) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('page');
        if (param) next.set('encerramento', param);
        else next.delete('encerramento');
        return next;
      },
      { replace: true },
    );
  const [pending, setPending] = useState<{ tenant: PlatformTenant; status: TenantStatus } | null>(null);
  const [deleting, setDeleting] = useState<PlatformTenant | null>(null);

  const plans = usePlans();
  const planName = (id: string) => plans.data?.data.find((plan) => plan.id === id)?.name ?? id;

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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2 }}>
          <SearchField
            value={list.search}
            onChange={list.setSearch}
            placeholder="Buscar por nome, subdomínio ou domínio"
            autoFocus
            sx={{ maxWidth: { sm: 420 } }}
          />
          <TextField
            select
            size="small"
            label="Encerramento"
            value={closureFilter?.param ?? ''}
            onChange={(event) => setClosureFilter(event.target.value)}
            fullWidth={false}
            sx={{ minWidth: 220 }}
            slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
          >
            <MenuItem value="">Todas as clínicas</MenuItem>
            {CLOSURE_FILTERS.map((item) => (
              <MenuItem key={item.param} value={item.param}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Box sx={{ height: 4 }}>{query.isFetching && <LinearProgress />}</Box>

        {query.error ? (
          <Box sx={{ p: 2 }}>
            <ErrorMessages error={query.error} />
          </Box>
        ) : query.data?.data.length === 0 ? (
          <EmptyState
            title={
              list.q ? 'Nenhuma clínica encontrada' : (closureFilter?.empty ?? 'Nenhuma clínica cadastrada')
            }
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
                  <TableCell>Assinatura</TableCell>
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
                {query.isPending && (
                  <TableSkeletonRows
                    columns={[undefined, hideOnMobile, undefined, undefined, hideOnMobile, hideOnMobile, hideOnMobile, undefined]}
                  />
                )}
                {query.data?.data.map((tenant) => {
                  const status = STATUS[tenant.status];
                  const deletionAt = tenant.deletionAvailableAt ? new Date(tenant.deletionAvailableAt).getTime() : null;
                  const deletable = deletionAt !== null && deletionAt <= now;
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
                        <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                          <Chip size="small" variant="outlined" label={status.label} color={status.color} />
                          {tenant.closureRequestedAt && (
                            <Chip
                              size="small"
                              color={deletable ? 'error' : 'warning'}
                              label={
                                deletable
                                  ? 'Pronta para excluir'
                                  : `Encerramento pedido em ${formatDate(tenant.closureRequestedAt)}`
                              }
                            />
                          )}
                          {tenant.closureRequestedAt && !deletable && tenant.deletionAvailableAt && (
                            <Typography variant="caption" color="text.secondary">
                              Exclusão liberada a partir de {formatDate(tenant.deletionAvailableAt)}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <SubscriptionCell subscription={tenant.subscription} planName={planName} />
                      </TableCell>
                      <TableCell align="right" sx={hideOnMobile}>
                        {tenant._count.users}
                      </TableCell>
                      <TableCell align="right" sx={hideOnMobile}>
                        {tenant._count.patients}
                      </TableCell>
                      <TableCell sx={{ ...hideOnMobile, whiteSpace: 'nowrap' }}>{formatDate(tenant.createdAt)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {/* Só clínica que pediu o encerramento, e só depois da carência. A API confere de
                            novo (409): o pedido pode ter sido cancelado com a tela aberta. */}
                        {tenant.closureRequestedAt && (
                          <Tooltip
                            title={
                              deletable || !tenant.deletionAvailableAt
                                ? ''
                                : `Liberada a partir de ${formatDate(tenant.deletionAvailableAt)}`
                            }
                          >
                            <span>
                              <Button
                                size="small"
                                color="error"
                                disabled={!deletable}
                                onClick={() => setDeleting(tenant)}
                              >
                                Excluir definitivamente
                              </Button>
                            </span>
                          </Tooltip>
                        )}
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

      {deleting && (
        <DeleteTenantDialog
          tenant={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(tenant) => {
            setDeleting(null);
            notify(`${tenant.name} foi excluída definitivamente.`);
            void queryClient.invalidateQueries({ queryKey: platformKeys.all });
          }}
        />
      )}

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

/** Plano, ciclo e situação da assinatura; só leitura e bloqueio em destaque. */
function SubscriptionCell({
  subscription,
  planName,
}: {
  subscription: PlatformTenant['subscription'];
  planName: (id: string) => string;
}) {
  if (!subscription) return <>—</>;
  const status = STATUS_LABELS[subscription.status];
  const access = ACCESS_LABELS[subscription.access];
  let detail: string | null = null;
  if (subscription.status === 'trialing' && subscription.trialEndsAt) detail = `Teste até ${formatDate(subscription.trialEndsAt)}`;
  else if (subscription.status === 'past_due' && subscription.pastDueSince) detail = `Em atraso desde ${formatDate(subscription.pastDueSince)}`;
  else if (subscription.currentPeriodEnd) detail = `Pago até ${formatDate(subscription.currentPeriodEnd)}`;

  return (
    <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {planName(subscription.planId)}
        {subscription.contractedAt && (
          <Typography component="span" variant="body2" color="text.secondary">
            {' '}
            · {CYCLE_LABELS[subscription.cycle]}
          </Typography>
        )}
      </Typography>
      <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
        <Chip size="small" variant="outlined" label={status.label} color={status.color} />
        {access && <Chip size="small" label={access.label} color={access.color} />}
      </Stack>
      {detail && (
        <Typography variant="caption" color="text.secondary">
          {detail}
          {subscription.status === 'trialing' && !subscription.contractedAt && ' · sem contrato'}
        </Typography>
      )}
    </Stack>
  );
}
