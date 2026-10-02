import { api } from './client';
import type { DomainVerification, Tenant, TenantBranding, UUID } from './types';

export interface SignupInput {
  name: string;
  subdomain: string;
  customDomain?: string;
  defaultAppointmentDurationMinutes?: number;
  minAppointmentDurationMinutes?: number;
  owner: { name: string; email: string; password: string };
}

export interface SignupResponse {
  tenant: Tenant;
  role: { id: UUID; name: string };
  owner: { id: UUID; name: string; email: string };
}

/** Campos editáveis da clínica (sem `owner` e sem `status`). `customDomain: null` remove. */
export interface TenantUpdate {
  name?: string;
  subdomain?: string;
  customDomain?: string | null;
  defaultAppointmentDurationMinutes?: number;
  minAppointmentDurationMinutes?: number;
}

/** Envio parcial; `null` limpa (volta ao padrão do bem-te-vi). */
export interface BrandingUpdate {
  tradeName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export const tenantKeys = {
  detail: (tenantId: UUID) => ['tenant', tenantId] as const,
  domain: (tenantId: UUID) => ['tenant', tenantId, 'domain'] as const,
};

export const tenantsApi = {
  /** Cadastro público de clínica. Não devolve token: em seguida, faça login. */
  signup: (input: SignupInput) => api.post<SignupResponse>('/tenants', input, { auth: false }),

  get: (tenantId: UUID) => api.get<Tenant>(`/tenants/${tenantId}`),
  update: (tenantId: UUID, input: TenantUpdate) => api.patch<Tenant>(`/tenants/${tenantId}`, input),
  updateBranding: (tenantId: UUID, input: BrandingUpdate) =>
    api.patch<TenantBranding>(`/tenants/${tenantId}/branding`, input),

  /** 404 quando a clínica não tem domínio próprio configurado. */
  domain: (tenantId: UUID) => api.get<DomainVerification>(`/tenants/${tenantId}/domain`),
  /** Consulta o DNS agora. Sempre 200; `verified: false` enquanto não propagar. */
  verifyDomain: (tenantId: UUID) => api.post<DomainVerification>(`/tenants/${tenantId}/domain/verify`),
};
