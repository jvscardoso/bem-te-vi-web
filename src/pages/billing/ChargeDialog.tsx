import { Controller, useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { appointmentsApi, appointmentsKeys } from '@/api/appointments';
import { billingApi, billingKeys, type ChargeInput } from '@/api/billing';
import type { Charge } from '@/api/types';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { MoneyField } from '@/components/MoneyField';
import { PatientPicker, type PatientOption } from '@/components/PatientPicker';
import { useNotify } from '@/components/notifications/NotificationContext';
import { addDays, toDateKey } from '@/lib/dates';
import { formatDateTime } from '@/lib/format';
import { centsToMoney, moneyToCents } from '@/lib/masks';
import { STATUS_LABELS } from '@/pages/schedule/status';

export interface ChargeDraft {
  patient?: PatientOption;
  appointmentId?: string;
  description?: string;
}

interface ChargeDialogProps {
  charge?: Charge;
  draft?: ChargeDraft;
  onClose: () => void;
  onSaved?: (charge: Charge) => void;
}

interface FormValues {
  patient: PatientOption | null;
  appointmentId: string;
  description: string;
  amount: string;
  dueDate: string;
}

const MAX_CENTS = 100_000_000;

function initialValues(charge?: Charge, draft?: ChargeDraft): FormValues {
  if (charge) {
    return {
      patient: charge.patient,
      appointmentId: charge.appointmentId ?? '',
      description: charge.description,
      amount: centsToMoney(charge.amountCents),
      dueDate: charge.dueDate.slice(0, 10),
    };
  }
  return {
    patient: draft?.patient ?? null,
    appointmentId: draft?.appointmentId ?? '',
    description: draft?.description ?? '',
    amount: '',
    // Vencimento sugerido: em 7 dias.
    dueDate: toDateKey(addDays(new Date(), 7)),
  };
}

export function ChargeDialog({ charge, draft, onClose, onSaved }: ChargeDialogProps) {
  const tenantId = useTenantId();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const { control, handleSubmit, setValue, formState } = useForm<FormValues>({
    defaultValues: initialValues(charge, draft),
  });
  const patient = useWatch({ control, name: 'patient' });

  // Agendamento vinculado: só agendamentos do mesmo paciente (regra da API).
  const appointmentParams = { patientId: patient?.id };
  const appointments = useQuery({
    queryKey: appointmentsKeys.list(tenantId, appointmentParams),
    queryFn: () => appointmentsApi.listAll(tenantId, appointmentParams),
    enabled: !!patient && can('appointments:read'),
  });
  // Mais recentes primeiro.
  const appointmentOptions = [...(appointments.data ?? [])].reverse();

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const input: ChargeInput = {
        patientId: values.patient!.id,
        appointmentId: values.appointmentId || null,
        description: values.description.trim(),
        amountCents: moneyToCents(values.amount),
        dueDate: values.dueDate,
      };
      if (!charge) {
        return billingApi.create(tenantId, { ...input, appointmentId: input.appointmentId ?? undefined });
      }
      const dirty = formState.dirtyFields;
      const update: Partial<ChargeInput> = {};
      if (dirty.patient) update.patientId = input.patientId;
      if (dirty.appointmentId || dirty.patient) update.appointmentId = input.appointmentId;
      if (dirty.description) update.description = input.description;
      if (dirty.amount) update.amountCents = input.amountCents;
      if (dirty.dueDate) update.dueDate = input.dueDate;
      return billingApi.update(tenantId, charge.id, update);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: billingKeys.all(tenantId) });
      notify(charge ? 'Cobrança atualizada.' : 'Cobrança criada.');
      onSaved?.(saved);
      onClose();
    },
  });

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>{charge ? 'Editar cobrança' : 'Nova cobrança'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} component="form" id="charge-form" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
          <Controller
            name="patient"
            control={control}
            rules={{ validate: (value) => !!value || 'Selecione o paciente' }}
            render={({ field, fieldState }) => (
              <PatientPicker
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  setValue('appointmentId', '', { shouldDirty: true });
                }}
                onBlur={field.onBlur}
                inputRef={field.ref}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          {can('appointments:read') && (
            <Controller
              name="appointmentId"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label="Agendamento (opcional)"
                  {...field}
                  inputRef={field.ref}
                  disabled={!patient}
                  helperText={!patient ? 'Selecione o paciente primeiro.' : undefined}
                  slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                >
                  <MenuItem value="">
                    <em>Sem agendamento</em>
                  </MenuItem>
                  {appointmentOptions.map((appointment) => (
                    <MenuItem key={appointment.id} value={appointment.id}>
                      {formatDateTime(appointment.scheduledAt)} · {appointment.professional.name} ·{' '}
                      {STATUS_LABELS[appointment.status]}
                    </MenuItem>
                  ))}
                  {/* Vínculo atual fora da lista carregada (ex.: sem permissão de agenda completa). */}
                  {field.value && !appointmentOptions.some((item) => item.id === field.value) && (
                    <MenuItem value={field.value}>Agendamento vinculado</MenuItem>
                  )}
                </TextField>
              )}
            />
          )}

          <Controller
            name="description"
            control={control}
            rules={{
              validate: (value) =>
                !value.trim() ? 'Informe a descrição' : value.length > 200 ? 'Máximo de 200 caracteres' : true,
            }}
            render={({ field, fieldState }) => (
              <TextField
                label="Descrição"
                placeholder="Ex.: Consulta 01/10"
                {...field}
                inputRef={field.ref}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Controller
              name="amount"
              control={control}
              rules={{
                validate: (value) => {
                  const cents = moneyToCents(value);
                  if (cents < 1) return 'Informe o valor';
                  return cents <= MAX_CENTS || 'Valor acima do permitido';
                },
              }}
              render={({ field, fieldState }) => (
                <MoneyField
                  label="Valor"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="dueDate"
              control={control}
              rules={{ required: 'Informe o vencimento' }}
              render={({ field, fieldState }) => (
                <TextField
                  label="Vencimento"
                  type="date"
                  {...field}
                  inputRef={field.ref}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              )}
            />
          </Box>
        </Stack>
      </DialogContent>

      {save.error && (
        <Box sx={{ px: 3, pt: 2 }}>
          <ErrorMessages error={save.error} />
        </Box>
      )}

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button type="submit" form="charge-form" variant="contained" loading={save.isPending}>
          {charge ? 'Salvar' : 'Criar cobrança'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
