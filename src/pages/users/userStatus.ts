import type { UserStatus } from '@/api/types';

export const USER_STATUS: Record<UserStatus, { label: string; color: 'success' | 'default' | 'warning'; hint: string }> = {
  active: { label: 'Ativo', color: 'success', hint: 'Pode entrar no sistema.' },
  invited: { label: 'Convidado', color: 'warning', hint: 'Ainda não pode entrar (não há convite por email no momento).' },
  disabled: { label: 'Desativado', color: 'default', hint: 'Não pode entrar nem receber agendamentos.' },
};
