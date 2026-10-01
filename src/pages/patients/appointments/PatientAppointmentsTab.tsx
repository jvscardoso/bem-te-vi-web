import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import EventOutlined from '@mui/icons-material/EventOutlined';
import { appointmentsApi, appointmentsKeys } from '@/api/appointments';
import type { Appointment, Patient } from '@/api/types';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { formatDateTime, formatTime } from '@/lib/format';
import { AppointmentDialog } from '@/pages/schedule/AppointmentDialog';
import { STATUS_COLORS, STATUS_LABELS } from '@/pages/schedule/status';

type DialogState = { appointment: Appointment } | { create: true } | null;

export function PatientAppointmentsTab({ patient }: { patient: Patient }) {
  const tenantId = useTenantId();
  const { can } = useAuth();
  const [dialog, setDialog] = useState<DialogState>(null);
  // Momento de referência para separar próximos e anteriores (fixado ao abrir a aba).
  const [now] = useState(() => Date.now());
  const params = { patientId: patient.id };

  // Histórico completo do paciente (a API ordena do mais antigo; aqui separamos
  // próximos e anteriores e mostramos os anteriores do mais recente para trás).
  const query = useQuery({
    queryKey: appointmentsKeys.list(tenantId, params),
    queryFn: () => appointmentsApi.listAll(tenantId, params),
  });

  const newButton = can('appointments:write') && (
    <Button variant="contained" startIcon={<EventOutlined />} onClick={() => setDialog({ create: true })}>
      Novo agendamento
    </Button>
  );

  const dialogElement = dialog && (
    <AppointmentDialog
      appointment={'appointment' in dialog ? dialog.appointment : undefined}
      draft={'create' in dialog ? { patient: { id: patient.id, fullName: patient.fullName } } : undefined}
      onClose={() => setDialog(null)}
    />
  );

  if (query.error) return <ErrorMessages error={query.error} />;
  if (!query.data) return <Skeleton variant="rounded" height={160} />;

  if (query.data.length === 0) {
    return (
      <Paper variant="outlined">
        <EmptyState title="Nenhum agendamento" description="Este paciente ainda não tem agendamentos." action={newButton} />
        {dialogElement}
      </Paper>
    );
  }

  const upcoming = query.data.filter((item) => new Date(item.endsAt).getTime() >= now);
  const past = query.data.filter((item) => new Date(item.endsAt).getTime() < now).reverse();

  return (
    <Stack spacing={3} sx={{ maxWidth: 960 }}>
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        {newButton}
      </Stack>
      <AppointmentsTable
        title="Próximos"
        empty="Nenhum agendamento futuro."
        items={upcoming}
        onOpen={(appointment) => setDialog({ appointment })}
      />
      <AppointmentsTable
        title="Anteriores"
        empty="Nenhum agendamento anterior."
        items={past}
        onOpen={(appointment) => setDialog({ appointment })}
      />
      {dialogElement}
    </Stack>
  );
}

interface AppointmentsTableProps {
  title: string;
  empty: string;
  items: Appointment[];
  onOpen: (appointment: Appointment) => void;
}

function AppointmentsTable({ title, empty, items, onOpen }: AppointmentsTableProps) {
  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      <Paper variant="outlined">
        {items.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            {empty}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data e hora</TableCell>
                  <TableCell>Profissional</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((appointment) => (
                  <TableRow key={appointment.id} hover onClick={() => onOpen(appointment)} sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(appointment.scheduledAt)}–{formatTime(appointment.endsAt)}
                    </TableCell>
                    <TableCell>{appointment.professional.name}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={STATUS_LABELS[appointment.status]}
                        color={STATUS_COLORS[appointment.status]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
