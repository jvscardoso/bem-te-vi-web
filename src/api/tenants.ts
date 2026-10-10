import { api } from './client';
import type { DomainVerification, ISODateTime, Tenant, TenantBranding, UUID } from './types';

// O cadastro de clínica (`POST /tenants`) é feito pela landing page, não por este app:
// ver docs/cadastro-de-clinica-na-landing.md.

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

/** Estado do encerramento da conta (LGPD). Sem pedido ativo, as datas vêm null. */
export interface ClosureState {
  closureRequestedAt: ISODateTime | null;
  /** Fim da carência: a partir daqui a plataforma pode excluir os dados. */
  deletionAvailableAt: ISODateTime | null;
  graceDays: number;
}

/** Exportação completa da clínica. Só o cabeçalho é tipado: o resto vai direto para o arquivo. */
export interface ClinicExport {
  format: 'bem-te-vi.clinic-export';
  version: number;
  exportedAt: ISODateTime;
  clinic: { subdomain: string; name: string };
  [section: string]: unknown;
}

export const tenantKeys = {
  detail: (tenantId: UUID) => ['tenant', tenantId] as const,
  closure: (tenantId: UUID) => ['tenant', tenantId, 'closure'] as const,
  domain: (tenantId: UUID) => ['tenant', tenantId, 'domain'] as const,
};

export const tenantsApi = {
  get: (tenantId: UUID) => api.get<Tenant>(`/tenants/${tenantId}`),
  update: (tenantId: UUID, input: TenantUpdate) => api.patch<Tenant>(`/tenants/${tenantId}`, input),
  updateBranding: (tenantId: UUID, input: BrandingUpdate) =>
    api.patch<TenantBranding>(`/tenants/${tenantId}/branding`, input),

  /**
   * Envia o logo (PNG, JPEG ou WebP até 1 MB; SVG é recusado). A API passa a servi-lo numa
   * URL pública nova a cada envio; a anterior deixa de existir.
   */
  uploadLogo: (tenantId: UUID, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.put<TenantBranding>(`/tenants/${tenantId}/branding/logo`, form);
  },
  /** Remove o logo enviado (volta ao padrão). */
  deleteLogo: (tenantId: UUID) => api.delete<TenantBranding>(`/tenants/${tenantId}/branding/logo`),

  /**
   * Todos os dados da clínica num JSON (pode levar alguns segundos). Exige `tenant:manage` e
   * `patients:export`, e fica registrado na auditoria (`tenant.export`).
   */
  exportAll: (tenantId: UUID) => api.get<ClinicExport>(`/tenants/${tenantId}/export`),

  closure: (tenantId: UUID) => api.get<ClosureState>(`/tenants/${tenantId}/closure`),
  /** Exige a senha de quem pede: 400 "Senha incorreta" (não desloga), 409 se já foi pedido. */
  requestClosure: (tenantId: UUID, password: string) =>
    api.post<ClosureState>(`/tenants/${tenantId}/closure`, { password }),
  /** Cancela durante a carência; 409 se não há pedido. */
  cancelClosure: (tenantId: UUID) => api.delete<ClosureState>(`/tenants/${tenantId}/closure`),

  /** 404 quando a clínica não tem domínio próprio configurado. */
  domain: (tenantId: UUID) => api.get<DomainVerification>(`/tenants/${tenantId}/domain`),
  /** Consulta o DNS agora. Sempre 200; `verified: false` enquanto não propagar. */
  verifyDomain: (tenantId: UUID) => api.post<DomainVerification>(`/tenants/${tenantId}/domain/verify`),
};
