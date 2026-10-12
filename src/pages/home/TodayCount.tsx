import { Link as RouterLink } from 'react-router';
import { Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { useAuth } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { formatTime } from '@/lib/format';
import { isPending, useTodayAppointments } from './useTodayAppointments';

/** Quantos atendimentos há hoje, quantos já foram feitos e qual é o próximo. */
export function TodayCount() {
  const { can } = useAuth();
  const { query, now } = useTodayAppointments();
  const items = query.data ?? [];
  const done = items.filter((item) => item.status === 'completed').length;
  const pending = items.filter(isPending).length;
  const noShow = items.filter((item) => item.status === 'no_show').length;
  const next = items.find((item) => isPending(item) && new Date(item.endsAt).getTime() > now);

  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          {can('appointments:all') ? 'Atendimentos de hoje' : 'Seus atendimentos de hoje'}
        </Typography>
        <Button component={RouterLink} to="/agenda?visao=dia" size="small">
          Ver
        </Button>
      </Stack>

      {query.error ? (
        <ErrorMessages error={query.error} />
      ) : !query.data ? (
        <Skeleton variant="rounded" height={88} />
      ) : (
        <>
          <Typography sx={{ fontSize: 44, fontWeight: 700, lineHeight: 1.1 }}>{items.length}</Typography>
          <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
            <Count label="realizados" value={done} color="success.main" />
            <Count label="a atender" value={pending} color="info.main" />
            {noShow > 0 && <Count label="faltas" value={noShow} color="warning.main" />}
          </Stack>
          <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 'auto', pt: 1 }}>
            {next ? `Próximo: ${formatTime(next.scheduledAt)} · ${next.patient.fullName}` : 'Nenhum atendimento a seguir hoje'}
          </Typography>
        </>
      )}
    </Paper>
  );
}

function Count({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box>
      <Typography component="span" sx={{ fontWeight: 700, color }}>
        {value}
      </Typography>{' '}
      <Typography component="span" variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
