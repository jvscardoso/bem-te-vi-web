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
import { BillingPage } from '@/pages/billing/BillingPage';
import { ChargeDetailPage } from '@/pages/billing/ChargeDetailPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { TemplateEditorPage } from '@/pages/anamnesis/templates/TemplateEditorPage';
import { TemplatesListPage } from '@/pages/anamnesis/templates/TemplatesListPage';
import { FillAnamnesisPage } from '@/pages/patients/anamnesis/FillAnamnesisPage';
import { PatientDetailPage } from '@/pages/patients/PatientDetailPage';
import { PatientFormPage } from '@/pages/patients/PatientFormPage';
import { PatientsListPage } from '@/pages/patients/PatientsListPage';
import { RemovedPatientsPage } from '@/pages/patients/RemovedPatientsPage';
import { SchedulePage } from '@/pages/schedule/SchedulePage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
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
                children: [{ path: '/agenda', element: <SchedulePage /> }],
              },
              {
                element: <RequirePermission permission="patients:read" />,
                children: [
                  { path: '/pacientes', element: <PatientsListPage /> },
                  { path: '/pacientes/:id', element: <PatientDetailPage /> },
                  {
                    element: <RequirePermission permission="patients:write" />,
                    children: [
                      { path: '/pacientes/novo', element: <PatientFormPage /> },
                      { path: '/pacientes/removidos', element: <RemovedPatientsPage /> },
                      { path: '/pacientes/:id/editar', element: <PatientFormPage /> },
                      { path: '/pacientes/:id/anamneses/nova', element: <FillAnamnesisPage /> },
                    ],
                  },
                ],
              },
              {
                element: <RequirePermission permission="billing:read" />,
                children: [
                  { path: '/financeiro', element: <BillingPage /> },
                  { path: '/financeiro/cobrancas/:id', element: <ChargeDetailPage /> },
                ],
              },
              {
                element: <RequirePermission permission="anamnesis_templates:manage" />,
                children: [
                  { path: '/anamnese/formularios', element: <TemplatesListPage /> },
                  { path: '/anamnese/formularios/novo', element: <TemplateEditorPage /> },
                  { path: '/anamnese/formularios/:id', element: <TemplateEditorPage /> },
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
                children: [{ path: '/configuracoes', element: <SettingsPage /> }],
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
