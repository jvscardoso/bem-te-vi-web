import { api } from './client';
import type { Page, Patient, UUID } from './types';

export interface PatientAddress {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

/** Campos editáveis. No PATCH, `null` limpa o campo; ausente não mexe. */
export interface PatientInput {
  fullName: string;
  cpf?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: PatientAddress | null;
  notes?: string | null;
}

export interface PatientListParams {
  q?: string;
  page?: number;
  pageSize?: number;
}

const base = (tenantId: UUID) => `/tenants/${tenantId}/patients`;

export const patientsKeys = {
  all: (tenantId: UUID) => ['patients', tenantId] as const,
  list: (tenantId: UUID, params: PatientListParams) => ['patients', tenantId, 'list', params] as const,
  removed: (tenantId: UUID, params: PatientListParams) => ['patients', tenantId, 'removed', params] as const,
  detail: (tenantId: UUID, id: UUID) => ['patients', tenantId, 'detail', id] as const,
};

export const patientsApi = {
  list: (tenantId: UUID, params: PatientListParams) => api.get<Page<Patient>>(base(tenantId), { ...params }),
  removed: (tenantId: UUID, params: PatientListParams) =>
    api.get<Page<Patient>>(`${base(tenantId)}/removed`, { ...params }),
  get: (tenantId: UUID, id: UUID) => api.get<Patient>(`${base(tenantId)}/${id}`),
  create: (tenantId: UUID, input: PatientInput) => api.post<Patient>(base(tenantId), input),
  update: (tenantId: UUID, id: UUID, input: Partial<PatientInput>) =>
    api.patch<Patient>(`${base(tenantId)}/${id}`, input),
  remove: (tenantId: UUID, id: UUID) => api.delete(`${base(tenantId)}/${id}`),
  restore: (tenantId: UUID, id: UUID) => api.post<Patient>(`${base(tenantId)}/${id}/restore`),
};
