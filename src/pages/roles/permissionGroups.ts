import type { Permission, PermissionKey } from '@/api/types';

export interface PermissionGroup {
  title: string;
  keys: PermissionKey[];
}

/** Agrupamento por área para o editor de papéis (chaves fora da lista caem em "Outras"). */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  { title: 'Pacientes', keys: ['patients:read', 'patients:write', 'patients:export'] },
  { title: 'Agenda', keys: ['appointments:read', 'appointments:write', 'appointments:all'] },
  { title: 'Financeiro', keys: ['billing:read', 'billing:write'] },
  { title: 'Anamnese', keys: ['anamnesis_templates:manage'] },
  { title: 'Administração', keys: ['users:manage', 'roles:manage', 'tenant:manage', 'audit:read'] },
];

/**
 * Permissões que só fazem sentido junto com a leitura da área ("editar" sem "ver", "todas as
 * agendas" sem "ver a própria"): marcar uma marca a leitura; desmarcar a leitura tira as duas.
 */
const REQUIRES_READ: Partial<Record<PermissionKey, PermissionKey>> = {
  'patients:write': 'patients:read',
  'appointments:write': 'appointments:read',
  'appointments:all': 'appointments:read',
  'billing:write': 'billing:read',
};

export function togglePermission(selected: PermissionKey[], key: PermissionKey, checked: boolean): PermissionKey[] {
  const next = new Set(selected);
  if (checked) {
    next.add(key);
    const read = REQUIRES_READ[key];
    if (read) next.add(read);
  } else {
    next.delete(key);
    for (const [dependent, read] of Object.entries(REQUIRES_READ)) {
      if (read === key) next.delete(dependent as PermissionKey);
    }
  }
  return [...next];
}

export function groupCatalog(catalog: Permission[]): { title: string; permissions: Permission[] }[] {
  const byKey = new Map(catalog.map((permission) => [permission.key, permission]));
  const used = new Set<string>();
  const groups = PERMISSION_GROUPS.map((group) => ({
    title: group.title,
    permissions: group.keys.flatMap((key) => {
      const permission = byKey.get(key);
      if (!permission) return [];
      used.add(key);
      return [permission];
    }),
  })).filter((group) => group.permissions.length > 0);

  const others = catalog.filter((permission) => !used.has(permission.key));
  if (others.length > 0) groups.push({ title: 'Outras', permissions: others });
  return groups;
}
