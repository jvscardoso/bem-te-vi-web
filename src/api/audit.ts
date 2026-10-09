import { api } from './client';
import type { ISODateTime, Page, UUID } from './types';

export type AuditAction =
  | 'patient.list'
  | 'patient.list_removed'
  | 'patient.view'
  | 'patient.create'
  | 'patient.update'
  | 'patient.delete'
  | 'patient.restore'
  | 'clinical_record.list'
  | 'clinical_record.create'
  | 'patient.export'
  | 'tenant.export'
  | 'tenant.closure_requested'
  | 'tenant.closure_cancelled';

export interface AuditFieldChange {
  from: unknown;
  to: unknown;
}

export interface AuditLogEntry {
  id: UUID;
  action: AuditAction;
  patientId: UUID | null;
  actorUserId: UUID;
  /** `name` é null se o usuário foi apagado do banco (o registro sobrevive a ele). */
  actor: { id: UUID; name: string | null };
  entityType: string | null;
  entityId: UUID | null;
  /** Varia por ação: `{ changes }` em `patient.update`, `{ q, page, pageSize, total }` nas listas, `{ count }`… */
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: ISODateTime;
}

export interface AuditLogParams {
  patientId?: UUID;
  actorUserId?: UUID;
  action?: AuditAction;
  /** ISO 8601, inclusivo. */
  from?: ISODateTime;
  to?: ISODateTime;
  page?: number;
  pageSize?: number;
}

export const auditKeys = {
  all: (tenantId: UUID) => ['audit-logs', tenantId] as const,
  list: (tenantId: UUID, params: AuditLogParams) => ['audit-logs', tenantId, params] as const,
};

/** Trilha de auditoria (LGPD), só leitura, do mais recente para o mais antigo. Exige `audit:read`. */
export const auditApi = {
  list: (tenantId: UUID, params: AuditLogParams) =>
    api.get<Page<AuditLogEntry>>(`/tenants/${tenantId}/audit-logs`, { ...params }),
};
