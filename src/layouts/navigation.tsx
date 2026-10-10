import type { ReactNode } from 'react';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import DomainOutlined from '@mui/icons-material/DomainOutlined';
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import PeopleOutlined from '@mui/icons-material/PeopleOutlined';
import PolicyOutlined from '@mui/icons-material/PolicyOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import type { PermissionRequirement } from '@/auth/permissions';

export interface NavItem {
  label: string;
  /** Rótulo do menu recolhido, quando o completo não cabe embaixo do ícone. */
  shortLabel?: string;
  path: string;
  icon: ReactNode;
  permission?: PermissionRequirement;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const clinicNavigation: NavSection[] = [
  {
    items: [
      { label: 'Início', path: '/inicio', icon: <DashboardOutlined /> },
      { label: 'Agenda', path: '/agenda', icon: <CalendarMonthOutlined />, permission: 'appointments:read' },
      { label: 'Pacientes', path: '/pacientes', icon: <PeopleOutlined />, permission: 'patients:read' },
      { label: 'Financeiro', path: '/financeiro', icon: <PaymentsOutlined />, permission: 'billing:read' },
    ],
  },
  {
    title: 'Administração',
    items: [
      {
        label: 'Formulários de anamnese',
        shortLabel: 'Anamnese',
        path: '/anamnese/formularios',
        icon: <AssignmentOutlined />,
        permission: 'anamnesis_templates:manage',
      },
      { label: 'Usuários', path: '/usuarios', icon: <ManageAccountsOutlined />, permission: 'users:manage' },
      {
        label: 'Papéis e permissões',
        shortLabel: 'Papéis',
        path: '/papeis',
        icon: <AdminPanelSettingsOutlined />,
        permission: 'roles:manage',
      },
      { label: 'Configurações', path: '/configuracoes', icon: <SettingsOutlined />, permission: 'tenant:manage' },
      { label: 'Auditoria', path: '/auditoria', icon: <PolicyOutlined />, permission: 'audit:read' },
    ],
  },
];

export const platformNavigation: NavSection[] = [
  { items: [{ label: 'Clínicas', path: '/plataforma/clinicas', icon: <DomainOutlined /> }] },
];
