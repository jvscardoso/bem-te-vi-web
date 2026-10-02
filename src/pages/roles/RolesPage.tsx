import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { rolesApi, rolesKeys } from '@/api/roles';
import type { Role } from '@/api/types';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { isAdminRole, isRoleAbove } from '@/auth/privileges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/notifications/NotificationContext';
import { isApiError } from '@/lib/errors';
import { RoleDialog } from './RoleDialog';

type DialogState = { kind: 'create' } | { kind: 'edit'; role: Role } | { kind: 'delete'; role: Role } | null;

/** /papeis — exige roles:manage. */
export function RolesPage() {
  const tenantId = useTenantId();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [dialog, setDialog] = useState<DialogState>(null);

  const query = useQuery({ queryKey: rolesKeys.all(tenantId), queryFn: () => rolesApi.listAll(tenantId) });
  const actorPermissions = me?.permissions ?? [];

  const remove = useMutation({
    mutationFn: (id: string) => rolesApi.remove(tenantId, id),
    onSuccess: () => {
      setDialog(null);
      notify('Papel excluído.');
      return queryClient.invalidateQueries({ queryKey: rolesKeys.all(tenantId) });
    },
  });

  return (
    <>
      <PageHeader
        title="Papéis e permissões"
        subtitle="Cada usuário tem um papel; o papel define o que ele pode ver e fazer."
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setDialog({ kind: 'create' })}>
            Novo papel
          </Button>
        }
      />

      <Paper variant="outlined">
        <Box sx={{ height: 4 }}>{query.isFetching && <LinearProgress />}</Box>
        {query.error ? (
          <Box sx={{ p: 2 }}>
            <ErrorMessages error={query.error} />
          </Box>
        ) : query.data?.length === 0 ? (
          <EmptyState title="Nenhum papel" />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Papel</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Descrição</TableCell>
                  <TableCell align="right">Permissões</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data?.map((role) => {
                  const above = isRoleAbove(actorPermissions, role);
                  return (
                    <TableRow key={role.id} hover onClick={() => setDialog({ kind: 'edit', role })} sx={{ cursor: 'pointer' }}>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {role.name}
                          </Typography>
                          {isAdminRole(role) && <Chip size="small" color="primary" variant="outlined" label="Administrador" />}
                          {role.id === me?.roleId && <Chip size="small" variant="outlined" label="seu papel" />}
                          {above && (
                            <Tooltip title="Tem permissões que você não tem: só leitura">
                              <LockOutlined fontSize="small" color="action" />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary' }}>
                        {role.description || '—'}
                      </TableCell>
                      <TableCell align="right">{role.permissions.length}</TableCell>
                      <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                        {!above && (
                          <Tooltip title="Excluir">
                            <IconButton aria-label={`Excluir ${role.name}`} onClick={() => setDialog({ kind: 'delete', role })}>
                              <DeleteOutlineOutlined />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {dialog?.kind === 'create' && <RoleDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && (
        <RoleDialog
          role={dialog.role}
          readOnly={isRoleAbove(actorPermissions, dialog.role)}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title="Excluir papel?"
        description={
          <>
            O papel <strong>{dialog?.kind === 'delete' && dialog.role.name}</strong> será apagado definitivamente. Papéis com
            usuários vinculados não podem ser excluídos: troque o papel desses usuários antes.
          </>
        }
        confirmLabel="Excluir"
        confirmColor="error"
        loading={remove.isPending}
        error={
          isApiError(remove.error, 409)
            ? 'Este papel ainda tem usuários vinculados. Troque o papel deles em Usuários e tente de novo.'
            : remove.error
        }
        onConfirm={() => dialog?.kind === 'delete' && remove.mutate(dialog.role.id)}
        onClose={() => {
          setDialog(null);
          remove.reset();
        }}
      />
    </>
  );
}
