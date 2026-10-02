import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
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
import LockOutlined from '@mui/icons-material/LockOutlined';
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined';
import { rolesApi, rolesKeys } from '@/api/roles';
import type { User } from '@/api/types';
import { usersApi, usersKeys } from '@/api/users';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { isRoleAbove } from '@/auth/privileges';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { ListPagination } from '@/components/ListPagination';
import { PageHeader } from '@/components/PageHeader';
import { formatDateTime } from '@/lib/format';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import { UserDialog } from './UserDialog';
import { USER_STATUS } from './userStatus';

type DialogState = { kind: 'create' } | { kind: 'edit'; user: User } | { kind: 'password'; user: User } | null;

const hideOnMobile = { display: { xs: 'none', md: 'table-cell' } } as const;

/** /usuarios — exige users:manage. Não há exclusão: desativa-se o usuário. */
export function UsersPage() {
  const tenantId = useTenantId();
  const { user: me, can } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dialog, setDialog] = useState<DialogState>(null);

  const query = useQuery({
    queryKey: usersKeys.list(tenantId, page, pageSize),
    queryFn: () => usersApi.list(tenantId, page, pageSize),
    placeholderData: keepPreviousData,
  });

  // Nome do papel e regra de privilégio dependem da lista de papéis (exige roles:manage).
  const canReadRoles = can('roles:manage');
  const roles = useQuery({
    queryKey: rolesKeys.all(tenantId),
    queryFn: () => rolesApi.listAll(tenantId),
    enabled: canReadRoles,
  });
  const rolesById = useMemo(() => new Map((roles.data ?? []).map((role) => [role.id, role])), [roles.data]);

  const actorPermissions = me?.permissions ?? [];
  const isAbove = (user: User) => {
    const role = rolesById.get(user.roleId);
    return role ? isRoleAbove(actorPermissions, role) : false;
  };

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Quem acessa o sistema da clínica. Para tirar o acesso de alguém, desative o usuário."
        actions={
          <Button
            variant="contained"
            startIcon={<PersonAddAlt1Outlined />}
            onClick={() => setDialog({ kind: 'create' })}
            disabled={!canReadRoles}
          >
            Novo usuário
          </Button>
        }
      />

      <Paper variant="outlined">
        <Box sx={{ height: 4 }}>{query.isFetching && <LinearProgress />}</Box>
        {query.error ? (
          <Box sx={{ p: 2 }}>
            <ErrorMessages error={query.error} />
          </Box>
        ) : query.data?.data.length === 0 ? (
          <EmptyState title="Nenhum usuário" />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell sx={hideOnMobile}>Email</TableCell>
                  <TableCell>Papel</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell sx={hideOnMobile}>Último acesso</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data?.data.map((user) => {
                  const status = USER_STATUS[user.status];
                  const above = isAbove(user);
                  return (
                    <TableRow
                      key={user.id}
                      hover
                      onClick={() => setDialog({ kind: 'edit', user })}
                      sx={{ cursor: 'pointer', opacity: user.status === 'disabled' ? 0.6 : 1 }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {user.name}
                          </Typography>
                          {user.id === me?.userId && <Chip size="small" label="você" variant="outlined" />}
                          {above && (
                            <Tooltip title="Tem permissões que você não tem: só leitura">
                              <LockOutlined fontSize="small" color="action" />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell sx={hideOnMobile}>{user.email}</TableCell>
                      <TableCell>{rolesById.get(user.roleId)?.name ?? '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={status.label} color={status.color} />
                      </TableCell>
                      <TableCell sx={{ ...hideOnMobile, whiteSpace: 'nowrap' }}>
                        {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Nunca'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {query.data && query.data.meta.total > 0 && (
          <ListPagination
            meta={query.data.meta}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        )}
      </Paper>

      {dialog?.kind === 'create' && <UserDialog roles={roles.data} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && (
        <UserDialog
          user={dialog.user}
          roles={roles.data}
          readOnly={isAbove(dialog.user)}
          onClose={() => setDialog(null)}
          onResetPassword={() => setDialog({ kind: 'password', user: dialog.user })}
        />
      )}
      {dialog?.kind === 'password' && <ResetPasswordDialog user={dialog.user} onClose={() => setDialog(null)} />}
    </>
  );
}
