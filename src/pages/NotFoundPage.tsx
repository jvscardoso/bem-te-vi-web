import { Link as RouterLink } from 'react-router';
import { Button } from '@mui/material';
import { StatusScreen } from '@/components/StatusScreen';

export function NotFoundPage({ fullScreen }: { fullScreen?: boolean }) {
  return (
    <StatusScreen
      fullScreen={fullScreen}
      title="Página não encontrada"
      description="O endereço acessado não existe ou foi removido."
      action={
        <Button component={RouterLink} to="/" variant="contained">
          Voltar ao início
        </Button>
      }
    />
  );
}
