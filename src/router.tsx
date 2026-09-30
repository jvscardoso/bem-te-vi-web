import { createBrowserRouter, Navigate } from 'react-router';
import {
  ClinicAreaOnly,
  HomeRedirect,
  RedirectIfAuthenticated,
  RequireAuth,
  RequirePermission,
} from '@/auth/guards';
import { ShellLayout } from '@/layouts/ShellLayout';
import { clinicNavigation, platformNavigation } from '@/layouts/navigation';
import { MyAccountPage } from '@/pages/account/MyAccountPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { SignupPage } from '@/pages/SignupPage';

export const router = createBrowserRouter([
  {
    element: <RedirectIfAuthenticated />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/cadastro', element: <SignupPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <HomeRedirect /> },

      // App da clínica
      {
        element: <ClinicAreaOnly />,
        children: [
          {
            element: <ShellLayout navigation={clinicNavigation} />,
            children: [
              { path: '/inicio', element: <HomePage /> },
              {
                element: <RequirePermission permission="appointments:read" />,
                children: [{ path: '/agenda', element: <PlaceholderPage title="Agenda" /> }],
              },
              {
                element: <RequirePermission permission="patients:read" />,
                children: [{ path: '/pacientes', element: <PlaceholderPage title="Pacientes" /> }],
              },
              {
                element: <RequirePermission permission="billing:read" />,
                children: [{ path: '/financeiro', element: <PlaceholderPage title="Financeiro" /> }],
              },
              {
                element: <RequirePermission permission="anamnesis_templates:manage" />,
                children: [
                  { path: '/anamnese/formularios', element: <PlaceholderPage title="Formulários de anamnese" /> },
                ],
              },
              {
                element: <RequirePermission permission="users:manage" />,
                children: [{ path: '/usuarios', element: <PlaceholderPage title="Usuários" /> }],
              },
              {
                element: <RequirePermission permission="roles:manage" />,
                children: [{ path: '/papeis', element: <PlaceholderPage title="Papéis e permissões" /> }],
              },
              {
                element: <RequirePermission permission="tenant:manage" />,
                children: [{ path: '/configuracoes', element: <PlaceholderPage title="Configurações da clínica" /> }],
              },
              { path: '/minha-conta', element: <MyAccountPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },

      // Backoffice da plataforma
      {
        path: '/plataforma',
        element: <RequirePermission permission="platform:manage" />,
        children: [
          {
            element: <ShellLayout navigation={platformNavigation} areaLabel="Backoffice" />,
            children: [
              { index: true, element: <Navigate to="clinicas" replace /> },
              { path: 'clinicas', element: <PlaceholderPage title="Clínicas" /> },
              { path: 'minha-conta', element: <MyAccountPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
