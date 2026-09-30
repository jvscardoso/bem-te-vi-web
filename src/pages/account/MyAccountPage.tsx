import { Box, Stack, Typography } from '@mui/material';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';
import { AppointmentSettingsForm } from './AppointmentSettingsForm';
import { ChangePasswordForm } from './ChangePasswordForm';

export function MyAccountPage() {
  const { user, can } = useAuth();
  if (!user) return null;

  return (
    <Box sx={{ maxWidth: 720 }}>
      <PageHeader title="Minha conta" />
      <Stack spacing={3}>
        <SectionCard title="Perfil" description="Para alterar nome ou email, fale com o administrador da clínica.">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 2, sm: 4 }}>
            <ProfileItem label="Nome" value={user.name} />
            <ProfileItem label="Email" value={user.email} />
            <ProfileItem label="Papel" value={user.role.name} />
          </Stack>
        </SectionCard>

        <SectionCard
          title="Alterar senha"
          description="Ao alterar a senha, você será desconectado de todos os outros dispositivos."
        >
          <ChangePasswordForm />
        </SectionCard>

        {can(['appointments:read', 'appointments:write']) && (
          <SectionCard
            title="Preferências de atendimento"
            description="Duração usada para calcular o fim dos seus agendamentos quando só o início é informado."
          >
            <AppointmentSettingsForm tenantId={user.tenantId} userId={user.userId} />
          </SectionCard>
        )}
      </Stack>
    </Box>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ wordBreak: 'break-word' }}>{value}</Typography>
    </Box>
  );
}
