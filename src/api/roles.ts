import { api } from './client';
import type { Page, Permission, Role, UUID } from './types';

export interface RoleInput {
  name: string;
  description?: string | null;
  /** No PATCH, substitui a lista inteira. */
  permissionIds: UUID[];
}

const base = (tenantId: UUID) => `/tenants/${tenantId}/roles`;

export const rolesKeys = {
  all: (tenantId: UUID) => ['roles', tenantId] as const,
  permissions: ['permissions'] as const,
};

export const rolesApi = {
  list: (tenantId: UUID, page = 1, pageSize = 100) => api.get<Page<Role>>(base(tenantId), { page, pageSize }),

  /** Todos os papéis (para seletores e regras de privilégio). */
  async listAll(tenantId: UUID): Promise<Role[]> {
    const first = await rolesApi.list(tenantId);
    const items = [...first.data];
    for (let page = 2; page <= first.meta.totalPages; page++) {
      items.push(...(await rolesApi.list(tenantId, page)).data);
    }
    return items;
  },

  get: (tenantId: UUID, id: UUID) => api.get<Role>(`${base(tenantId)}/${id}`),
  create: (tenantId: UUID, input: RoleInput) => api.post<Role>(base(tenantId), input),
  update: (tenantId: UUID, id: UUID, input: Partial<RoleInput>) => api.patch<Role>(`${base(tenantId)}/${id}`, input),
  remove: (tenantId: UUID, id: UUID) => api.delete(`${base(tenantId)}/${id}`),

  /** Catálogo global de permissões (sem as `platform:*`), ordenado por chave. */
  permissions: () => api.get<Permission[]>('/permissions'),
};
