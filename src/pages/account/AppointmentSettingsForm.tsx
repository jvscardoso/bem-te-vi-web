import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Alert, Box, Button, InputAdornment, Skeleton, Stack, TextField } from '@mui/material';
import type { UUID } from '@/api/types';
import { usersApi, usersKeys } from '@/api/users';
import { ErrorMessages } from '@/components/ErrorMessages';
import { useNotify } from '@/components/notifications/NotificationContext';
import { muiField } from '@/lib/form';

const schema = z.object({
  duration: z
    .string()
    .trim()
    .refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 5 && Number(value) <= 1440), {
      message: 'Informe um número inteiro entre 5 e 1440, ou deixe em branco',
    }),
});

type FormValues = z.infer<typeof schema>;

export function AppointmentSettingsForm({ tenantId, userId }: { tenantId: UUID; userId: UUID }) {
  const queryClient = useQueryClient();
  const notify = useNotify();

  // A própria duração vem da lista de profissionais (o /auth/me não a inclui).
  const professionalsQuery = useQuery({
    queryKey: usersKeys.professionals(tenantId),
    queryFn: () => usersApi.professionals(tenantId),
  });
  const me = professionalsQuery.data?.find((professional) => professional.id === userId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { duration: '' } });

  useEffect(() => {
    if (me) reset({ duration: me.defaultAppointmentDurationMinutes?.toString() ?? '' });
  }, [me, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      usersApi.updateMyAppointmentSettings(tenantId, values.duration === '' ? null : Number(values.duration)),
    onSuccess: () => {
      notify('Preferências salvas.');
      return queryClient.invalidateQueries({ queryKey: usersKeys.professionals(tenantId) });
    },
  });

  if (professionalsQuery.isPending) return <Skeleton variant="rounded" height={56} />;
  if (professionalsQuery.error) return <ErrorMessages error={professionalsQuery.error} />;
  if (!me) return <Alert severity="info">Suas preferências de atendimento não estão disponíveis.</Alert>;

  const usingClinicDefault = me.defaultAppointmentDurationMinutes === null;

  return (
    <Stack spacing={2} component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <TextField
        label="Minha duração padrão"
        inputMode="numeric"
        placeholder="Padrão da clínica"
        sx={{ maxWidth: 320 }}
        {...muiField(register('duration'), errors.duration)}
        helperText={
          errors.duration?.message ??
          (usingClinicDefault
            ? `Usando o padrão da clínica (${me.effectiveAppointmentDurationMinutes} min). Deixe em branco para manter.`
            : 'Deixe em branco para usar o padrão da clínica.')
        }
        slotProps={{
          // Rótulo sempre no alto: o valor chega via reset() e o placeholder precisa aparecer.
          inputLabel: { shrink: true },
          input: { endAdornment: <InputAdornment position="end">min</InputAdornment> },
        }}
      />
      <ErrorMessages error={mutation.error} />
      <Box>
        <Button type="submit" variant="contained" disabled={!isDirty} loading={mutation.isPending}>
          Salvar
        </Button>
      </Box>
    </Stack>
  );
}
