import { api } from './client';
import type { Page, Professional, User, UserStatus, UUID } from './types';

export interface UserCreateInput {
  name: string;
  email: string;
  /** Sem senha: o usuário nasce `invited` e recebe um convite por email (link de 7 dias). */
  password?: string;
  roleId: UUID;
  defaultAppointmentDurationMinutes?: number | null;
}

/** Senha não é editável aqui (ver resetPassword). */
export interface UserUpdateInput {
  name?: string;
  email?: string;
  roleId?: UUID;
  status?: UserStatus;
  defaultAppointmentDurationMinutes?: number | null;
}

const base = (tenantId: UUID) => `/tenants/${tenantId}/users`;

export const usersKeys = {
  all: (tenantId: UUID) => ['users', tenantId] as const,
  list: (tenantId: UUID, page: number, pageSize: number) => ['users', tenantId, 'list', page, pageSize] as const,
  professionals: (tenantId: UUID) => ['professionals', tenantId] as const,
};

export const usersApi = {
  list: (tenantId: UUID, page: number, pageSize: number) => api.get<Page<User>>(base(tenantId), { page, pageSize }),
  create: (tenantId: UUID, input: UserCreateInput) => api.post<User>(base(tenantId), input),
  update: (tenantId: UUID, id: UUID, input: UserUpdateInput) => api.patch<User>(`${base(tenantId)}/${id}`, input),
  /** Reenvia o convite de um usuário `invited`. O link anterior deixa de valer. 204 sem corpo. */
  resendInvite: (tenantId: UUID, id: UUID) => api.post<void>(`${base(tenantId)}/${id}/invite`),

  /** Redefine a senha de outro usuário e encerra as sessões dele. 204 sem corpo. */
  resetPassword: (tenantId: UUID, id: UUID, password: string) =>
    api.patch<void>(`${base(tenantId)}/${id}/password`, { password }),

  /** Ajusta a própria duração padrão de atendimento (null = usa a da clínica). */
  updateMyAppointmentSettings: (tenantId: UUID, defaultAppointmentDurationMinutes: number | null) =>
    api.patch<User>(`${base(tenantId)}/me/appointment-settings`, { defaultAppointmentDurationMinutes }),

  /** Usuários ativos que podem receber agendamentos (exige só appointments:read). */
  professionals: (tenantId: UUID) => api.get<Professional[]>(`/tenants/${tenantId}/professionals`),
};
