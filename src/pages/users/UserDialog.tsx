import { useState } from 'react';
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
  FormControl,
  FormControlLabel,
  FormLabel,
  InputAdornment,
  ListItemText,
  MenuItem,
  Radio,
  RadioGroup,
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
import { applyFieldErrors } from '@/lib/errors';
import { PasswordGenerator } from './PasswordGenerator';
import { USER_STATUS } from './userStatus';

interface FormValues {
  name: string;
  email: string;
  roleId: string;
  status: UserStatus;
  duration: string;
  /** Criação: convite por email (a pessoa cria a senha) ou senha definida pelo admin. */
  access: 'invite' | 'password';
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
  const { user: me, refresh, readOnly: subscriptionReadOnly } = useAuth();
  // Sem poder salvar: usuário acima de quem edita, ou clínica em só leitura (assinatura).
  const locked = readOnly || subscriptionReadOnly;
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
    setError,
    formState: { dirtyFields },
  } = useForm<FormValues>({
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      roleId: user?.roleId ?? '',
      status: user?.status ?? 'active',
      duration: user?.defaultAppointmentDurationMinutes?.toString() ?? '',
      access: 'invite',
      password: '',
    },
  });
  const password = useWatch({ control, name: 'password' });
  const roleId = useWatch({ control, name: 'roleId' });
  const status = useWatch({ control, name: 'status' });
  const access = useWatch({ control, name: 'access' });
  // O que sobra para a área de erros depois de pôr os erros por campo nos campos.
  const [areaError, setAreaError] = useState<unknown>(null);
  // A duração própria só vale para quem atende (`appointments:attend`). Com a lista de papéis
  // (roles:manage), segue o papel escolhido no formulário; sem ela, o que a API diz do usuário.
  // Na criação sem a lista, mostra: a API aceita e ignora para quem não atende.
  const selectedRole = roles?.find((role) => role.id === roleId);
  const attends = selectedRole
    ? selectedRole.permissions.some(({ permission }) => permission.key === 'appointments:attend')
    : (user?.attendsPatients ?? true);
  // Convidado só fica ativo aceitando o convite; para os demais, "convidado" não é uma opção.
  const statusOptions: UserStatus[] = user?.status === 'invited' ? ['invited', 'disabled'] : ['active', 'disabled'];

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      // O campo de duração sai do formulário (shouldUnregister) quando o papel não atende.
      const durationText = values.duration?.trim() ?? '';
      const duration = durationText === '' ? null : Number(durationText);
      if (!user) {
        return usersApi.create(tenantId, {
          name: values.name.trim(),
          email: values.email.trim(),
          // Sem senha, a API cria o usuário como convidado e envia o convite por email.
          ...(values.access === 'password' && { password: values.password }),
          roleId: values.roleId,
          ...(attends && duration !== null && { defaultAppointmentDurationMinutes: duration }),
        });
      }
      const update: UserUpdateInput = {};
      if (dirtyFields.name) update.name = values.name.trim();
      if (dirtyFields.email) update.email = values.email.trim();
      if (dirtyFields.roleId) update.roleId = values.roleId;
      if (dirtyFields.status) update.status = values.status;
      if (attends && dirtyFields.duration) update.defaultAppointmentDurationMinutes = duration;
      return usersApi.update(tenantId, user.id, update);
    },
    onMutate: () => setAreaError(null),
    onError: (error) =>
      setAreaError(
        applyFieldErrors(error, setError, ['name', 'email', 'password', 'roleId', 'status'], {
          defaultAppointmentDurationMinutes: 'duration',
        }),
      ),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: usersKeys.all(tenantId) });
      void queryClient.invalidateQueries({ queryKey: usersKeys.professionals(tenantId) });
      // Alterou o próprio papel: as permissões mudam na hora.
      if (isSelf) void refresh();
      notify(
        user
          ? 'Usuário atualizado.'
          : saved.status === 'invited'
            ? `Convite enviado para ${saved.email}. O link vale por 7 dias.`
            : 'Usuário criado. Repasse a senha inicial.',
      );
      onClose();
    },
  });

  const resendInvite = useMutation({
    mutationFn: () => usersApi.resendInvite(tenantId, user!.id),
    onSuccess: () => notify('Convite reenviado. O link anterior não vale mais.'),
  });

  const selectedRoleChanged = isSelf && roleId !== user?.roleId;

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>{user ? (locked ? 'Usuário' : 'Editar usuário') : 'Novo usuário'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} component="form" id="user-form" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
          {readOnly && (
            <Alert severity="info">
              Este usuário tem permissões que você não tem. Só um administrador com essas permissões pode alterá-lo.
            </Alert>
          )}
          {subscriptionReadOnly && (
            <Alert severity="warning">A clínica está em modo só leitura: as alterações voltam com a assinatura regularizada.</Alert>
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
                disabled={locked}
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
                disabled={locked}
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
                disabled={locked || !roles}
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
                  disabled={locked}
                  helperText={USER_STATUS[field.value].hint}
                >
                  {statusOptions.map((status) => (
                    <MenuItem key={status} value={status}>
                      {USER_STATUS[status].label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          )}

          {attends && (
            <Controller
              name="duration"
              control={control}
              shouldUnregister
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
                  disabled={locked}
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
          )}

          {!user && (
            <Controller
              name="access"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <FormLabel>Acesso</FormLabel>
                  <RadioGroup {...field}>
                    <FormControlLabel
                      value="invite"
                      control={<Radio />}
                      label="Enviar convite por email — a pessoa cria a própria senha (link válido por 7 dias)"
                    />
                    <FormControlLabel value="password" control={<Radio />} label="Definir senha agora" />
                  </RadioGroup>
                </FormControl>
              )}
            />
          )}

          {!user && access === 'password' && (
            <Box>
              <Controller
                name="password"
                control={control}
                rules={{
                  validate: (value, values) =>
                    values.access !== 'password' ||
                    (value.length < 8 ? 'Mínimo de 8 caracteres' : value.length > 200 ? 'Máximo de 200 caracteres' : true),
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
                      'Repasse a senha ao usuário. Ele pode trocá-la em Minha conta.'
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

      {(areaError || resendInvite.error) && (
        <Box sx={{ px: 3, pt: 2 }}>
          <ErrorMessages error={areaError ?? resendInvite.error} />
        </Box>
      )}

      <DialogActions sx={{ px: 3, py: 2 }}>
        {/* Convidado ainda não tem senha: redefinir não o ativaria. O caminho é reenviar o convite. */}
        {user && !locked && user.status === 'invited' && (
          <Button
            onClick={() => resendInvite.mutate()}
            loading={resendInvite.isPending}
            sx={{ mr: 'auto' }}
            disabled={save.isPending}
          >
            Reenviar convite
          </Button>
        )}
        {user && !locked && !isSelf && user.status !== 'invited' && onResetPassword && (
          <Button onClick={onResetPassword} sx={{ mr: 'auto' }} disabled={save.isPending}>
            Redefinir senha
          </Button>
        )}
        <Button onClick={onClose} disabled={save.isPending}>
          {locked ? 'Fechar' : 'Cancelar'}
        </Button>
        {!locked && (
          <Button type="submit" form="user-form" variant="contained" loading={save.isPending}>
            {user ? 'Salvar' : 'Criar usuário'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
