import { Controller, useForm, useWatch } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import type { User } from '@/api/types';
import { usersApi } from '@/api/users';
import { useTenantId } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PasswordField } from '@/components/PasswordField';
import { useNotify } from '@/components/notifications/NotificationContext';
import { PasswordGenerator } from './PasswordGenerator';

export function ResetPasswordDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const tenantId = useTenantId();
  const notify = useNotify();

  const { control, handleSubmit, setValue } = useForm<{ password: string }>({ defaultValues: { password: '' } });
  const password = useWatch({ control, name: 'password' });

  const reset = useMutation({
    mutationFn: (value: string) => usersApi.resetPassword(tenantId, user.id, value),
    onSuccess: () => {
      notify(`Senha de ${user.name} redefinida. Repasse a nova senha.`);
      onClose();
    },
  });

  return (
    <Dialog open onClose={reset.isPending ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Redefinir senha</DialogTitle>
      <DialogContent dividers>
        <Stack
          spacing={2}
          component="form"
          id="reset-password-form"
          onSubmit={handleSubmit(({ password: value }) => reset.mutate(value))}
          noValidate
        >
          <Alert severity="warning">
            As sessões de {user.name} serão encerradas em todos os dispositivos. O próximo acesso será com a nova senha.
          </Alert>
          {/* Ajuda gerenciadores de senha a não confundirem com a senha de quem está logado. */}
          <input type="text" name="username" autoComplete="off" value={user.email} hidden readOnly />
          <Box>
            <Controller
              name="password"
              control={control}
              rules={{
                validate: (value) =>
                  value.length < 8 ? 'Mínimo de 8 caracteres' : value.length > 200 ? 'Máximo de 200 caracteres' : true,
              }}
              render={({ field, fieldState }) => (
                <PasswordField
                  label="Nova senha"
                  autoComplete="new-password"
                  autoFocus
                  {...field}
                  inputRef={field.ref}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? 'Mínimo de 8 caracteres.'}
                />
              )}
            />
            <PasswordGenerator
              value={password}
              onGenerate={(generated) => setValue('password', generated, { shouldValidate: true })}
            />
          </Box>
        </Stack>
      </DialogContent>
      {reset.error && (
        <Box sx={{ px: 3, pt: 2 }}>
          <ErrorMessages error={reset.error} />
        </Box>
      )}
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={reset.isPending}>
          Cancelar
        </Button>
        <Button type="submit" form="reset-password-form" variant="contained" loading={reset.isPending}>
          Redefinir
        </Button>
      </DialogActions>
    </Dialog>
  );
}
