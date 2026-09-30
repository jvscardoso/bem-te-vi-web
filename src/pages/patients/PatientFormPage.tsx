import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { Box, Button, Skeleton, Stack, TextField } from '@mui/material';
import { patientsApi, patientsKeys } from '@/api/patients';
import type { Patient } from '@/api/types';
import { useTenantId } from '@/auth/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';
import { useNotify } from '@/components/notifications/NotificationContext';
import { isApiError } from '@/lib/errors';
import { muiField } from '@/lib/form';
import { maskCep, maskCpf, maskPhone } from '@/lib/masks';
import { PatientNotFound } from './PatientNotFound';
import { patientSchema, toFormValues, toPatientInput, type PatientFormValues } from './patientForm';

/** Cadastro (/pacientes/novo) e edição (/pacientes/:id/editar). */
export function PatientFormPage() {
  const { id } = useParams();
  const tenantId = useTenantId();

  const patientQuery = useQuery({
    queryKey: patientsKeys.detail(tenantId, id ?? ''),
    queryFn: () => patientsApi.get(tenantId, id!),
    enabled: !!id,
  });

  if (!id) return <PatientForm />;
  if (isApiError(patientQuery.error, 404)) return <PatientNotFound />;
  if (patientQuery.error) return <ErrorMessages error={patientQuery.error} />;
  if (!patientQuery.data) return <Skeleton variant="rounded" height={320} />;
  return <PatientForm patient={patientQuery.data} />;
}

const grid = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(6, 1fr)' },
} as const;

const span = (md: number, sm = 1) => ({ gridColumn: { xs: 'span 1', sm: `span ${sm}`, md: `span ${md}` } });

function PatientForm({ patient }: { patient?: Patient }) {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [removedPatientId, setRemovedPatientId] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientFormValues>({ resolver: zodResolver(patientSchema), defaultValues: toFormValues(patient) });

  const save = useMutation({
    mutationFn: (values: PatientFormValues) => {
      const input = toPatientInput(values, patient);
      return patient ? patientsApi.update(tenantId, patient.id, input) : patientsApi.create(tenantId, input);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(patientsKeys.detail(tenantId, saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: patientsKeys.all(tenantId) });
      notify(patient ? 'Paciente atualizado.' : 'Paciente cadastrado.');
      navigate(`/pacientes/${saved.id}`, { replace: true });
    },
    onError: (error) => {
      // CPF de paciente removido: oferece restaurar o cadastro existente.
      if (!patient && isApiError(error, 409) && error.body?.removedPatientId) {
        setRemovedPatientId(error.body.removedPatientId);
      }
    },
  });

  const restore = useMutation({
    mutationFn: (id: string) => patientsApi.restore(tenantId, id),
    onSuccess: (restored) => {
      queryClient.setQueryData(patientsKeys.detail(tenantId, restored.id), restored);
      void queryClient.invalidateQueries({ queryKey: patientsKeys.all(tenantId) });
      notify('Cadastro restaurado.');
      navigate(`/pacientes/${restored.id}`, { replace: true });
    },
  });

  const cancelPath = patient ? `/pacientes/${patient.id}` : '/pacientes';
  const showSaveError = save.error && !removedPatientId;

  return (
    <Box sx={{ maxWidth: 960 }}>
      <PageHeader title={patient ? 'Editar paciente' : 'Novo paciente'} subtitle={patient?.fullName} />

      <Stack spacing={3} component="form" onSubmit={handleSubmit((values) => save.mutate(values))} noValidate>
        <SectionCard title="Dados pessoais">
          <Box sx={grid}>
            <TextField
              label="Nome completo"
              required
              autoFocus={!patient}
              sx={span(4, 2)}
              {...muiField(register('fullName'), errors.fullName)}
            />
            <Controller
              name="cpf"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  label="CPF"
                  slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                  sx={span(2)}
                  {...field}
                  inputRef={field.ref}
                  onChange={(event) => field.onChange(maskCpf(event.target.value))}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <TextField
              label="Data de nascimento"
              type="date"
              sx={span(2)}
              slotProps={{ inputLabel: { shrink: true } }}
              {...muiField(register('birthDate'), errors.birthDate)}
            />
            <Controller
              name="phone"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  label="Telefone"
                  type="tel"
                  slotProps={{ htmlInput: { inputMode: 'tel' } }}
                  sx={span(2)}
                  {...field}
                  inputRef={field.ref}
                  onChange={(event) => field.onChange(maskPhone(event.target.value))}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <TextField label="Email" type="email" sx={span(2)} {...muiField(register('email'), errors.email)} />
          </Box>
        </SectionCard>

        <SectionCard title="Endereço">
          <Box sx={grid}>
            <Controller
              name="address.cep"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  label="CEP"
                  slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                  sx={span(2)}
                  {...field}
                  inputRef={field.ref}
                  onChange={(event) => field.onChange(maskCep(event.target.value))}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <TextField
              label="Logradouro"
              sx={span(4)}
              {...muiField(register('address.logradouro'), errors.address?.logradouro)}
            />
            <TextField label="Número" sx={span(1)} {...muiField(register('address.numero'), errors.address?.numero)} />
            <TextField
              label="Complemento"
              sx={span(2)}
              {...muiField(register('address.complemento'), errors.address?.complemento)}
            />
            <TextField label="Bairro" sx={span(3)} {...muiField(register('address.bairro'), errors.address?.bairro)} />
            <TextField label="Cidade" sx={span(4)} {...muiField(register('address.cidade'), errors.address?.cidade)} />
            <TextField
              label="UF"
              sx={span(2)}
              slotProps={{ htmlInput: { maxLength: 2, style: { textTransform: 'uppercase' } } }}
              {...muiField(register('address.uf'), errors.address?.uf)}
            />
          </Box>
        </SectionCard>

        <SectionCard title="Observações">
          <TextField
            label="Observações"
            multiline
            minRows={3}
            {...muiField(register('notes'), errors.notes)}
          />
        </SectionCard>

        {showSaveError && <ErrorMessages error={save.error} />}

        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button component={RouterLink} to={cancelPath} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" loading={save.isPending}>
            {patient ? 'Salvar alterações' : 'Cadastrar paciente'}
          </Button>
        </Stack>
      </Stack>

      <ConfirmDialog
        open={removedPatientId !== null}
        title="CPF de paciente removido"
        description="Já existe um paciente removido com este CPF. Restaure o cadastro existente em vez de criar um novo: os dados, anamneses e o histórico dele voltam como estavam."
        confirmLabel="Restaurar cadastro existente"
        loading={restore.isPending}
        error={restore.error}
        onConfirm={() => removedPatientId && restore.mutate(removedPatientId)}
        onClose={() => {
          setRemovedPatientId(null);
          restore.reset();
        }}
      />
    </Box>
  );
}
