import type { PermissionKey } from '@/api/types';

export type PermissionRequirement = PermissionKey | PermissionKey[];

/** Quando a exigência tem várias permissões, todas são necessárias (igual à API). */
export function hasPermissions(granted: readonly PermissionKey[], required?: PermissionRequirement): boolean {
  if (!required) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.every((permission) => granted.includes(permission));
}

export function isPlatformUser(granted: readonly PermissionKey[]): boolean {
  return granted.includes('platform:manage');
}
