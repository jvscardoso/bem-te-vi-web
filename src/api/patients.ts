import { api } from './client';
import type {
  AnamnesisFieldType,
  AppointmentStatus,
  ChargeStatus,
  ISODateTime,
  Page,
  Patient,
  PaymentMethod,
  UUID,
} from './types';

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

/** Arquivo de exportação dos dados do paciente (LGPD, `GET /patients/:id/export`). */
export interface PatientExport {
  format: 'bem-te-vi.patient-export';
  version: number;
  exportedAt: ISODateTime;
  clinic: { name: string };
  patient: Omit<Patient, 'tenantId'>;
  clinicalRecords: {
    id: UUID;
    createdAt: ISODateTime;
    form: { id: UUID; name: string };
    filledBy: { id: UUID; name: string } | null;
    /** Na ordem do formulário; `label`/`type` null = campo retirado do formulário depois da ficha. */
    answers: { key: string; label: string | null; type: AnamnesisFieldType | null; value: unknown }[];
  }[];
  appointments: {
    id: UUID;
    scheduledAt: ISODateTime;
    endsAt: ISODateTime;
    status: AppointmentStatus;
    notes: string | null;
    professional: { id: UUID; name: string };
  }[];
  charges: {
    id: UUID;
    description: string;
    amountCents: number;
    dueDate: ISODateTime;
    status: ChargeStatus;
    appointmentId: UUID | null;
    payments: { id: UUID; amountCents: number; method: PaymentMethod; paidAt: ISODateTime; notes: string | null }[];
  }[];
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
  /** Tudo o que a clínica guarda sobre o paciente, inclusive removido. Exige `patients:export` e fica na auditoria. */
  export: (tenantId: UUID, id: UUID) => api.get<PatientExport>(`${base(tenantId)}/${id}/export`),
};
