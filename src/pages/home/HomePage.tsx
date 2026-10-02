import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import EventOutlined from '@mui/icons-material/EventOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined';
import { patientsApi, patientsKeys } from '@/api/patients';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { SearchField } from '@/components/SearchField';
import { formatLongDate } from '@/lib/dates';
import { ChargeDialog } from '@/pages/billing/ChargeDialog';
import { SummaryCards } from '@/pages/billing/SummaryCards';
import { AppointmentDialog } from '@/pages/schedule/AppointmentDialog';
import { OverdueCharges } from './OverdueCharges';
import { TodayAgenda } from './TodayAgenda';

type Dialog = 'appointment' | 'charge' | null;

/** /inicio — cada bloco só aparece para quem tem a permissão correspondente. */
export function HomePage() {
  const { user, can } = useAuth();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [today] = useState(() => new Date());

  // Pula títulos abreviados ("Dra.", "Dr.") para cumprimentar pelo nome.
  const words = user?.name.split(/\s+/).filter(Boolean) ?? [];
  const firstName = words.find((word) => !word.endsWith('.')) ?? words[0] ?? '';
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const canAgenda = can('appointments:read');
  const canBilling = can('billing:read');
  const canPatients = can('patients:read');

  const actions = [
    can('appointments:write') && (
      <Button key="appointment" variant="contained" startIcon={<EventOutlined />} onClick={() => setDialog('appointment')}>
        Novo agendamento
      </Button>
    ),
    can('patients:write') && (
      <Button key="patient" variant="outlined" startIcon={<PersonAddAlt1Outlined />} component={RouterLink} to="/pacientes/novo">
        Novo paciente
      </Button>
    ),
    can('billing:write') && (
      <Button key="charge" variant="outlined" startIcon={<PaymentsOutlined />} onClick={() => setDialog('charge')}>
        Nova cobrança
      </Button>
    ),
  ].filter(Boolean);

  return (
    <>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ mb: 3, justifyContent: 'space-between', alignItems: { md: 'center' } }}
      >
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
            {greeting}, {firstName}
          </Typography>
          <Typography color="text.secondary">{formatLongDate(today)}</Typography>
        </Box>
        {actions.length > 0 && (
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {actions}
          </Stack>
        )}
      </Stack>

      {canBilling && <SummaryCards />}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: canAgenda && (canBilling || canPatients) ? '3fr 2fr' : '1fr' },
          alignItems: 'start',
        }}
      >
        {canAgenda && <TodayAgenda />}
        {(canBilling || canPatients) && (
          <Stack spacing={2}>
            {canPatients && <PatientsShortcut />}
            {canBilling && <OverdueCharges />}
          </Stack>
        )}
      </Box>

      {!canAgenda && !canBilling && !canPatients && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="text.secondary">
            Use o menu ao lado para acessar as áreas disponíveis para o seu perfil.
          </Typography>
        </Paper>
      )}

      {dialog === 'appointment' && <AppointmentDialog onClose={() => setDialog(null)} />}
      {dialog === 'charge' && <ChargeDialog onClose={() => setDialog(null)} />}
    </>
  );
}

/** Busca rápida que leva à lista de pacientes já filtrada. */
function PatientsShortcut() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const params = { page: 1, pageSize: 1 };

  // Só o total (pageSize 1): a lista completa fica na tela de pacientes.
  const total = useQuery({
    queryKey: patientsKeys.list(tenantId, params),
    queryFn: () => patientsApi.list(tenantId, params),
  }).data?.meta.total;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = search.trim();
    navigate(q ? `/pacientes?q=${encodeURIComponent(q)}` : '/pacientes');
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          Pacientes
        </Typography>
        {total !== undefined && (
          <Typography variant="body2" color="text.secondary">
            {total} {total === 1 ? 'cadastrado' : 'cadastrados'}
          </Typography>
        )}
      </Stack>
      <Box component="form" onSubmit={submit}>
        <SearchField value={search} onChange={setSearch} placeholder="Buscar por nome ou CPF e Enter" fullWidth />
      </Box>
    </Paper>
  );
}
