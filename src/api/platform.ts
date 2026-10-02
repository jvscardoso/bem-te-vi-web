import { api } from './client';
import type { Page, PlatformTenant, UUID } from './types';

export interface PlatformTenantListParams {
  q?: string;
  page?: number;
  pageSize?: number;
}

export type TenantStatus = PlatformTenant['status'];

export const platformKeys = {
  all: ['platform-tenants'] as const,
  list: (params: PlatformTenantListParams) => ['platform-tenants', 'list', params] as const,
};

/** Backoffice da plataforma (platform:manage). Não acessa dados clínicos. */
export const platformApi = {
  /** Busca `q` em nome (sem acento/maiúsculas), subdomínio e domínio próprio. */
  tenants: (params: PlatformTenantListParams) => api.get<Page<PlatformTenant>>('/platform/tenants', { ...params }),
  /** Suspender tem efeito imediato: a equipe da clínica recebe 401 e a marca pública some. */
  setStatus: (id: UUID, status: TenantStatus) =>
    api.patch<{ id: UUID; name: string; status: TenantStatus }>(`/platform/tenants/${id}/status`, { status }),
};
