import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router';
import { Box, Button, Paper, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { patientsApi, patientsKeys } from '@/api/patients';
import type { Patient } from '@/api/types';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import type { PermissionRequirement } from '@/auth/permissions';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';
import { useNotify } from '@/components/notifications/NotificationContext';
import { isApiError } from '@/lib/errors';
import { ageFromBirthDate, formatCpf, formatDate } from '@/lib/format';
import { maskCep } from '@/lib/masks';
import { PatientNotFound } from './PatientNotFound';

interface TabDef {
  value: string;
  label: string;
  permission?: PermissionRequirement;
}

const TABS: TabDef[] = [
  { value: 'dados', label: 'Dados' },
  { value: 'anamneses', label: 'Anamneses' },
  { value: 'agendamentos', label: 'Agendamentos', permission: 'appointments:read' },
  { value: 'cobrancas', label: 'Cobranças', permission: 'billing:read' },
];

export function PatientDetailPage() {
  const { id = '' } = useParams();
  const tenantId = useTenantId();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const query = useQuery({
    queryKey: patientsKeys.detail(tenantId, id),
    queryFn: () => patientsApi.get(tenantId, id),
  });

  const tabs = TABS.filter((tab) => can(tab.permission));
  const requestedTab = searchParams.get('aba');
  const tab = tabs.some((item) => item.value === requestedTab) ? requestedTab! : 'dados';

  if (isApiError(query.error, 404)) return <PatientNotFound />;
  if (query.error) return <ErrorMessages error={query.error} />;
  if (!query.data) return <Skeleton variant="rounded" height={240} />;

  const patient = query.data;
  const age = ageFromBirthDate(patient.birthDate);
  const subtitle = [patient.cpf && `CPF ${formatCpf(patient.cpf)}`, age !== null && `${age} anos`]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <PageHeader
        title={patient.fullName}
        subtitle={subtitle || undefined}
        actions={
          can('patients:write') && (
            <>
              <Button color="error" startIcon={<DeleteOutlineOutlined />} onClick={() => setConfirmRemove(true)}>
                Remover
              </Button>
              <Button
                component={RouterLink}
                to={`/pacientes/${patient.id}/editar`}
                variant="contained"
                startIcon={<EditOutlined />}
              >
                Editar
              </Button>
            </>
          )
        }
      />

      <Tabs
        value={tab}
        onChange={(_, value: string) => setSearchParams(value === 'dados' ? {} : { aba: value }, { replace: true })}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map((item) => (
          <Tab key={item.value} value={item.value} label={item.label} />
        ))}
      </Tabs>

      {tab === 'dados' ? (
        <PatientData patient={patient} />
      ) : (
        <Paper variant="outlined">
          <EmptyState title="Em construção" description="Esta seção será entregue nas próximas etapas." />
        </Paper>
      )}

      <RemovePatientDialog patient={patient} open={confirmRemove} onClose={() => setConfirmRemove(false)} />
    </>
  );
}

function PatientData({ patient }: { patient: Patient }) {
  const address = (patient.address ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof address[key] === 'string' ? (address[key] as string) : '');

  const street = [text('logradouro'), text('numero')].filter(Boolean).join(', ');
  const cityLine = [text('bairro'), [text('cidade'), text('uf')].filter(Boolean).join('/')].filter(Boolean).join(' · ');
  const addressLines = [
    [street, text('complemento')].filter(Boolean).join(' — '),
    cityLine,
    text('cep') && `CEP ${maskCep(text('cep'))}`,
  ].filter(Boolean);

  return (
    <Stack spacing={3} sx={{ maxWidth: 960 }}>
      <SectionCard title="Dados pessoais">
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
          <Field label="Nome completo">{patient.fullName}</Field>
          <Field label="CPF">{formatCpf(patient.cpf)}</Field>
          <Field label="Data de nascimento">
            {patient.birthDate && `${formatDate(patient.birthDate)} (${ageFromBirthDate(patient.birthDate)} anos)`}
          </Field>
          <Field label="Telefone">{patient.phone}</Field>
          <Field label="Email">{patient.email}</Field>
        </Box>
      </SectionCard>

      <SectionCard title="Endereço">
        {addressLines.length > 0 ? (
          <Box>
            {addressLines.map((line) => (
              <Typography key={line}>{line}</Typography>
            ))}
          </Box>
        ) : (
          <Typography color="text.secondary">Não informado</Typography>
        )}
      </SectionCard>

      <SectionCard title="Observações">
        <Typography sx={{ whiteSpace: 'pre-wrap' }} color={patient.notes ? 'text.primary' : 'text.secondary'}>
          {patient.notes || 'Nenhuma observação'}
        </Typography>
      </SectionCard>
    </Stack>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ wordBreak: 'break-word' }} color={children ? 'text.primary' : 'text.secondary'}>
        {children || '—'}
      </Typography>
    </Box>
  );
}

function RemovePatientDialog({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotify();

  const remove = useMutation({
    mutationFn: () => patientsApi.remove(tenantId, patient.id),
    onSuccess: () => {
      // Sai da ficha antes de limpar o cache, para não piscar "não encontrado".
      navigate('/pacientes', { replace: true });
      notify('Paciente removido. Ele pode ser restaurado em Pacientes removidos.');
      queryClient.removeQueries({ queryKey: patientsKeys.detail(tenantId, patient.id) });
      void queryClient.invalidateQueries({ queryKey: patientsKeys.all(tenantId) });
    },
  });

  return (
    <ConfirmDialog
      open={open}
      title="Remover paciente?"
      description={
        <>
          <strong>{patient.fullName}</strong> deixará de aparecer nas listas e não poderá receber novos agendamentos
          nem cobranças. Os dados, anamneses e o histórico são mantidos e o cadastro pode ser restaurado depois.
        </>
      }
      confirmLabel="Remover"
      confirmColor="error"
      loading={remove.isPending}
      error={remove.error}
      onConfirm={() => remove.mutate()}
      onClose={() => {
        onClose();
        remove.reset();
      }}
    />
  );
}
