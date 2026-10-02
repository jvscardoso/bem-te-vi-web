import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import { Box, Button, List, ListItemButton, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { billingApi, billingKeys } from '@/api/billing';
import { useTenantId } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { formatCents, formatDate } from '@/lib/format';

const PARAMS = { status: 'overdue' as const, page: 1, pageSize: 5 };

/** As cobranças vencidas mais antigas, com atalho para a lista completa. */
export function OverdueCharges() {
  const tenantId = useTenantId();
  const query = useQuery({
    queryKey: billingKeys.list(tenantId, PARAMS),
    queryFn: () => billingApi.list(tenantId, PARAMS),
  });

  const total = query.data?.meta.total ?? 0;

  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          Cobranças em atraso
        </Typography>
        {total > 0 && (
          <Button component={RouterLink} to="/financeiro?situacao=overdue" size="small">
            Ver todas ({total})
          </Button>
        )}
      </Stack>

      {query.error ? (
        <ErrorMessages error={query.error} />
      ) : !query.data ? (
        <Skeleton variant="rounded" height={120} />
      ) : query.data.data.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          Nenhuma cobrança em atraso.
        </Typography>
      ) : (
        <List disablePadding>
          {query.data.data.map((charge) => (
            <ListItemButton
              key={charge.id}
              component={RouterLink}
              to={`/financeiro/cobrancas/${charge.id}`}
              sx={{ borderRadius: 1, px: 1 }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                  {charge.patient.fullName}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {charge.description} · venceu em {formatDate(charge.dueDate)}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main', whiteSpace: 'nowrap', ml: 2 }}>
                {formatCents(charge.balanceCents)}
              </Typography>
            </ListItemButton>
          ))}
        </List>
      )}
    </Paper>
  );
}
