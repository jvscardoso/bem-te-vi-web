import type { Permission, PermissionKey } from '@/api/types';

export interface PermissionGroup {
  title: string;
  keys: PermissionKey[];
}

/** Agrupamento por área para o editor de papéis (chaves fora da lista caem em "Outras"). */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  { title: 'Pacientes', keys: ['patients:read', 'patients:write'] },
  { title: 'Agenda', keys: ['appointments:read', 'appointments:write'] },
  { title: 'Financeiro', keys: ['billing:read', 'billing:write'] },
  { title: 'Anamnese', keys: ['anamnesis_templates:manage'] },
  { title: 'Administração', keys: ['users:manage', 'roles:manage', 'tenant:manage'] },
];

/** "Editar" sem "ver" não faz sentido: marcar escrita marca leitura; desmarcar leitura tira escrita. */
const READ_FOR_WRITE: Partial<Record<PermissionKey, PermissionKey>> = {
  'patients:write': 'patients:read',
  'appointments:write': 'appointments:read',
  'billing:write': 'billing:read',
};

export function togglePermission(selected: PermissionKey[], key: PermissionKey, checked: boolean): PermissionKey[] {
  const next = new Set(selected);
  if (checked) {
    next.add(key);
    const read = READ_FOR_WRITE[key];
    if (read) next.add(read);
  } else {
    next.delete(key);
    for (const [write, read] of Object.entries(READ_FOR_WRITE)) {
      if (read === key) next.delete(write as PermissionKey);
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
