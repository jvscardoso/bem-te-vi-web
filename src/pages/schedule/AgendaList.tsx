import { Box, Chip, List, ListItemButton, ListSubheader, Stack, Typography } from '@mui/material';
import type { Appointment } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { addDays, formatLongDate, isSameDay } from '@/lib/dates';
import { formatTime } from '@/lib/format';
import { ACTIVE_STATUSES, STATUS_COLORS, STATUS_LABELS } from './status';

interface AgendaListProps {
  from: Date;
  days: number;
  appointments: Appointment[];
  colorFor: (appointment: Appointment) => string;
  showProfessional: boolean;
  onAppointmentClick: (appointment: Appointment) => void;
}

/** Agenda em lista, agrupada por dia (usada em telas estreitas). */
export function AgendaList({ from, days, appointments, colorFor, showProfessional, onAppointmentClick }: AgendaListProps) {
  const groups = Array.from({ length: days }, (_, index) => addDays(from, index))
    .map((day) => ({
      day,
      items: appointments.filter((appointment) => isSameDay(new Date(appointment.scheduledAt), day)),
    }))
    .filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return <EmptyState title="Nenhum agendamento" description="Não há agendamentos neste período." />;
  }

  return (
    <List disablePadding>
      {groups.map(({ day, items }) => (
        <li key={day.toISOString()}>
          <ul style={{ padding: 0 }}>
            <ListSubheader sx={{ bgcolor: 'background.default', lineHeight: '36px' }}>
              {formatLongDate(day)}
            </ListSubheader>
            {items.map((appointment) => {
              const inactive = !ACTIVE_STATUSES.includes(appointment.status);
              return (
                <ListItemButton
                  key={appointment.id}
                  onClick={() => onAppointmentClick(appointment)}
                  sx={{ borderLeft: `3px solid ${colorFor(appointment)}`, mb: 0.5, opacity: inactive ? 0.7 : 1 }}
                >
                  <Stack direction="row" spacing={2} sx={{ width: '100%', alignItems: 'center' }}>
                    <Box sx={{ width: 48, flexShrink: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatTime(appointment.scheduledAt)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(appointment.endsAt)}
                      </Typography>
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ textDecoration: inactive ? 'line-through' : undefined }}>
                        {appointment.patient.fullName}
                      </Typography>
                      {showProfessional && (
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {appointment.professional.name}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      size="small"
                      label={STATUS_LABELS[appointment.status]}
                      color={STATUS_COLORS[appointment.status]}
                      variant="outlined"
                    />
                  </Stack>
                </ListItemButton>
              );
            })}
          </ul>
        </li>
      ))}
    </List>
  );
}
