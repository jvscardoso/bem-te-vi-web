import { api } from './client';
import type { Appointment, AppointmentStatus, Page, UUID } from './types';

export interface AppointmentListParams {
  professionalId?: UUID;
  patientId?: UUID;
  /** ISO 8601. A janela é por sobreposição: entram os que terminam depois de `from` e começam até `to`. */
  from?: string;
  to?: string;
  status?: AppointmentStatus[];
  page?: number;
  pageSize?: number;
}

export interface AppointmentInput {
  patientId: UUID;
  professionalId: UUID;
  scheduledAt: string;
  /** Opcional na criação: sem ele, fim = início + duração do profissional. */
  endsAt?: string;
  notes?: string | null;
}

export type AppointmentUpdate = Partial<AppointmentInput> & { status?: AppointmentStatus };

const base = (tenantId: UUID) => `/tenants/${tenantId}/appointments`;

export const appointmentsKeys = {
  all: (tenantId: UUID) => ['appointments', tenantId] as const,
  range: (tenantId: UUID, params: AppointmentListParams) => ['appointments', tenantId, 'range', params] as const,
  list: (tenantId: UUID, params: AppointmentListParams) => ['appointments', tenantId, 'list', params] as const,
};

function toQuery({ status, ...params }: AppointmentListParams) {
  return { ...params, status: status?.length ? status : undefined };
}

export const appointmentsApi = {
  list: (tenantId: UUID, params: AppointmentListParams) =>
    api.get<Page<Appointment>>(base(tenantId), toQuery(params)),

  /** Todos os agendamentos de uma janela (percorre as páginas de 200). */
  async listAll(tenantId: UUID, params: Omit<AppointmentListParams, 'page' | 'pageSize'>): Promise<Appointment[]> {
    const first = await appointmentsApi.list(tenantId, { ...params, page: 1, pageSize: 200 });
    const items = [...first.data];
    for (let page = 2; page <= first.meta.totalPages; page++) {
      const next = await appointmentsApi.list(tenantId, { ...params, page, pageSize: 200 });
      items.push(...next.data);
    }
    return items;
  },

  create: (tenantId: UUID, input: AppointmentInput) => api.post<Appointment>(base(tenantId), input),
  update: (tenantId: UUID, id: UUID, input: AppointmentUpdate) => api.patch<Appointment>(`${base(tenantId)}/${id}`, input),
  cancel: (tenantId: UUID, id: UUID) => api.delete(`${base(tenantId)}/${id}`),
};
