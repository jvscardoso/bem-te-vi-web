import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { appointmentsApi, appointmentsKeys, type AppointmentUpdate } from '@/api/appointments';
import type { Appointment, AppointmentStatus } from '@/api/types';
import { usersApi, usersKeys } from '@/api/users';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PatientPicker, type PatientOption } from '@/components/PatientPicker';
import { useNotify } from '@/components/notifications/NotificationContext';
import { addMinutes, combineDateTime, formatDayMonth, toDateKey, toTimeKey } from '@/lib/dates';
import { formatDateTime } from '@/lib/format';
import { ChargeDialog } from '@/pages/billing/ChargeDialog';
import { isFinalStatus, STATUS_COLORS, STATUS_LABELS, STATUS_TRANSITIONS } from './status';

export interface AppointmentDraft {
  start?: Date;
  professionalId?: string;
  patient?: PatientOption;
}

interface AppointmentDialogProps {
  /** Agendamento existente (edição) ou rascunho (criação). */
  appointment?: Appointment;
  draft?: AppointmentDraft;
  onClose: () => void;
}

interface FormValues {
  patient: PatientOption | null;
  professionalId: string;
  date: string;
  start: string;
  end: string;
  notes: string;
}

const STATUS_ACTION_LABELS: Partial<Record<AppointmentStatus, string>> = {
  confirmed: 'Confirmar',
  completed: 'Marcar como realizado',
  no_show: 'Marcar falta',
  cancelled: 'Cancelar agendamento',
};

function initialValues(appointment?: Appointment, draft?: AppointmentDraft): FormValues {
  if (appointment) {
    const start = new Date(appointment.scheduledAt);
    return {
      patient: appointment.patient,
      professionalId: appointment.professionalId,
      date: toDateKey(start),
      start: toTimeKey(start),
      end: toTimeKey(new Date(appointment.endsAt)),
      notes: appointment.notes ?? '',
    };
  }
  const start = draft?.start ?? new Date();
  return {
    patient: draft?.patient ?? null,
    professionalId: draft?.professionalId ?? '',
    date: toDateKey(start),
    start: draft?.start ? toTimeKey(start) : '',
    end: '',
    notes: '',
  };
}

