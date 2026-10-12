import type { ReactNode } from 'react';
import type { LayoutWidgetWidth } from '@/api/configs';
import type { PermissionKey } from '@/api/types';
import { SummaryCards } from '@/pages/billing/SummaryCards';
import { MonthCalendar } from './MonthCalendar';
import { OverdueCharges } from './OverdueCharges';
import { PatientsCard } from './PatientsCard';
import { TodayAgenda } from './TodayAgenda';
import { TodayCount } from './TodayCount';

export interface HomeWidgetDefinition {
  title: string;
  description: string;
  /** Quem vê: o bloco só aparece para quem tem a permissão (o layout é o mesmo para a clínica toda). */
  permission: PermissionKey;
  widths: LayoutWidgetWidth[];
  defaultWidth: LayoutWidgetWidth;
  render: () => ReactNode;
}

/**
 * Catálogo dos blocos da tela inicial. A API só guarda a lista (tipo, largura e ordem); o que
 * cada tipo mostra é daqui. Tipo novo não precisa de mudança na API; tipo removido daqui é
 * ignorado nos layouts já salvos.
 */
export const HOME_WIDGETS: Record<string, HomeWidgetDefinition> = {
  'financial-summary': {
    title: 'Resumo financeiro',
    description: 'Recebido no mês, a receber, em atraso e cancelado.',
    permission: 'billing:read',
    widths: ['full', 'two-thirds', 'half'],
    defaultWidth: 'full',
    render: () => <SummaryCards embedded />,
  },
  'today-count': {
    title: 'Atendimentos de hoje',
    description: 'Quantos atendimentos há hoje, quantos foram feitos e o próximo.',
    permission: 'appointments:read',
    widths: ['third', 'half', 'two-thirds', 'full'],
    defaultWidth: 'third',
    render: () => <TodayCount />,
  },
  patients: {
    title: 'Pacientes',
    description: 'Total de pacientes e busca rápida.',
    permission: 'patients:read',
    widths: ['third', 'half', 'two-thirds', 'full'],
    defaultWidth: 'third',
    render: () => <PatientsCard />,
  },
  'overdue-charges': {
    title: 'Cobranças em atraso',
    description: 'As cobranças vencidas mais antigas.',
    permission: 'billing:read',
    widths: ['third', 'half', 'two-thirds', 'full'],
    defaultWidth: 'third',
    render: () => <OverdueCharges />,
  },
  'today-agenda': {
    title: 'Agenda de hoje',
    description: 'Lista dos atendimentos do dia, com o próximo destacado.',
    permission: 'appointments:read',
    widths: ['half', 'two-thirds', 'full'],
    defaultWidth: 'two-thirds',
    render: () => <TodayAgenda />,
  },
  'month-calendar': {
    title: 'Calendário do mês',
    description: 'Quantos atendimentos há em cada dia; clicar abre o dia na agenda.',
    permission: 'appointments:read',
    widths: ['third', 'half', 'two-thirds', 'full'],
    defaultWidth: 'third',
    render: () => <MonthCalendar />,
  },
};
