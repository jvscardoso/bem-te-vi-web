import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Box, Button, Divider, Link, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { auditApi, type AuditLogEntry } from '@/api/audit';
import type { Patient } from '@/api/types';
import { useTenantId } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { formatDateTime } from '@/lib/format';
import { AuditChanges } from '@/pages/audit/AuditChanges';
import { actionLabel, actorName, describeChanges, detailSummary } from '@/pages/audit/auditFormat';

const PAGE_SIZE = 20;

/**
 * "Quem acessou os dados deste paciente?" (LGPD). Só com `audit:read`. Abrir a ficha já
 * gera um registro de "Visualizou o cadastro", então o próprio acesso aparece no topo.
 */
export function PatientAuditTab({ patient }: { patient: Patient }) {
  const tenantId = useTenantId();

  const query = useInfiniteQuery({
    queryKey: ['audit-logs', tenantId, 'patient', patient.id],
    queryFn: ({ pageParam }) =>
      auditApi.list(tenantId, { patientId: patient.id, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });

  if (query.error) return <ErrorMessages error={query.error} />;
  if (!query.data) return <Skeleton variant="rounded" height={240} />;

  const entries = query.data.pages.flatMap((page) => page.data);
  const total = query.data.pages[0]?.meta.total ?? 0;

  if (entries.length === 0) return <EmptyState title="Nenhum registro de acesso" />;

  return (
    <Paper variant="outlined">
      <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
        {total} registro(s), do mais recente para o mais antigo. Inclui leituras, alterações e exportações feitas por
        qualquer usuário.
      </Typography>
      <Divider />
      <Stack divider={<Divider />}>
        {entries.map((entry) => (
          <AuditItem key={entry.id} entry={entry} />
        ))}
      </Stack>
      {query.hasNextPage && (
        <>
          <Divider />
          <Box sx={{ p: 1.5, textAlign: 'center' }}>
            <Button onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>
              Carregar mais
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
}

function AuditItem({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const changes = entry.action === 'patient.update' ? describeChanges(entry) : null;
  const summary = detailSummary(entry);

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 0.25, sm: 1 }}
        sx={{ alignItems: { sm: 'baseline' } }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {actorName(entry)}
        </Typography>
        <Typography variant="body2">
          {actionLabel(entry.action)}
          {summary && (
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {' '}
              · {summary}
            </Box>
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: { sm: 'auto !important' }, whiteSpace: 'nowrap' }}>
          {formatDateTime(entry.createdAt)}
        </Typography>
      </Stack>
      {changes && changes.length > 0 && (
        <Box sx={{ mt: 0.5 }}>
          <Link component="button" type="button" variant="body2" onClick={() => setOpen((value) => !value)}>
            {open ? 'Ocultar alterações' : `Ver alterações (${changes.length})`}
          </Link>
          {open && (
            <Box sx={{ mt: 1, pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>
              <AuditChanges changes={changes} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
