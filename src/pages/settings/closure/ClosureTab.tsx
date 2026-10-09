import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import { useAuth } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PasswordField } from '@/components/PasswordField';
import { SectionCard } from '@/components/SectionCard';
import { useNotify } from '@/components/notifications/NotificationContext';
import { isApiError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useClinicExport } from './useClinicExport';
import { useCancelClosure, useClosureState, useRequestClosure } from './useClosure';

/** Configurações › Encerrar conta (LGPD): levar os dados e pedir a exclusão. Exige `tenant:manage`. */
export function ClosureTab() {
  const closure = useClosureState();
  const [requesting, setRequesting] = useState(false);

  return (
    <Stack spacing={3}>
      <ExportSection />

      <SectionCard
        title="Encerrar a conta"
        description="Pede a exclusão definitiva da clínica e de todos os dados guardados no bem-te-vi."
      >
        {closure.error ? (
          <ErrorMessages error={closure.error} />
        ) : !closure.data ? (
          <Skeleton variant="rounded" height={96} />
        ) : closure.data.closureRequestedAt ? (
          <ActiveClosure requestedAt={closure.data.closureRequestedAt} availableAt={closure.data.deletionAvailableAt} />
        ) : (
          <>
            <Typography variant="body2">
              Depois do pedido, a clínica continua funcionando normalmente por{' '}
              <strong>{closure.data.graceDays} dias</strong>, e o pedido pode ser cancelado nesse período. Passada a
              carência, a equipe do bem-te-vi exclui <strong>definitivamente</strong> todos os dados: pacientes,
              prontuários, agenda, financeiro, usuários e configurações. Não há como recuperar depois.
            </Typography>
            <Box>
              <Button color="error" variant="outlined" onClick={() => setRequesting(true)}>
                Pedir encerramento da conta
              </Button>
            </Box>
          </>
        )}
      </SectionCard>

      {requesting && closure.data && (
        <RequestClosureDialog graceDays={closure.data.graceDays} onClose={() => setRequesting(false)} />
      )}
    </Stack>
  );
}

function ExportSection() {
  const { can } = useAuth();
  const exportAll = useClinicExport();
  const canExport = can('patients:export');

  return (
    <SectionCard
      title="Exportar todos os dados"
      description="Um arquivo com tudo o que a clínica guarda no bem-te-vi, para levar a outro sistema ou cumprir a guarda de prontuário. A exportação fica registrada na auditoria."
    >
      {canExport ? (
        <>
          <Box>
            <Button
              variant="outlined"
              startIcon={<FileDownloadOutlined />}
              onClick={() => exportAll.mutate()}
              loading={exportAll.isPending}
            >
              Exportar todos os dados
            </Button>
          </Box>
          {exportAll.isPending && (
            <Stack spacing={1}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary">
                Gerando o arquivo. Em clínicas com muitos pacientes, isso pode levar alguns segundos.
              </Typography>
            </Stack>
          )}
          {exportAll.isSuccess && <Alert severity="success">Arquivo baixado.</Alert>}
          <ErrorMessages error={exportAll.error} />
        </>
      ) : (
        <Alert severity="info">
          A exportação inclui os prontuários e exige também a permissão de exportar dados de pacientes. Peça a um
          administrador.
        </Alert>
      )}
    </SectionCard>
  );
}

function ActiveClosure({ requestedAt, availableAt }: { requestedAt: string; availableAt: string | null }) {
  const notify = useNotify();
  const cancel = useCancelClosure();

  return (
    <>
      <Alert severity="warning">
        Encerramento pedido em <strong>{formatDateTime(requestedAt)}</strong>.
        {availableAt && (
          <>
            {' '}
            Os dados poderão ser excluídos a partir de <strong>{formatDateTime(availableAt)}</strong>.
          </>
        )}{' '}
        Até lá, a clínica funciona normalmente.
      </Alert>
      <Box>
        <Button
          variant="contained"
          onClick={() => cancel.mutate(undefined, { onSuccess: () => notify('Pedido de encerramento cancelado.') })}
          loading={cancel.isPending}
        >
          Cancelar encerramento
        </Button>
      </Box>
      <ErrorMessages error={cancel.error} />
    </>
  );
}

function RequestClosureDialog({ graceDays, onClose }: { graceDays: number; onClose: () => void }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const notify = useNotify();
  const { can } = useAuth();
  const exportAll = useClinicExport();
  const request = useRequestClosure();
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);

  // "Senha incorreta" é 400 de propósito (não desloga): fica no campo. Os demais erros, abaixo.
  const wrongPassword = isApiError(request.error, 400);

  const submit = () =>
    request.mutate(password, {
      onSuccess: () => {
        notify('Encerramento pedido. Enviamos a confirmação por email.');
        onClose();
      },
    });

  return (
    <Dialog open onClose={request.isPending ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>Pedir encerramento da conta</DialogTitle>
      <DialogContent>
        <Stack
          spacing={2.5}
          component="form"
          id="closure-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          sx={{ pt: 0.5 }}
        >
          <Alert
            severity="info"
            action={
              can('patients:export') && (
                <Button color="inherit" size="small" onClick={() => exportAll.mutate()} loading={exportAll.isPending}>
                  Exportar agora
                </Button>
              )
            }
          >
            Recomendamos exportar todos os dados antes de pedir o encerramento.
            {exportAll.isSuccess && ' Arquivo baixado.'}
          </Alert>
          <ErrorMessages error={exportAll.error} />
          <Typography variant="body2">
            A clínica continua funcionando por <strong>{graceDays} dias</strong>, e o pedido pode ser cancelado nesse
            período. Depois disso, <strong>todos os dados são apagados definitivamente</strong>, sem possibilidade de
            recuperação.
          </Typography>
          <PasswordField
            label="Sua senha"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (wrongPassword) request.reset();
            }}
            error={wrongPassword}
            helperText={wrongPassword ? 'Senha incorreta' : 'Confirme com a senha da sua conta.'}
            autoFocus
          />
          <FormControlLabel
            control={<Checkbox checked={understood} onChange={(_, value) => setUnderstood(value)} />}
            label="Entendo que, passada a carência, os dados da clínica serão excluídos definitivamente."
          />
          {!wrongPassword && <ErrorMessages error={request.error} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={request.isPending}>
          Voltar
        </Button>
        <Button
          type="submit"
          form="closure-form"
          color="error"
          variant="contained"
          disabled={!password || !understood}
          loading={request.isPending}
        >
          Pedir encerramento
        </Button>
      </DialogActions>
    </Dialog>
  );
}
