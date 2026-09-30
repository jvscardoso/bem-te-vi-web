import { Link as RouterLink } from 'react-router';
import { Button } from '@mui/material';
import { StatusScreen } from '@/components/StatusScreen';

export function PatientNotFound() {
  return (
    <StatusScreen
      title="Paciente não encontrado"
      description="O paciente não existe ou foi removido."
      action={
        <Button component={RouterLink} to="/pacientes" variant="contained">
          Voltar para pacientes
        </Button>
      }
    />
  );
}
