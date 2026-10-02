import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  List,
  ListItemButton,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { appointmentsApi, appointmentsKeys } from '@/api/appointments';
import type { Appointment } from '@/api/types';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { addDays, startOfDay } from '@/lib/dates';
import { formatTime } from '@/lib/format';
import { AppointmentDialog } from '@/pages/schedule/AppointmentDialog';
import { STATUS_COLORS, STATUS_LABELS } from '@/pages/schedule/status';

/** Atendimentos de hoje (exceto cancelados), com o próximo destacado. */
export function TodayAgenda() {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const [onlyMine, setOnlyMine] = useState(false);
  const [open, setOpen] = useState<Appointment | null>(null);
  // Momento de referência fixado ao abrir a tela (React Compiler exige render puro).
  const [now] = useState(() => Date.now());

  const today = startOfDay(new Date(now));
  const params = {
    from: today.toISOString(),
    to: new Date(addDays(today, 1).getTime() - 1).toISOString(),
    status: ['scheduled', 'confirmed', 'completed', 'no_show'] as Appointment['status'][],
  };

  const query = useQuery({
    queryKey: appointmentsKeys.range(tenantId, params),
    queryFn: () => appointmentsApi.listAll(tenantId, params),
  });

  const all = query.data ?? [];
  const mine = all.filter((item) => item.professionalId === user?.userId);
  const items = onlyMine ? mine : all;
  const next = items.find(
    (item) => (item.status === 'scheduled' || item.status === 'confirmed') && new Date(item.endsAt).getTime() > now,
  );
  const done = items.filter((item) => item.status === 'completed').length;
  const pending = items.filter((item) => item.status === 'scheduled' || item.status === 'confirmed').length;

  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            Agenda de hoje
          </Typography>
          {query.data && (
            <Typography variant="body2" color="text.secondary">
              {items.length} {items.length === 1 ? 'atendimento' : 'atendimentos'} · {done} realizados · {pending} a atender
            </Typography>
          )}
        </Box>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          {mine.length > 0 && (
            <FormControlLabel
              control={<Switch size="small" checked={onlyMine} onChange={(_, checked) => setOnlyMine(checked)} />}
              label="Só os meus"
            />
          )}
          <Button component={RouterLink} to="/agenda?visao=dia" size="small">
            Abrir agenda
          </Button>
        </Stack>
      </Stack>

      {query.error ? (
        <ErrorMessages error={query.error} />
      ) : !query.data ? (
        <Stack spacing={1}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} variant="rounded" height={52} />
          ))}
        </Stack>
      ) : items.length === 0 ? (
        <EmptyState title="Nenhum atendimento hoje" />
      ) : (
        <List disablePadding sx={{ maxHeight: 420, overflowY: 'auto' }}>
          {items.map((appointment) => {
            const isNext = appointment.id === next?.id;
            return (
              <ListItemButton
                key={appointment.id}
                onClick={() => setOpen(appointment)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  border: 1,
                  borderColor: isNext ? 'primary.main' : 'transparent',
                  bgcolor: isNext ? 'action.selected' : undefined,
                  opacity: appointment.status === 'no_show' ? 0.6 : 1,
                }}
              >
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center', width: '100%' }}>
                  <Box sx={{ width: 52, flexShrink: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatTime(appointment.scheduledAt)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(appointment.endsAt)}
                    </Typography>
                  </Box>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: isNext ? 600 : 400 }}>
                      {appointment.patient.fullName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {isNext ? 'Próximo · ' : ''}
                      {appointment.professional.name}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={STATUS_LABELS[appointment.status]}
                    color={STATUS_COLORS[appointment.status]}
                  />
                </Stack>
              </ListItemButton>
            );
          })}
        </List>
      )}

      {open && <AppointmentDialog appointment={open} onClose={() => setOpen(null)} />}
    </Paper>
  );
}
