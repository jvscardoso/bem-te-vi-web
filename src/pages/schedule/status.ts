import type { AppointmentStatus } from '@/api/types';

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Realizado',
  cancelled: 'Cancelado',
  no_show: 'Faltou',
};

export const STATUS_COLORS: Record<AppointmentStatus, 'default' | 'info' | 'primary' | 'success' | 'warning' | 'error'> =
  {
    scheduled: 'info',
    confirmed: 'primary',
    completed: 'success',
    cancelled: 'default',
    no_show: 'warning',
  };

/** Transições aceitas pela API (seção 10.3). */
export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ['confirmed', 'completed', 'no_show', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const isFinalStatus = (status: AppointmentStatus) => STATUS_TRANSITIONS[status].length === 0;

/** Status que ocupam horário (o padrão da grade). */
export const ACTIVE_STATUSES: AppointmentStatus[] = ['scheduled', 'confirmed', 'completed'];
export const ALL_STATUSES: AppointmentStatus[] = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];

/** Paleta para diferenciar profissionais na visão "todos". */
const PROFESSIONAL_COLORS = ['#1E88E5', '#8E24AA', '#00897B', '#F4511E', '#3949AB', '#C0CA33', '#6D4C41', '#D81B60'];

export function professionalColor(index: number): string {
  return PROFESSIONAL_COLORS[((index % PROFESSIONAL_COLORS.length) + PROFESSIONAL_COLORS.length) % PROFESSIONAL_COLORS.length];
}
