import { Controller, useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { rolesApi, rolesKeys } from '@/api/roles';
import type { PermissionKey, Role } from '@/api/types';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { ADMIN_PERMISSIONS, rolePermissionKeys } from '@/auth/privileges';
import { ErrorMessages } from '@/components/ErrorMessages';
import { useNotify } from '@/components/notifications/NotificationContext';
import { groupCatalog, hasNoAgenda, togglePermission } from './permissionGroups';

interface FormValues {
  name: string;
  description: string;
  permissions: PermissionKey[];
}

interface RoleDialogProps {
  role?: Role;
  /** Papel "acima" do ator: só leitura. */
  readOnly?: boolean;
  onClose: () => void;
}

export function RoleDialog({ role, readOnly, onClose }: RoleDialogProps) {
  const tenantId = useTenantId();
  const { user: me, refresh, readOnly: subscriptionReadOnly } = useAuth();
  // Sem poder salvar: papel acima de quem edita, ou clínica em só leitura (assinatura).
  const locked = readOnly || subscriptionReadOnly;
  const queryClient = useQueryClient();
  const notify = useNotify();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const actorPermissions = me?.permissions ?? [];
  const isOwnRole = !!role && role.id === me?.roleId;

  const catalog = useQuery({ queryKey: rolesKeys.permissions, queryFn: rolesApi.permissions, staleTime: Infinity });

  const { control, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: {
      name: role?.name ?? '',
      description: role?.description ?? '',
      permissions: role ? rolePermissionKeys(role) : [],
    },
  });
  const selected = useWatch({ control, name: 'permissions' });
  const isAdmin = ADMIN_PERMISSIONS.every((key) => selected.includes(key));
  // Tirar permissões do próprio papel reduz o próprio acesso na hora.
  const losingOwnAccess = isOwnRole && rolePermissionKeys(role!).some((key) => !selected.includes(key));

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const byKey = new Map((catalog.data ?? []).map((permission) => [permission.key, permission.id]));
      const permissionIds = values.permissions.flatMap((key) => byKey.get(key) ?? []);
      const description = values.description.trim() || null;
      if (!role) return rolesApi.create(tenantId, { name: values.name.trim(), description, permissionIds });

      const dirty = formState.dirtyFields;
      return rolesApi.update(tenantId, role.id, {
        ...(dirty.name && { name: values.name.trim() }),
        ...(dirty.description && { description }),
        // No PATCH, a lista enviada substitui a anterior.
        ...(dirty.permissions && { permissionIds }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rolesKeys.all(tenantId) });
      if (isOwnRole) void refresh();
      notify(role ? 'Papel atualizado.' : 'Papel criado.');
      onClose();
    },
  });

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {role ? (locked ? 'Papel' : 'Editar papel') : 'Novo papel'}
        {isAdmin && <Chip size="small" color="primary" label="Administrador" />}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} component="form" id="role-form" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
          {readOnly && (
            <Alert severity="info">
              Este papel tem permissões que você não tem. Só um administrador com essas permissões pode alterá-lo.
            </Alert>
          )}
          {subscriptionReadOnly && (
            <Alert severity="warning">A clínica está em modo só leitura: as alterações voltam com a assinatura regularizada.</Alert>
          )}

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' } }}>
            <Controller
              name="name"
              control={control}
              rules={{
                validate: (value) =>
                  !value.trim() ? 'Informe o nome' : value.length > 80 ? 'Máximo de 80 caracteres' : true,
              }}
              render={({ field, fieldState }) => (
                <TextField
                  label="Nome"
                  autoFocus={!role}
                  {...field}
                  inputRef={field.ref}
                  disabled={locked}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Descrição (opcional)"
                  placeholder="Ex.: Agenda e cadastro de pacientes"
                  {...field}
                  inputRef={field.ref}
                  disabled={locked}
                />
              )}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Permissões
            </Typography>
            {catalog.error ? (
              <ErrorMessages error={catalog.error} />
            ) : !catalog.data ? (
              <Skeleton variant="rounded" height={200} />
            ) : (
              <Controller
                name="permissions"
                control={control}
                render={({ field }) => (
                  <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
                    {groupCatalog(catalog.data!).map((group) => (
                      <Paper key={group.title} variant="outlined" sx={{ p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                          {group.title}
                        </Typography>
                        <Stack>
                          {group.permissions.map((permission) => {
                            // Só se concede o que se possui (a API recusaria com 403).
                            const notOwned = !actorPermissions.includes(permission.key);
                            const option = (
                              <FormControlLabel
                                disabled={locked || notOwned}
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={field.value.includes(permission.key)}
                                    onChange={(_, checked) =>
                                      field.onChange(togglePermission(field.value, permission.key, checked))
                                    }
                                  />
                                }
                                label={
                                  <Box>
                                    <Typography variant="body2">{permission.description ?? permission.key}</Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                      {permission.key}
                                    </Typography>
                                  </Box>
                                }
                                sx={{ alignItems: 'flex-start', my: 0.25, '& .MuiCheckbox-root': { pt: 0.5 } }}
                              />
                            );
                            return notOwned && !locked ? (
                              <Tooltip key={permission.key} title="Você não tem esta permissão, então não pode concedê-la" placement="top-start">
                                <span>{option}</span>
                              </Tooltip>
                            ) : (
                              <Box key={permission.key}>{option}</Box>
                            );
                          })}
                        </Stack>
                      </Paper>
                    ))}
                  </Box>
                )}
              />
            )}
            {isAdmin && (
              <FormHelperText>
                Com Usuários, Papéis e Configurações da clínica, este papel é de administrador. A clínica precisa manter
                ao menos um administrador ativo.
              </FormHelperText>
            )}
          </Box>

          {hasNoAgenda(selected) && (
            <Alert severity="warning">
              Este papel vê a agenda, mas não tem nenhuma para ver: sem "todas as agendas" ele só veria a própria, e sem
              "atende pacientes" não tem agenda própria. Marque uma das duas, ou tire a agenda do papel.
            </Alert>
          )}

          {losingOwnAccess && !locked && (
            <Alert severity="warning">
              Este é o seu papel: ao remover permissões, você perde esses acessos assim que salvar.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      {save.error && (
        <Box sx={{ px: 3, pt: 2 }}>
          <ErrorMessages error={save.error} />
        </Box>
      )}

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={save.isPending}>
          {locked ? 'Fechar' : 'Cancelar'}
        </Button>
        {!locked && (
          <Button
            type="submit"
            form="role-form"
            variant="contained"
            loading={save.isPending}
            disabled={!catalog.data || (!!role && !formState.isDirty)}
          >
            {role ? 'Salvar' : 'Criar papel'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
