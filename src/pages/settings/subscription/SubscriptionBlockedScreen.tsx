import { Box, Button, Stack, Typography } from '@mui/material';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import { useAuth } from '@/auth/AuthContext';
import { BrandMark } from '@/components/BrandMark';
import { ErrorMessages } from '@/components/ErrorMessages';
import { useClinicExport } from '@/pages/settings/closure/useClinicExport';
import { SubscriptionTab } from './SubscriptionTab';

/**
 * Clínica bloqueada pela assinatura (teste ou atraso vencidos há mais de 30 dias): a API recusa
 * até a leitura com 402, então nada do app abre. Ficam só o que a API sempre aceita: contratar,
 * exportar os dados e sair. Quem não administra a clínica só pode sair.
 */
export function SubscriptionBlockedScreen() {
  const { subscription, can, logout } = useAuth();
  const isManager = can('tenant:manage');
  const reason =
    subscription?.reason === 'past_due' ? 'A mensalidade da clínica está em atraso.' : 'O teste grátis da clínica terminou.';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: { xs: 4, md: 6 }, px: 2 }}>
      <Stack spacing={3} sx={{ maxWidth: 1040, mx: 'auto' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <BrandMark size={40} />
          <Button onClick={logout}>Sair</Button>
        </Stack>

        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
            Acesso à clínica bloqueado
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {reason} Os dados continuam guardados e voltam a ficar disponíveis assim que o pagamento for confirmado.
            {!isManager && ' Fale com o administrador da clínica para regularizar a assinatura.'}
          </Typography>
        </Box>

        {isManager && (
          <>
            {can('patients:export') && <ExportButton />}
            <SubscriptionTab />
          </>
        )}
      </Stack>
    </Box>
  );
}

function ExportButton() {
  const exportAll = useClinicExport();
  return (
    <Box>
      <Button
        variant="outlined"
        startIcon={<DownloadOutlined />}
        loading={exportAll.isPending}
        onClick={() => exportAll.mutate()}
      >
        Exportar todos os dados
      </Button>
      <ErrorMessages error={exportAll.error} />
    </Box>
  );
}
