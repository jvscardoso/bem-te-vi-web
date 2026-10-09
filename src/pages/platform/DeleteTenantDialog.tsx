import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { platformApi } from '@/api/platform';
import type { PlatformTenant } from '@/api/types';
import { getErrorMessages } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/** O 409 da carência traz a data em ISO ("a partir de 2026-11-08T12:00:00.000Z"): exibe no fuso local. */
const humanizeDates = (message: string) =>
  message.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, (iso) => formatDateTime(iso));

interface DeleteTenantDialogProps {
  tenant: PlatformTenant;
  onClose: () => void;
  onDeleted: (tenant: PlatformTenant) => void;
}

/**
 * Exclusão definitiva de uma clínica que pediu o encerramento. Confirmação no estilo do GitHub:
 * digitar o subdomínio. A carência é conferida pela API (409 com a data), para não divergir.
 */
export function DeleteTenantDialog({ tenant, onClose, onDeleted }: DeleteTenantDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [typed, setTyped] = useState('');

  const remove = useMutation({
    mutationFn: () => platformApi.deleteTenant(tenant.id, typed),
    onSuccess: () => onDeleted(tenant),
  });

  const matches = typed === tenant.subdomain;

  return (
    <Dialog open onClose={remove.isPending ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>Excluir {tenant.name} definitivamente?</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Alert severity="error">
            <strong>Não tem volta.</strong> Todos os dados da clínica são apagados: pacientes, prontuários, agenda,
            financeiro, usuários e configurações. Fica só o registro de que a exclusão aconteceu.
          </Alert>
          {tenant.closureRequestedAt && (
            <Typography variant="body2">
              A clínica pediu o encerramento em <strong>{formatDateTime(tenant.closureRequestedAt)}</strong>. A exclusão
              só é aceita depois da carência.
            </Typography>
          )}
          <Box>
            <Typography variant="body2" gutterBottom>
              Para confirmar, digite o subdomínio da clínica:{' '}
              <Box component="strong" sx={{ fontFamily: 'monospace' }}>
                {tenant.subdomain}
              </Box>
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value.trim());
                remove.reset();
              }}
              autoComplete="off"
              autoFocus
              slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: 'monospace' } } }}
            />
          </Box>
          {remove.error != null && (
            <Alert severity="warning">
              {getErrorMessages(remove.error).map((message) => (
                <div key={message}>{humanizeDates(message)}</div>
              ))}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={remove.isPending}>
          Cancelar
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={!matches}
          loading={remove.isPending}
          onClick={() => remove.mutate()}
        >
          Excluir definitivamente
        </Button>
      </DialogActions>
    </Dialog>
  );
}
