export type UUID = string;
export type ISODateTime = string; // "2026-10-01T13:00:00.000Z"
export type ISODate = string;     // "2026-10-01"

export interface Page<T> { data: T[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }
export interface ApiError { statusCode: number; error: string; message: string | string[]; removedPatientId?: UUID }

export type PermissionKey =
  | 'patients:read' | 'patients:write'
  | 'appointments:read' | 'appointments:write' | 'appointments:all'
  | 'users:manage' | 'roles:manage' | 'tenant:manage'
  | 'anamnesis_templates:manage'
  | 'billing:read' | 'billing:write'
  | 'platform:manage';

export interface LoginResponse {
  accessToken: string;
  user: { id: UUID; name: string; email: string; tenantId: UUID; roleId: UUID; permissions: PermissionKey[] };
}
export interface Me {
  userId: UUID; tenantId: UUID; roleId: UUID; permissions: PermissionKey[];
  name: string; email: string; role: { id: UUID; name: string };
}
export interface ChangePasswordResponse { accessToken: string }

export interface PublicBranding { name: string; tradeName: string | null; logoUrl: string | null; primaryColor: string | null; secondaryColor: string | null }

export interface TenantBranding { id: UUID; tenantId: UUID; tradeName: string | null; logoUrl: string | null; primaryColor: string | null; secondaryColor: string | null; createdAt: ISODateTime; updatedAt: ISODateTime }
export interface Tenant {
  id: UUID; name: string; subdomain: string; customDomain: string | null; customDomainVerifiedAt: ISODateTime | null;
  status: 'active' | 'suspended'; isPlatform: boolean;
  defaultAppointmentDurationMinutes: number; minAppointmentDurationMinutes: number;
  createdAt: ISODateTime; updatedAt: ISODateTime;
  branding?: TenantBranding | null;
}
export interface DomainVerification { domain: string; verified: boolean; verifiedAt: ISODateTime | null; record: { type: 'TXT'; name: string; value: string } }

export type UserStatus = 'active' | 'invited' | 'disabled';
export interface User {
  id: UUID; tenantId: UUID; roleId: UUID; name: string; email: string; status: UserStatus;
  defaultAppointmentDurationMinutes: number | null; lastLoginAt: ISODateTime | null;
  createdAt: ISODateTime; updatedAt: ISODateTime;
}
export interface Professional {
  id: UUID; name: string;
  defaultAppointmentDurationMinutes: number | null; effectiveAppointmentDurationMinutes: number;
}

export interface Permission { id: UUID; key: PermissionKey; description: string | null }
export interface Role {
  id: UUID; tenantId: UUID; name: string; description: string | null;
  permissions: { roleId: UUID; permissionId: UUID; permission: Permission }[];
  createdAt: ISODateTime; updatedAt: ISODateTime;
}

export interface Patient {
  id: UUID; tenantId: UUID; fullName: string; cpf: string | null; birthDate: ISODateTime | null;
  phone: string | null; email: string | null; address: Record<string, unknown> | null; notes: string | null;
  deletedAt: ISODateTime | null; createdAt: ISODateTime; updatedAt: ISODateTime;
}

export type AnamnesisFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'select' | 'multiselect';
export interface AnamnesisField { key: string; label: string; type: AnamnesisFieldType; required: boolean; options?: string[] }
export interface AnamnesisTemplate { id: UUID; tenantId: UUID; name: string; fields: AnamnesisField[]; createdAt: ISODateTime; updatedAt: ISODateTime }
export interface AnamnesisRecord {
  id: UUID; tenantId: UUID; patientId: UUID; templateId: UUID; filledByUserId: UUID;
  answers: Record<string, string | number | boolean | string[]>;
  template: { id: UUID; name: string };
  createdAt: ISODateTime; updatedAt: ISODateTime;
}

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export interface Appointment {
  id: UUID; tenantId: UUID; patientId: UUID; professionalId: UUID;
  scheduledAt: ISODateTime; endsAt: ISODateTime; status: AppointmentStatus; notes: string | null;
  createdAt: ISODateTime; updatedAt: ISODateTime;
  patient: { id: UUID; fullName: string };
  professional: { id: UUID; name: string };
}

export type ChargeStatus = 'pending' | 'paid' | 'cancelled';
export type ChargeStatusFilter = 'pending' | 'overdue' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'pix' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'other';
export interface Payment {
  id: UUID; tenantId: UUID; chargeId: UUID; amountCents: number; method: PaymentMethod;
  paidAt: ISODateTime; notes: string | null; recordedByUserId: UUID; createdAt: ISODateTime;
  recordedBy: { id: UUID; name: string };
}
export interface Charge {
  id: UUID; tenantId: UUID; patientId: UUID; appointmentId: UUID | null; description: string;
  amountCents: number; dueDate: ISODateTime; status: ChargeStatus;
  isOverdue: boolean; paidCents: number; balanceCents: number;
  patient: { id: UUID; fullName: string };
  createdByUserId: UUID; createdAt: ISODateTime; updatedAt: ISODateTime;
}
export interface ChargeDetail extends Charge { payments: Payment[] }
export interface BillingSummary {
  pending: { count: number; amountCents: number };
  overdue: { count: number; amountCents: number };
  cancelled: { count: number; amountCents: number };
  paidInPeriod: { count: number; amountCents: number };
}

export interface PlatformTenant {
  id: UUID; name: string; subdomain: string; customDomain: string | null;
  status: 'active' | 'suspended'; createdAt: ISODateTime; _count: { users: number; patients: number };
}
