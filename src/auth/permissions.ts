import type { PermissionKey } from '@/api/types';

export type PermissionRequirement = PermissionKey | PermissionKey[];

/** Quando a exigência tem várias permissões, todas são necessárias (igual à API). */
export function hasPermissions(granted: readonly PermissionKey[], required?: PermissionRequirement): boolean {
  if (!required) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.every((permission) => granted.includes(permission));
}

/**
 * Permissões que só servem para alterar dados. Em só leitura (assinatura vencida) elas deixam de
 * valer na tela: os botões que dependem delas somem, como somem para quem não as tem. As de
 * administração (`users:manage`, `tenant:manage`…) também abrem telas de consulta, então
 * continuam valendo e cada tela desabilita as próprias ações com `readOnly`.
 */
const WRITE_PERMISSIONS: readonly PermissionKey[] = ['patients:write', 'appointments:write', 'billing:write'];

export function withoutWritePermissions(granted: readonly PermissionKey[]): PermissionKey[] {
  return granted.filter((permission) => !WRITE_PERMISSIONS.includes(permission));
}

export function isPlatformUser(granted: readonly PermissionKey[]): boolean {
  return granted.includes('platform:manage');
}
