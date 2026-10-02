import type { PermissionKey, Role } from '@/api/types';

// Regras de conta da API (seção 4.3), espelhadas na UI para desabilitar o que daria 403.

export function rolePermissionKeys(role: Role): PermissionKey[] {
  return role.permissions.map((item) => item.permission.key);
}

/** O papel tem alguma permissão que o ator não tem ("acima" dele). */
export function isRoleAbove(actorPermissions: readonly PermissionKey[], role: Role): boolean {
  return rolePermissionKeys(role).some((key) => !actorPermissions.includes(key));
}

/** Permissões do papel que o ator não possui (para explicar o bloqueio). */
export function missingPermissions(actorPermissions: readonly PermissionKey[], role: Role): PermissionKey[] {
  return rolePermissionKeys(role).filter((key) => !actorPermissions.includes(key));
}

export const ADMIN_PERMISSIONS: PermissionKey[] = ['users:manage', 'roles:manage', 'tenant:manage'];

export function isAdminRole(role: Role): boolean {
  const keys = rolePermissionKeys(role);
  return ADMIN_PERMISSIONS.every((key) => keys.includes(key));
}
