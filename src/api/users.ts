import { api } from './client';
import type { Professional, User, UUID } from './types';

export const usersKeys = {
  professionals: (tenantId: UUID) => ['professionals', tenantId] as const,
};

export const usersApi = {
  /** Ajusta a própria duração padrão de atendimento (null = usa a da clínica). */
  updateMyAppointmentSettings: (tenantId: UUID, defaultAppointmentDurationMinutes: number | null) =>
    api.patch<User>(`/tenants/${tenantId}/users/me/appointment-settings`, { defaultAppointmentDurationMinutes }),

  /** Usuários ativos que podem receber agendamentos (exige só appointments:read). */
  professionals: (tenantId: UUID) => api.get<Professional[]>(`/tenants/${tenantId}/professionals`),
};
