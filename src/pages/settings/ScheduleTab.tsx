import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Button, InputAdornment, Stack, TextField } from '@mui/material';
import { tenantKeys, tenantsApi } from '@/api/tenants';
import type { Tenant } from '@/api/types';
import { usersKeys } from '@/api/users';
import { ErrorMessages } from '@/components/ErrorMessages';
import { SectionCard } from '@/components/SectionCard';
import { useNotify } from '@/components/notifications/NotificationContext';
import { muiField } from '@/lib/form';

interface FormValues {
  defaultDuration: string;
  minDuration: string;
}

const minutesRule = (value: string) =>
  /^\d+$/.test(value) && Number(value) >= 5 && Number(value) <= 1440 ? true : 'Informe um número inteiro entre 5 e 1440';

export function ScheduleTab({ tenant }: { tenant: Tenant }) {
  const queryClient = useQueryClient();
  const notify = useNotify();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      defaultDuration: String(tenant.defaultAppointmentDurationMinutes),
      minDuration: String(tenant.minAppointmentDurationMinutes),
    },
  });

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      tenantsApi.update(tenant.id, {
        defaultAppointmentDurationMinutes: Number(values.defaultDuration),
        minAppointmentDurationMinutes: Number(values.minDuration),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(tenantKeys.detail(tenant.id), (old?: Tenant) => ({ ...old, ...saved }));
      // A duração efetiva de quem usa o padrão da clínica muda junto.
      void queryClient.invalidateQueries({ queryKey: usersKeys.professionals(tenant.id) });
      notify('Configurações da agenda atualizadas.');
    },
  });

  const adornment = { input: { endAdornment: <InputAdornment position="end">min</InputAdornment> } };

  return (
    <Stack spacing={3} component="form" onSubmit={handleSubmit((values) => save.mutate(values))} noValidate>
      <SectionCard
        title="Duração dos atendimentos"
        description="Cada profissional pode ter a própria duração padrão em Minha conta; sem ela, vale a da clínica."
      >
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField
            label="Duração padrão"
            {...muiField(register('defaultDuration', { validate: minutesRule }), errors.defaultDuration)}
            helperText={errors.defaultDuration?.message ?? 'Usada para calcular o fim quando só o início é informado.'}
            slotProps={{ ...adornment, htmlInput: { inputMode: 'numeric' } }}
          />
          <TextField
            label="Duração mínima"
            {...muiField(
              register('minDuration', {
                validate: (value) => {
                  const base = minutesRule(value);
                  if (base !== true) return base;
                  return (
                    Number(value) <= Number(getValues('defaultDuration')) || 'Não pode ser maior que a duração padrão'
                  );
                },
                deps: ['defaultDuration'],
              }),
              errors.minDuration,
            )}
            helperText={errors.minDuration?.message ?? 'Nenhum agendamento pode ser mais curto que isso.'}
            slotProps={{ ...adornment, htmlInput: { inputMode: 'numeric' } }}
          />
        </Box>
      </SectionCard>

      {/* Ex.: mínimo acima da duração própria de algum profissional (a API informa quantos). */}
      <ErrorMessages error={save.error} />
      <Box>
        <Button type="submit" variant="contained" disabled={!isDirty} loading={save.isPending}>
          Salvar
        </Button>
      </Box>
    </Stack>
  );
}
