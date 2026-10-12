import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import EventOutlined from '@mui/icons-material/EventOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined';
import { useAuth } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { formatLongDate } from '@/lib/dates';
import { ChargeDialog } from '@/pages/billing/ChargeDialog';
import { AppointmentDialog } from '@/pages/schedule/AppointmentDialog';
import { HomeGrid } from './HomeGrid';
import { useHomeLayout } from './useHomeLayout';
import { HOME_WIDGETS } from './widgets';

type Dialog = 'appointment' | 'charge' | null;

/**
 * /inicio — blocos na ordem e largura do layout da clínica (editado em Configurações › Tela
 * inicial). Cada bloco só aparece para quem tem a permissão correspondente.
 */
export function HomePage() {
  const { user, can } = useAuth();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [today] = useState(() => new Date());
  const { query, widgets } = useHomeLayout();

  // Pula títulos abreviados ("Dra.", "Dr.") para cumprimentar pelo nome.
  const words = user?.name.split(/\s+/).filter(Boolean) ?? [];
  const firstName = words.find((word) => !word.endsWith('.')) ?? words[0] ?? '';
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

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

  const hasVisibleWidget = widgets.some((widget) => can(HOME_WIDGETS[widget.type].permission));

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

      {query.error ? (
        <ErrorMessages error={query.error} />
      ) : query.isPending ? null : hasVisibleWidget ? (
        <HomeGrid widgets={widgets} />
      ) : (
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
