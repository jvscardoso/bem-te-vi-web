import { Typography } from '@mui/material';
import { authApi } from '@/api/auth';
import { useBranding } from '@/theme/BrandingContext';
import { TokenPasswordPage } from './TokenPasswordPage';

/** /accept-invite?token=… — aberta pelo link do convite (rota definida pela API). */
export function AcceptInvitePage() {
  const { displayName } = useBranding();

  return (
    <TokenPasswordPage
      title="Crie sua senha"
      description={`Para acessar ${displayName}.`}
      submitLabel="Criar senha e ativar conta"
      passwordLabel="Senha"
      requireLegalAcceptance
      submit={authApi.acceptInvite}
      successNotice="Conta ativada. Entre com a senha que você criou."
      invalidLink={
        <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
          Peça ao administrador da clínica para reenviar o convite.
        </Typography>
      }
    />
  );
}