export function AppointmentDialog({ appointment, draft, onClose }: AppointmentDialogProps) {
  const tenantId = useTenantId();
  const { can, user } = useAuth();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const theme = useTheme();
  // Sem appointments:all, só a própria agenda: o profissional é sempre o próprio usuário.
  const seesAllAgendas = can('appointments:all');
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [endEdited, setEndEdited] = useState(!!appointment);
  const [pendingStatus, setPendingStatus] = useState<AppointmentStatus | null>(null);
  const [chargeOpen, setChargeOpen] = useState(false);

  const canWrite = can('appointments:write');
  const isFinal = appointment ? isFinalStatus(appointment.status) : false;
  // Em status final, só as observações podem mudar.
  const lockSchedule = !canWrite || isFinal;

  const professionals = useQuery({
    queryKey: usersKeys.professionals(tenantId),
    queryFn: () => usersApi.professionals(tenantId),
  });

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { dirtyFields },
  } = useForm<FormValues>({
    defaultValues: initialValues(
      appointment,
      seesAllAgendas ? draft : { ...draft, professionalId: user?.userId },
    ),
  });

  const [professionalId, startTime, date] = useWatch({ control, name: ['professionalId', 'start', 'date'] });
  const professional = professionals.data?.find((item) => item.id === professionalId);

  // Remarcação: mudar só o início mantém a duração (igual à API).
  const shiftEnd = (start: string) => {
    if (appointment) {
      if (dirtyFields.end) return;
      const duration = new Date(appointment.endsAt).getTime() - new Date(appointment.scheduledAt).getTime();
      const startDate = combineDateTime(getValues('date'), start);
      if (startDate) setValue('end', toTimeKey(new Date(startDate.getTime() + duration)));
    }
  };

  // Criação sem fim informado: a API usa início + duração do profissional; mostramos a previsão.
  const startDate = startTime ? combineDateTime(date, startTime) : null;
  const predictedEnd =
    !appointment && !endEdited && startDate && professional
      ? toTimeKey(addMinutes(startDate, professional.effectiveAppointmentDurationMinutes))
      : null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: appointmentsKeys.all(tenantId) });

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const scheduledAt = combineDateTime(values.date, values.start)!.toISOString();
      const endsAt = values.end ? combineDateTime(values.date, values.end)!.toISOString() : undefined;
      const notes = values.notes.trim() || null;

      if (!appointment) {
        return appointmentsApi.create(tenantId, {
          patientId: values.patient!.id,
          professionalId: values.professionalId,
          scheduledAt,
          // Fim não editado: a API calcula pela duração do profissional.
          ...(endEdited && endsAt && { endsAt }),
          ...(notes && { notes }),
        });
      }

      // Envia só o que mudou (em status final, a API recusa mudança de horário).
      const update: AppointmentUpdate = {};
      if (dirtyFields.patient) update.patientId = values.patient!.id;
      if (dirtyFields.professionalId) update.professionalId = values.professionalId;
      if (dirtyFields.date || dirtyFields.start) update.scheduledAt = scheduledAt;
      if (dirtyFields.date || dirtyFields.end) update.endsAt = endsAt;
      if (dirtyFields.notes) update.notes = notes;
      return appointmentsApi.update(tenantId, appointment.id, update);
    },
    onSuccess: () => {
      void invalidate();
      notify(appointment ? 'Agendamento atualizado.' : 'Agendamento criado.');
      onClose();
    },
  });

  const changeStatus = useMutation({
    // Cancelar é o DELETE da API; as demais transições são PATCH de status.
    mutationFn: async (status: AppointmentStatus) => {
      if (status === 'cancelled') await appointmentsApi.cancel(tenantId, appointment!.id);
      else await appointmentsApi.update(tenantId, appointment!.id, { status });
    },
    onSuccess: (_, status) => {
      void invalidate();
      notify(`Agendamento ${STATUS_LABELS[status].toLowerCase()}.`);
      setPendingStatus(null);
      onClose();
    },
  });

  const validateEnd = (end: string) => {
    if (!end) return appointment ? 'Informe o fim' : true;
    const startDate = combineDateTime(getValues('date'), getValues('start'));
    const endDate = combineDateTime(getValues('date'), end);
    if (!endDate) return 'Horário inválido';
    return !startDate || endDate > startDate || 'O fim deve ser depois do início';
  };

  const transitions = appointment && canWrite ? STATUS_TRANSITIONS[appointment.status] : [];
  // Cobrança a partir do agendamento: já vem com paciente e vínculo preenchidos.
  const canCharge = !!appointment && appointment.status !== 'cancelled' && can('billing:write');
  const busy = save.isPending || changeStatus.isPending;
  const title = appointment ? 'Agendamento' : 'Novo agendamento';

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {title}
        {appointment && (
          <Chip size="small" label={STATUS_LABELS[appointment.status]} color={STATUS_COLORS[appointment.status]} />
        )}
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} component="form" id="appointment-form" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
          {isFinal && (
            <Alert severity="info">
              Agendamento {STATUS_LABELS[appointment!.status].toLowerCase()}: só as observações podem ser alteradas.
            </Alert>
          )}

          <Controller
            name="patient"
            control={control}
            rules={{ validate: (value) => !!value || 'Selecione o paciente' }}
            render={({ field, fieldState }) => (
              <PatientPicker
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                inputRef={field.ref}
                disabled={lockSchedule}
                error={!!fieldState.error}
                helperText={
                  fieldState.error?.message ??
                  (appointment && can('patients:read') && (
                    <Link component={RouterLink} to={`/pacientes/${appointment.patientId}`}>
                      Abrir ficha do paciente
                    </Link>
                  ))
                }
              />
            )}
          />

          {seesAllAgendas ? (
            <Controller
              name="professionalId"
              control={control}
              rules={{ required: 'Selecione o profissional' }}
              render={({ field, fieldState }) => (
                <TextField
                  select
                  label="Profissional"
                  {...field}
                  inputRef={field.ref}
                  disabled={lockSchedule}
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ??
                    (professional && `Duração padrão: ${professional.effectiveAppointmentDurationMinutes} min`)
                  }
                >
                  {/* Profissional desativado continua aparecendo nos agendamentos antigos. */}
                  {appointment && !professionals.data?.some((item) => item.id === appointment.professionalId) && (
                    <MenuItem value={appointment.professionalId}>{appointment.professional.name}</MenuItem>
                  )}
                  {professionals.data?.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Na sua agenda
              {professional && ` · duração padrão de ${professional.effectiveAppointmentDurationMinutes} min`}
            </Typography>
          )}

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', sm: '2fr 1fr 1fr' } }}>
            <Controller
              name="date"
              control={control}
              rules={{ required: 'Informe a data' }}
              render={({ field, fieldState }) => (
                <TextField
                  label="Data"
                  type="date"
                  sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
                  {...field}
                  inputRef={field.ref}
                  disabled={lockSchedule}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              )}
            />
            <Controller
              name="start"
              control={control}
              rules={{ required: 'Informe o início' }}
              render={({ field, fieldState }) => (
                <TextField
                  label="Início"
                  type="time"
                  {...field}
                  inputRef={field.ref}
                  onChange={(event) => {
                    field.onChange(event);
                    shiftEnd(event.target.value);
                  }}
                  disabled={lockSchedule}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
                />
              )}
            />
            <Controller
              name="end"
              control={control}
              rules={{ validate: validateEnd }}
              render={({ field, fieldState }) => (
                <TextField
                  label="Fim"
                  type="time"
                  {...field}
                  inputRef={field.ref}
                  onChange={(event) => {
                    setEndEdited(true);
                    field.onChange(event);
                  }}
                  disabled={lockSchedule}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? (predictedEnd ? `Automático: ${predictedEnd}` : undefined)}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
                />
              )}
            />
          </Box>

          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField
                label="Observações"
                multiline
                minRows={2}
                {...field}
                inputRef={field.ref}
                disabled={!canWrite}
              />
            )}
          />

          {appointment && (
            <Typography variant="caption" color="text.secondary">
              Criado em {formatDateTime(appointment.createdAt)}
              {appointment.updatedAt !== appointment.createdAt && ` · atualizado em ${formatDateTime(appointment.updatedAt)}`}
            </Typography>
          )}

        </Stack>
      </DialogContent>

      {/* Fora da área rolável, para o erro (ex.: conflito de horário) ficar sempre visível. */}
      {(save.error || (changeStatus.error && !pendingStatus)) && (
        <Box sx={{ px: 3, pt: 2 }}>
          <ErrorMessages error={save.error ?? changeStatus.error} />
        </Box>
      )}

      <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
        {(transitions.length > 0 || canCharge) && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mr: 'auto' }}>
            {canCharge && (
              <Button size="small" variant="outlined" disabled={busy} onClick={() => setChargeOpen(true)}>
                Gerar cobrança
              </Button>
            )}
            {transitions.map((status) => (
              <Button
                key={status}
                size="small"
                variant="outlined"
                color={status === 'cancelled' ? 'error' : status === 'no_show' ? 'warning' : 'primary'}
                disabled={busy}
                onClick={() => (status === 'confirmed' ? changeStatus.mutate(status) : setPendingStatus(status))}
              >
                {STATUS_ACTION_LABELS[status]}
              </Button>
            ))}
          </Stack>
        )}
        <Button onClick={onClose} disabled={busy}>
          Fechar
        </Button>
        {canWrite && (
          <Button type="submit" form="appointment-form" variant="contained" loading={save.isPending} disabled={busy}>
            {appointment ? 'Salvar' : 'Agendar'}
          </Button>
        )}
      </DialogActions>

      {chargeOpen && appointment && (
        <ChargeDialog
          draft={{
            patient: appointment.patient,
            appointmentId: appointment.id,
            description: `Consulta ${formatDayMonth(new Date(appointment.scheduledAt))}`,
          }}
          onClose={() => setChargeOpen(false)}
        />
      )}

      <ConfirmDialog
        open={pendingStatus !== null}
        title={pendingStatus ? `${STATUS_ACTION_LABELS[pendingStatus]}?` : ''}
        description={
          pendingStatus === 'cancelled'
            ? 'O horário será liberado. Esta ação não pode ser desfeita.'
            : 'Depois disso, só as observações do agendamento poderão ser alteradas.'
        }
        confirmLabel={pendingStatus ? STATUS_ACTION_LABELS[pendingStatus]! : ''}
        confirmColor={pendingStatus === 'cancelled' ? 'error' : 'primary'}
        loading={changeStatus.isPending}
        error={changeStatus.error}
        onConfirm={() => pendingStatus && changeStatus.mutate(pendingStatus)}
        onClose={() => {
          setPendingStatus(null);
          changeStatus.reset();
        }}
      />
    </Dialog>
  );
}
