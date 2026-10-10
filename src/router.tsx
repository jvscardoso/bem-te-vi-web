import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import {
  ClinicAreaOnly,
  HomeRedirect,
  RedirectIfAuthenticated,
  RequireAuth,
  RequirePermission,
} from '@/auth/guards';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { PatientSearch } from '@/layouts/PatientSearch';
import { ShellLayout } from '@/layouts/ShellLayout';
import { clinicNavigation, platformNavigation } from '@/layouts/navigation';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * Tela carregada sob demanda: vira um arquivo JS separado, baixado só quando a
 * rota é aberta pela primeira vez. Login, layout e guards ficam no pacote inicial.
 */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return async () => ({ Component: (await load())[name] });
}

export const router = createBrowserRouter([
  {
    // Exibido enquanto a tela de uma URL aberta diretamente é baixada.
    HydrateFallback: FullScreenLoader,
    children: [
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/cadastro', lazy: page(() => import('@/pages/SignupPage'), 'SignupPage') },
          {
            path: '/esqueci-minha-senha',
            lazy: page(() => import('@/pages/ForgotPasswordPage'), 'ForgotPasswordPage'),
          },
        ],
      },
      // Links de email: acessíveis mesmo com sessão aberta (a troca de senha a encerra).
      {
        path: '/reset-password',
        lazy: page(() => import('@/pages/auth/ResetPasswordPage'), 'ResetPasswordPage'),
      },
      // Textos legais: públicos, abertos em outra aba a partir do cadastro e do convite.
      { path: '/termos', lazy: page(() => import('@/pages/legal/LegalDocumentPage'), 'TermsPage') },
      { path: '/privacidade', lazy: page(() => import('@/pages/legal/LegalDocumentPage'), 'PrivacyPage') },
      {
        path: '/accept-invite',
        lazy: page(() => import('@/pages/auth/AcceptInvitePage'), 'AcceptInvitePage'),
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
                element: <ShellLayout navigation={clinicNavigation} search={<PatientSearch />} />,
                children: [
                  { path: '/inicio', lazy: page(() => import('@/pages/home/HomePage'), 'HomePage') },
                  {
                    element: <RequirePermission permission="appointments:read" />,
                    children: [
                      { path: '/agenda', lazy: page(() => import('@/pages/schedule/SchedulePage'), 'SchedulePage') },
                    ],
                  },
                  {
                    element: <RequirePermission permission="patients:read" />,
                    children: [
                      {
                        path: '/pacientes',
                        lazy: page(() => import('@/pages/patients/PatientsListPage'), 'PatientsListPage'),
                      },
                      {
                        path: '/pacientes/:id',
                        lazy: page(() => import('@/pages/patients/PatientDetailPage'), 'PatientDetailPage'),
                      },
                      {
                        element: <RequirePermission permission="patients:write" />,
                        children: [
                          {
                            path: '/pacientes/novo',
                            lazy: page(() => import('@/pages/patients/PatientFormPage'), 'PatientFormPage'),
                          },
                          {
                            path: '/pacientes/removidos',
                            lazy: page(() => import('@/pages/patients/RemovedPatientsPage'), 'RemovedPatientsPage'),
                          },
                          {
                            path: '/pacientes/:id/editar',
                            lazy: page(() => import('@/pages/patients/PatientFormPage'), 'PatientFormPage'),
                          },
                          {
                            path: '/pacientes/:id/anamneses/nova',
                            lazy: page(() => import('@/pages/patients/anamnesis/FillAnamnesisPage'), 'FillAnamnesisPage'),
                          },
                        ],
                      },
                    ],
                  },
                  {
                    element: <RequirePermission permission="billing:read" />,
                    children: [
                      { path: '/financeiro', lazy: page(() => import('@/pages/billing/BillingPage'), 'BillingPage') },
                      {
                        path: '/financeiro/cobrancas/:id',
                        lazy: page(() => import('@/pages/billing/ChargeDetailPage'), 'ChargeDetailPage'),
                      },
                    ],
                  },
                  {
                    element: <RequirePermission permission="anamnesis_templates:manage" />,
                    children: [
                      {
                        path: '/anamnese/formularios',
                        lazy: page(() => import('@/pages/anamnesis/templates/TemplatesListPage'), 'TemplatesListPage'),
                      },
                      {
                        path: '/anamnese/formularios/novo',
                        lazy: page(() => import('@/pages/anamnesis/templates/TemplateEditorPage'), 'TemplateEditorPage'),
                      },
                      {
                        path: '/anamnese/formularios/:id',
                        lazy: page(() => import('@/pages/anamnesis/templates/TemplateEditorPage'), 'TemplateEditorPage'),
                      },
                    ],
                  },
                  {
                    element: <RequirePermission permission="users:manage" />,
                    children: [{ path: '/usuarios', lazy: page(() => import('@/pages/users/UsersPage'), 'UsersPage') }],
                  },
                  {
                    element: <RequirePermission permission="roles:manage" />,
                    children: [{ path: '/papeis', lazy: page(() => import('@/pages/roles/RolesPage'), 'RolesPage') }],
                  },
                  {
                    element: <RequirePermission permission="audit:read" />,
                    children: [{ path: '/auditoria', lazy: page(() => import('@/pages/audit/AuditPage'), 'AuditPage') }],
                  },
                  {
                    element: <RequirePermission permission="tenant:manage" />,
                    children: [
                      {
                        path: '/configuracoes',
                        lazy: page(() => import('@/pages/settings/SettingsPage'), 'SettingsPage'),
                      },
                    ],
                  },
                  {
                    path: '/minha-conta',
                    lazy: page(() => import('@/pages/account/MyAccountPage'), 'MyAccountPage'),
                  },
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
                  { path: 'clinicas', lazy: page(() => import('@/pages/platform/TenantsPage'), 'TenantsPage') },
                  {
                    path: 'minha-conta',
                    lazy: page(() => import('@/pages/account/MyAccountPage'), 'MyAccountPage'),
                  },
                  { path: '*', element: <NotFoundPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
