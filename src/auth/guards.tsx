import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Button } from '@mui/material';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { StatusScreen } from '@/components/StatusScreen';
import { getErrorMessages } from '@/lib/errors';
import { useAuth } from './AuthContext';
import { PendingLegalScreen } from './PendingLegalScreen';
import { isPlatformUser, type PermissionRequirement } from './permissions';

/** Exige sessão válida; sem ela, vai para o login lembrando o destino. */
export function RequireAuth() {
  const { status, user, error, refresh, logout } = useAuth();
  const location = useLocation();

  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'error') {
    return (
      <StatusScreen
        fullScreen
        title="Não foi possível carregar sua sessão"
        description={getErrorMessages(error)[0]}
        action={
          <>
            <Button variant="contained" onClick={() => refresh()}>
              Tentar novamente
            </Button>
            <Button onClick={logout}>Sair</Button>
          </>
        }
      />
    );
  }
  // Termos/Política pendentes: nada do app (clínica ou plataforma) aparece até o aceite.
  if (user?.pendingLegalDocuments?.length) return <PendingLegalScreen pending={user.pendingLegalDocuments} />;
  return <Outlet />;
}

/** Telas públicas de entrada (login, esqueci minha senha): quem já está logado vai para o app. */
export function RedirectIfAuthenticated() {
  const { status } = useAuth();
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Mostra aviso de acesso negado quando faltam permissões. */
export function RequirePermission({ permission, children }: { permission: PermissionRequirement; children?: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <StatusScreen
        title="Acesso negado"
        description="Você não tem permissão para acessar esta página. Fale com o administrador da clínica."
      />
    );
  }
  return children ?? <Outlet />;
}

/** Área da clínica: usuários da plataforma vão para o backoffice. */
export function ClinicAreaOnly() {
  const { user } = useAuth();
  if (user && isPlatformUser(user.permissions)) return <Navigate to="/plataforma" replace />;
  return <Outlet />;
}

export function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user && isPlatformUser(user.permissions) ? '/plataforma' : '/inicio'} replace />;
}
