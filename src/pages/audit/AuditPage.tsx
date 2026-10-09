import { useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useSearchParams } from 'react-router';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Link,
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { auditApi, auditKeys, type AuditAction, type AuditLogEntry, type AuditLogParams } from '@/api/audit';
import { usersApi, usersKeys } from '@/api/users';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { ListPagination } from '@/components/ListPagination';
import { PageHeader } from '@/components/PageHeader';
import { PatientPicker, type PatientOption } from '@/components/PatientPicker';
import { fromDateKey } from '@/lib/dates';
import { formatDateTime } from '@/lib/format';
import { PAGE_SIZE_OPTIONS } from '@/lib/useListSearchParams';
import { AuditChanges } from './AuditChanges';
import { AUDIT_ACTIONS, actionLabel, actorName, describeChanges, detailSummary } from './auditFormat';

const hideOnMobile = { display: { xs: 'none', md: 'table-cell' } } as const;

/** Início do dia local em ISO (filtro "de") ou fim do dia local (filtro "até"). */
function dayBoundary(dateKey: string | null, end: boolean): string | undefined {
  const date = fromDateKey(dateKey);
  if (!date) return undefined;
  if (end) date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

/**
 * Trilha de auditoria da clínica (LGPD): quem leu ou alterou dados de pacientes, exportações e
 * encerramento de conta. Só leitura. Filtros na URL, exceto o paciente: o nome dele não vai
 * para o endereço (dado pessoal) e a API não devolve o nome nos registros.
 */
export function AuditPage() {
  const tenantId = useTenantId();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const actorUserId = searchParams.get('usuario') ?? '';
  const action = (searchParams.get('acao') ?? '') as AuditAction | '';
  const fromKey = searchParams.get('de') ?? '';
  const toKey = searchParams.get('ate') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSizeParam = Number(searchParams.get('pageSize'));
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam) ? pageSizeParam : 20;

  // Qualquer filtro novo volta para a primeira página.
  const update = (changes: Record<string, string | number | null>) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (!('page' in changes)) next.delete('page');
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '' || (key === 'page' && value === 1)) next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      },
      { replace: true },
    );

  const params: AuditLogParams = {
    actorUserId: actorUserId || undefined,
    action: action || undefined,
    patientId: patient?.id,
    from: dayBoundary(fromKey, false),
    to: dayBoundary(toKey, true),
    page,
    pageSize,
  };

  const query = useQuery({
    queryKey: auditKeys.list(tenantId, params),
    queryFn: () => auditApi.list(tenantId, params),
    placeholderData: keepPreviousData,
  });

  // A lista de usuários exige `users:manage`; sem ela, o filtro por usuário não aparece.
  const canListUsers = can('users:manage');
  const users = useQuery({
    queryKey: usersKeys.list(tenantId, 1, 100),
    queryFn: () => usersApi.list(tenantId, 1, 100),
    enabled: canListUsers,
  });

  const hasFilters = !!(actorUserId || action || fromKey || toKey || patient);
  const rangeInvalid = !!fromKey && !!toKey && fromKey > toKey;

  return (
    <>
      <PageHeader
        title="Auditoria"
        subtitle="Quem acessou ou alterou dados de pacientes. Os registros são permanentes e não podem ser alterados."
      />

      <Paper variant="outlined">
        <Box
          sx={{
            p: 2,
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr) auto' },
            alignItems: 'start',
          }}
        >
          {canListUsers && (
            <TextField
              select
              size="small"
              label="Usuário"
              value={actorUserId}
              onChange={(event) => update({ usuario: event.target.value })}
              slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
            >
              <MenuItem value="">Todos</MenuItem>
              {users.data?.data.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            select
            size="small"
            label="Ação"
            value={action}
            onChange={(event) => update({ acao: event.target.value })}
            slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
          >
            <MenuItem value="">Todas</MenuItem>
            {AUDIT_ACTIONS.map((item) => (
              <MenuItem key={item} value={item}>
                {actionLabel(item)}
              </MenuItem>
            ))}
          </TextField>
          <PatientPicker
            size="small"
            value={patient}
            onChange={(value) => {
              setPatient(value);
              update({});
            }}
          />
          <Stack direction="row" spacing={1}>
            <TextField
              type="date"
              size="small"
              label="De"
              value={fromKey}
              onChange={(event) => update({ de: event.target.value })}
              error={rangeInvalid}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              type="date"
              size="small"
              label="Até"
              value={toKey}
              onChange={(event) => update({ ate: event.target.value })}
              error={rangeInvalid}
              helperText={rangeInvalid ? 'Data final antes da inicial' : undefined}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>
          {hasFilters && (
            <Button
              onClick={() => {
                setPatient(null);
                update({ usuario: null, acao: null, de: null, ate: null });
              }}
            >
              Limpar filtros
            </Button>
          )}
        </Box>
        <ErrorMessages error={users.error} />
        <Box sx={{ height: 4 }}>{query.isFetching && <LinearProgress />}</Box>

        {query.error ? (
          <Box sx={{ p: 2 }}>
            <ErrorMessages error={query.error} />
          </Box>
        ) : query.data && query.data.data.length === 0 ? (
          <EmptyState
            title="Nenhum registro encontrado"
            description={hasFilters ? 'Ajuste os filtros para ver outros registros.' : undefined}
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data e hora</TableCell>
                  <TableCell>Usuário</TableCell>
                  <TableCell>Ação</TableCell>
                  <TableCell sx={hideOnMobile}>Paciente</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data?.data.map((entry) => {
                  const summary = detailSummary(entry);
                  return (
                    <TableRow key={entry.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.createdAt)}</TableCell>
                      <TableCell>{actorName(entry)}</TableCell>
                      <TableCell>
                        {actionLabel(entry.action)}
                        {summary && (
                          <Typography variant="caption" color="text.secondary" component="div">
                            {summary}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={hideOnMobile}>
                        <PatientLink entry={entry} knownPatient={patient} />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Detalhes">
                          <IconButton size="small" aria-label="Detalhes" onClick={() => setSelected(entry)}>
                            <InfoOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {query.data && query.data.meta.total > 0 && (
          <ListPagination
            meta={query.data.meta}
            onPageChange={(value) => update({ page: value })}
            onPageSizeChange={(value) => update({ pageSize: value === 20 ? null : value })}
          />
        )}
      </Paper>

      {selected && <AuditEntryDialog entry={selected} knownPatient={patient} onClose={() => setSelected(null)} />}
    </>
  );
}

/**
 * A API não devolve o nome do paciente na trilha, e buscá-lo geraria um novo registro de
 * "Visualizou o cadastro" para cada linha. Mostra o nome só quando já é conhecido (filtro).
 */
function PatientLink({ entry, knownPatient }: { entry: AuditLogEntry; knownPatient: PatientOption | null }) {
  if (!entry.patientId) return <>—</>;
  const label = knownPatient?.id === entry.patientId ? knownPatient.fullName : 'Abrir ficha';
  return (
    <Link component={RouterLink} to={`/pacientes/${entry.patientId}`} underline="hover">
      {label}
    </Link>
  );
}

function AuditEntryDialog({
  entry,
  knownPatient,
  onClose,
}: {
  entry: AuditLogEntry;
  knownPatient: PatientOption | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const changes = entry.action === 'patient.update' ? describeChanges(entry) : null;
  const summary = detailSummary(entry);

  const rows: [string, ReactNode][] = [
    ['Data e hora', formatDateTime(entry.createdAt)],
    ['Usuário', actorName(entry)],
    ['Ação', summary ? `${actionLabel(entry.action)} · ${summary}` : actionLabel(entry.action)],
    ['Paciente', <PatientLink key="patient" entry={entry} knownPatient={knownPatient} />],
    ['IP', entry.ip ?? '—'],
    ['Navegador', entry.userAgent ?? '—'],
  ];
  if (entry.entityId) rows.push(['Registro', entry.entityId]);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>Detalhes do registro</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          {rows.map(([label, value]) => (
            <Box key={label}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                {value}
              </Typography>
            </Box>
          ))}
          {changes && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Campos alterados
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <AuditChanges changes={changes} />
              </Box>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
