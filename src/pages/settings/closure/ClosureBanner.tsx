import { Link as RouterLink } from 'react-router';
import { Alert, Button, Stack } from '@mui/material';
import { useAuth } from '@/auth/AuthContext';
import { isPlatformUser } from '@/auth/permissions';
import { ErrorMessages } from '@/components/ErrorMessages';
import { useNotify } from '@/components/notifications/NotificationContext';
import { formatDateTime } from '@/lib/format';
import { useCancelClosure, useClosureState } from './useClosure';

/**
 * Aviso fixo em todas as telas da clínica enquanto há pedido de encerramento. Só para quem tem
 * `tenant:manage`: a API não informa o pedido aos demais usuários, então eles não veem aviso.
 */
export function ClosureBanner() {
  const { user, can } = useAuth();
  const isClinicManager = !!user && !isPlatformUser(user.permissions) && can('tenant:manage');
  if (!isClinicManager) return null;
  return <ClosureBannerContent />;
}

function ClosureBannerContent() {
  const { can } = useAuth();
  const notify = useNotify();
  const closure = useClosureState();
  const cancel = useCancelClosure();

  const state = closure.data;
  if (!state?.closureRequestedAt) return null;

  return (
    <Alert
      severity="warning"
      sx={{ mb: 3, alignItems: 'center' }}
      action={
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {can('patients:export') && (
            <Button color="inherit" size="small" component={RouterLink} to="/configuracoes?aba=encerrar">
              Exportar dados
            </Button>
          )}
          <Button
            color="inherit"
            size="small"
            onClick={() => cancel.mutate(undefined, { onSuccess: () => notify('Pedido de encerramento cancelado.') })}
            loading={cancel.isPending}
          >
            Cancelar encerramento
          </Button>
        </Stack>
      }
    >
      <strong>Esta conta será encerrada.</strong>
      {state.deletionAvailableAt && (
        <> Os dados poderão ser excluídos a partir de {formatDateTime(state.deletionAvailableAt)}.</>
      )}
      <ErrorMessages error={cancel.error} />
    </Alert>
  );
}
