import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router';
import { Alert, Box, Button, MenuItem, Skeleton, Stack, TextField } from '@mui/material';
import { anamnesisApi, anamnesisKeys } from '@/api/anamnesis';
import { ApiError } from '@/api/client';
import { patientsApi, patientsKeys } from '@/api/patients';
import type { AnamnesisTemplate, Patient } from '@/api/types';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';
import { useNotify } from '@/components/notifications/NotificationContext';
import { isApiError } from '@/lib/errors';
import { AnamnesisFieldInput } from '@/pages/anamnesis/AnamnesisFieldInput';
import { emptyAnswers, splitAnswerErrors, toApiAnswers, type FormAnswers } from '@/pages/anamnesis/answers';
import { PatientNotFound } from '../PatientNotFound';

/** /pacientes/:id/anamneses/nova?formulario=<templateId> */
export function FillAnamnesisPage() {
  const { id = '' } = useParams();
  const tenantId = useTenantId();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const patient = useQuery({
    queryKey: patientsKeys.detail(tenantId, id),
    queryFn: () => patientsApi.get(tenantId, id),
  });
  const templates = useQuery({
    queryKey: anamnesisKeys.templates(tenantId),
    queryFn: () => anamnesisApi.templates(tenantId),
  });

  if (isApiError(patient.error, 404)) return <PatientNotFound />;
  const error = patient.error ?? templates.error;
  if (error) return <ErrorMessages error={error} />;
  if (!patient.data || !templates.data) return <Skeleton variant="rounded" height={320} />;

  const backPath = `/pacientes/${id}?aba=anamneses`;

  if (templates.data.length === 0) {
    return (
      <>
        <PageHeader title="Preencher anamnese" subtitle={patient.data.fullName} />
        <EmptyState
          title="Nenhum formulário de anamnese cadastrado"
          description={
            can('anamnesis_templates:manage')
              ? 'Crie um formulário antes de preencher a ficha.'
              : 'Peça ao administrador da clínica para criar um formulário.'
          }
          action={
            can('anamnesis_templates:manage') && (
              <Button component={RouterLink} to="/anamnese/formularios/novo" variant="contained">
                Criar formulário
              </Button>
            )
          }
        />
      </>
    );
  }

  // Com um único formulário, já abre direto nele.
  const requested = searchParams.get('formulario');
  const template =
    templates.data.find((item) => item.id === requested) ?? (templates.data.length === 1 ? templates.data[0] : undefined);

  return (
    <Box sx={{ maxWidth: 760 }}>
      <PageHeader title="Preencher anamnese" subtitle={patient.data.fullName} />
      <Stack spacing={3}>
        {templates.data.length > 1 && (
          <TextField
            select
            label="Formulário"
            value={template?.id ?? ''}
            onChange={(event) => setSearchParams({ formulario: event.target.value }, { replace: true })}
            sx={{ maxWidth: 400 }}
          >
            {templates.data.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        {template ? (
          <AnamnesisForm key={template.id} patient={patient.data} template={template} backPath={backPath} />
        ) : (
          <Stack direction="row">
            <Button component={RouterLink} to={backPath}>
              Cancelar
            </Button>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

interface AnamnesisFormProps {
  patient: Patient;
  template: AnamnesisTemplate;
  backPath: string;
}

function AnamnesisForm({ patient, template, backPath }: AnamnesisFormProps) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotify();
  const [generalErrors, setGeneralErrors] = useState<string[]>([]);

  const { control, handleSubmit, setError } = useForm<{ answers: FormAnswers }>({
    defaultValues: { answers: emptyAnswers(template.fields) },
    shouldFocusError: true,
  });

  const save = useMutation({
    mutationFn: (answers: FormAnswers) =>
      anamnesisApi.createRecord(tenantId, patient.id, template.id, toApiAnswers(template.fields, answers)),
    onMutate: () => setGeneralErrors([]),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: anamnesisKeys.records(tenantId, patient.id) });
      notify('Anamnese registrada.');
      navigate(backPath, { replace: true });
    },
    onError: (error) => {
      if (!(error instanceof ApiError) || error.status !== 400) return;
      // Erros por campo vão para junto do campo; o resto fica no alerta.
      const { byKey, general } = splitAnswerErrors(error.messages, template.fields);
      Object.entries(byKey).forEach(([key, message], index) =>
        setError(`answers.${key}`, { message }, { shouldFocus: index === 0 }),
      );
      setGeneralErrors(general);
    },
  });

  const unexpectedError = save.error && !(save.error instanceof ApiError && save.error.status === 400);

  return (
    <Stack spacing={3} component="form" onSubmit={handleSubmit(({ answers }) => save.mutate(answers))} noValidate>
      <SectionCard title={template.name}>
        <Stack spacing={2.5}>
          {template.fields.map((field) => (
            <AnamnesisFieldInput key={field.key} field={field} control={control} />
          ))}
        </Stack>
      </SectionCard>

      <Alert severity="info">Depois de salva, a ficha não pode ser editada nem excluída.</Alert>

      {generalErrors.length > 0 && <ErrorMessages error={generalErrors} />}
      {unexpectedError && <ErrorMessages error={save.error} />}

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button component={RouterLink} to={backPath} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="contained" loading={save.isPending}>
          Salvar ficha
        </Button>
      </Stack>
    </Stack>
  );
}
