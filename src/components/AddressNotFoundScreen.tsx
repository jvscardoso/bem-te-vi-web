import { Box, Button } from '@mui/material';
import { StatusScreen } from './StatusScreen';

/**
 * Endereço de clínica sem clínica ativa: subdomínio ou domínio digitado errado, clínica excluída
 * ou suspensa, ou domínio próprio ainda não verificado. A API não diz qual (a marca pública só
 * responde 404), então o texto cobre todos os casos.
 */
export function AddressNotFoundScreen() {
  return (
    <StatusScreen
      fullScreen
      title="Endereço não encontrado"
      description={
        <>
          Não há uma clínica ativa em{' '}
          <Box component="strong" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {window.location.host}
          </Box>
          . Confira se o endereço está correto ou fale com a sua clínica.
        </>
      }
      action={
        <Button variant="outlined" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      }
    />
  );
}
