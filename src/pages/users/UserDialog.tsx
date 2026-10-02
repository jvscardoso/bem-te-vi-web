import { Controller, useForm, useWatch } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { Role, User, UserStatus } from '@/api/types';
import { usersApi, usersKeys, type UserUpdateInput } from '@/api/users';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { isRoleAbove } from '@/auth/privileges';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PasswordField } from '@/components/PasswordField';
import { useNotify } from '@/components/notifications/NotificationContext';
import { PasswordGenerator } from './PasswordGenerator';
import { USER_STATUS } from './userStatus';

interface FormValues {
  name: string;
  email: string;
  roleId: string;
  status: UserStatus;
  duration: string;
  password: string;
}

interface UserDialogProps {
  user?: User;
  roles: Role[] | undefined;
  /** Usuário "acima" do ator: só leitura (a API recusaria qualquer alteração). */
  readOnly?: boolean;
  onClose: () => void;
  onResetPassword?: () => void;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function UserDialog({ user, roles, readOnly, onClose, onResetPassword }: UserDialogProps) {
  const tenantId = useTenantId();
  const { user: me, refresh } = useAuth();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const isSelf = !!user && user.id === me?.userId;
  const actorPermissions = me?.permissions ?? [];

  const {
    control,
    handleSubmit,
    setValue,
    formState: { dirtyFields },
  } = useForm<FormValues>({
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      roleId: user?.roleId ?? '',
      status: user?.status ?? 'active',
      duration: user?.defaultAppointmentDurationMinutes?.toString() ?? '',
      password: '',
    },
  });
  const password = useWatch({ control, name: 'password' });
  const roleId = useWatch({ control, name: 'roleId' });
  const status = useWatch({ control, name: 'status' });

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const duration = values.duration.trim() === '' ? null : Number(values.duration);
      if (!user) {
        return usersApi.create(tenantId, {
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          roleId: values.roleId,
          ...(duration !== null && { defaultAppointmentDurationMinutes: duration }),
        });
      }
      const update: UserUpdateInput = {};
      if (dirtyFields.name) update.name = values.name.trim();
      if (dirtyFields.email) update.email = values.email.trim();
      if (dirtyFields.roleId) update.roleId = values.roleId;
      if (dirtyFields.status) update.status = values.status;
      if (dirtyFields.duration) update.defaultAppointmentDurationMinutes = duration;
      return usersApi.update(tenantId, user.id, update);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersKeys.all(tenantId) });
      void queryClient.invalidateQueries({ queryKey: usersKeys.professionals(tenantId) });
      // Alterou o próprio papel: as permissões mudam na hora.
      if (isSelf) void refresh();
      notify(user ? 'Usuário atualizado.' : 'Usuário criado. Repasse a senha inicial.');
      onClose();
    },
  });

  const selectedRoleChanged = isSelf && roleId !== user?.roleId;

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>{user ? (readOnly ? 'Usuário' : 'Editar usuário') : 'Novo usuário'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} component="form" id="user-form" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
          {readOnly && (
            <Alert severity="info">
              Este usuário tem permissões que você não tem. Só um administrador com essas permissões pode alterá-lo.
            </Alert>
          )}

          <Controller
            name="name"
            control={control}
            rules={{ validate: (value) => !!value.trim() || 'Informe o nome' }}
            render={({ field, fieldState }) => (
              <TextField
                label="Nome"
                autoFocus={!user}
                {...field}
                inputRef={field.ref}
                disabled={readOnly}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="email"
            control={control}
            rules={{ validate: (value) => EMAIL.test(value.trim()) || 'Informe um email válido' }}
            render={({ field, fieldState }) => (
              <TextField
                label="Email (login)"
                type="email"
                {...field}
                inputRef={field.ref}
                disabled={readOnly}
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? 'Único em toda a plataforma.'}
              />
            )}
          />

          <Controller
            name="roleId"
            control={control}
            rules={{ required: 'Selecione o papel' }}
            render={({ field, fieldState }) => (
              <TextField
                select
                label="Papel"
                {...field}
                inputRef={field.ref}
                disabled={readOnly || !roles}
                // No campo, só o nome (a descrição aparece apenas na lista de opções).
                slotProps={{ select: { renderValue: (value) => roles?.find((role) => role.id === value)?.name ?? '' } }}
                error={!!fieldState.error}
                helperText={
                  fieldState.error?.message ??
                  (!roles ? 'Para escolher o papel é preciso a permissão de gerenciar papéis.' : undefined)
                }
              >
                {roles?.map((role) => {
                  // Só se atribui papel cujas permissões o ator também tem.
                  const above = isRoleAbove(actorPermissions, role);
                  return (
                    <MenuItem key={role.id} value={role.id} disabled={above}>
                      <ListItemText
                        primary={role.name}
                        secondary={above ? 'Tem permissões que você não tem' : role.description}
                      />
                    </MenuItem>
                  );
                })}
              </TextField>
            )}
          />
          {selectedRoleChanged && (
            <Alert severity="warning">Você está alterando o seu próprio papel e pode perder acesso a esta tela.</Alert>
          )}

          {isSelf && status !== 'active' && (
            <Alert severity="warning">Ao salvar, você perderá o acesso ao sistema imediatamente.</Alert>
          )}
          {user && (
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label="Situação"
                  {...field}
                  inputRef={field.ref}
                  disabled={readOnly}
                  helperText={USER_STATUS[field.value].hint}
                >
                  {(Object.keys(USER_STATUS) as UserStatus[]).map((status) => (
                    <MenuItem key={status} value={status}>
                      {USER_STATUS[status].label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          )}

          <Controller
            name="duration"
            control={control}
            rules={{
              validate: (value) =>
                value.trim() === '' ||
                (/^\d+$/.test(value) && Number(value) >= 5 && Number(value) <= 1440) ||
                'Informe um número entre 5 e 1440, ou deixe em branco',
            }}
            render={({ field, fieldState }) => (
              <TextField
                label="Duração padrão de atendimento"
                placeholder="Padrão da clínica"
                {...field}
                inputRef={field.ref}
                disabled={readOnly}
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? 'Deixe em branco para usar o padrão da clínica.'}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { inputMode: 'numeric' },
                  input: { endAdornment: <InputAdornment position="end">min</InputAdornment> },
                }}
              />
            )}
          />

          {!user && (
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
                    label="Senha inicial"
                    autoComplete="new-password"
                    {...field}
                    inputRef={field.ref}
                    error={!!fieldState.error}
                    helperText={
                      fieldState.error?.message ??
                      'Não há envio por email: repasse a senha ao usuário. Ele pode trocá-la em Minha conta.'
                    }
                  />
                )}
              />
              <PasswordGenerator
                value={password}
                onGenerate={(generated) => setValue('password', generated, { shouldValidate: true, shouldDirty: true })}
              />
            </Box>
          )}
        </Stack>
      </DialogContent>

      {save.error && (
        <Box sx={{ px: 3, pt: 2 }}>
          <ErrorMessages error={save.error} />
        </Box>
      )}

      <DialogActions sx={{ px: 3, py: 2 }}>
        {user && !readOnly && !isSelf && onResetPassword && (
          <Button onClick={onResetPassword} sx={{ mr: 'auto' }} disabled={save.isPending}>
            Redefinir senha
          </Button>
        )}
        <Button onClick={onClose} disabled={save.isPending}>
          {readOnly ? 'Fechar' : 'Cancelar'}
        </Button>
        {!readOnly && (
          <Button type="submit" form="user-form" variant="contained" loading={save.isPending}>
            {user ? 'Salvar' : 'Criar usuário'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
