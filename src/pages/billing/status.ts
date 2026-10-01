import type { Charge, ChargeStatusFilter, PaymentMethod } from '@/api/types';

export type ChargeDisplayStatus = 'cancelled' | 'paid' | 'overdue' | 'partial' | 'pending';

/** Status de exibição (seção 11.1): "atrasada" e "parcial" são derivados de `pending`. */
export function chargeDisplayStatus(charge: Charge): ChargeDisplayStatus {
  if (charge.status === 'cancelled') return 'cancelled';
  if (charge.status === 'paid') return 'paid';
  if (charge.isOverdue) return 'overdue';
  if (charge.paidCents > 0) return 'partial';
  return 'pending';
}

export const DISPLAY_STATUS: Record<ChargeDisplayStatus, { label: string; color: 'default' | 'success' | 'error' | 'warning' | 'info' }> = {
  cancelled: { label: 'Cancelada', color: 'default' },
  paid: { label: 'Paga', color: 'success' },
  overdue: { label: 'Atrasada', color: 'error' },
  partial: { label: 'Parcialmente paga', color: 'warning' },
  pending: { label: 'Pendente', color: 'info' },
};

/** Filtros da listagem (`pending` aqui = pendente ainda não vencida). */
export const STATUS_FILTERS: { value: ChargeStatusFilter | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'pending', label: 'A vencer' },
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'paid', label: 'Pagas' },
  { value: 'cancelled', label: 'Canceladas' },
];

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  bank_transfer: 'Transferência',
  other: 'Outro',
};

/** Só cobrança pendente e sem nenhum pagamento pode ser editada ou cancelada. */
export const canEditCharge = (charge: Charge) => charge.status === 'pending' && charge.paidCents === 0;
