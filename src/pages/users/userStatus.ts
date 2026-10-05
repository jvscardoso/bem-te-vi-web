import type { UserStatus } from '@/api/types';

export const USER_STATUS: Record<UserStatus, { label: string; color: 'success' | 'default' | 'warning'; hint: string }> = {
  active: { label: 'Ativo', color: 'success', hint: 'Pode entrar no sistema.' },
  invited: {
    label: 'Convite pendente',
    color: 'warning',
    hint: 'Fica ativo quando a pessoa aceitar o convite e criar a senha. Desativar cancela o convite.',
  },
  disabled: { label: 'Desativado', color: 'default', hint: 'Não pode entrar nem receber agendamentos.' },
};
