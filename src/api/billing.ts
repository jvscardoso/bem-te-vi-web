import { api } from './client';
import type { BillingSummary, Charge, ChargeDetail, ChargeStatusFilter, Page, Payment, PaymentMethod, UUID } from './types';

export interface ChargeListParams {
  patientId?: UUID;
  status?: ChargeStatusFilter;
  /** Janela por vencimento (YYYY-MM-DD), inclusiva. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface ChargeInput {
  patientId: UUID;
  appointmentId?: UUID | null;
  description: string;
  amountCents: number;
  dueDate: string;
}

export interface PaymentInput {
  amountCents: number;
  method: PaymentMethod;
  paidAt?: string;
  notes?: string;
}

const base = (tenantId: UUID) => `/tenants/${tenantId}`;

export const billingKeys = {
  all: (tenantId: UUID) => ['billing', tenantId] as const,
  list: (tenantId: UUID, params: ChargeListParams) => ['billing', tenantId, 'list', params] as const,
  detail: (tenantId: UUID, id: UUID) => ['billing', tenantId, 'detail', id] as const,
  summary: (tenantId: UUID, from: string, to: string) => ['billing', tenantId, 'summary', from, to] as const,
};

export const billingApi = {
  list: (tenantId: UUID, params: ChargeListParams) => api.get<Page<Charge>>(`${base(tenantId)}/charges`, { ...params }),
  get: (tenantId: UUID, id: UUID) => api.get<ChargeDetail>(`${base(tenantId)}/charges/${id}`),
  create: (tenantId: UUID, input: ChargeInput) => api.post<Charge>(`${base(tenantId)}/charges`, input),
  update: (tenantId: UUID, id: UUID, input: Partial<ChargeInput>) =>
    api.patch<Charge>(`${base(tenantId)}/charges/${id}`, input),
  cancel: (tenantId: UUID, id: UUID) => api.delete(`${base(tenantId)}/charges/${id}`),
  addPayment: (tenantId: UUID, chargeId: UUID, input: PaymentInput) =>
    api.post<Payment>(`${base(tenantId)}/charges/${chargeId}/payments`, input),
  /** `pending`/`overdue`/`cancelled` são o estado atual; `paidInPeriod` soma pagamentos no período. */
  summary: (tenantId: UUID, from: string, to: string) =>
    api.get<BillingSummary>(`${base(tenantId)}/billing/summary`, { from, to }),
};
