import { Link as RouterLink } from 'react-router';
import { Button } from '@mui/material';
import { authApi } from '@/api/auth';
import { TokenPasswordPage } from './TokenPasswordPage';

/** /reset-password?token=… — aberta pelo link do email de recuperação (rota definida pela API). */
export function ResetPasswordPage() {
  return (
    <TokenPasswordPage
      title="Criar nova senha"
      description="Escolha uma nova senha para entrar."
      submitLabel="Salvar nova senha"
      submit={authApi.resetPassword}
      successNotice="Senha alterada. Entre com a nova senha."
      invalidLink={
        <Button component={RouterLink} to="/esqueci-minha-senha" variant="contained">
          Pedir um novo link
        </Button>
      }
    />
  );
}
