import type { BillingCycle, SubscriptionAccess, SubscriptionStatus } from '@/api/types';
import type { PaymentMethod, Plan } from '@/api/subscription';
import { startOfDay } from '@/lib/dates';
import { formatCents } from '@/lib/format';

type ChipColor = 'info' | 'success' | 'error' | 'warning';

export const STATUS_LABELS: Record<SubscriptionStatus, { label: string; color: ChipColor }> = {
  trialing: { label: 'Em teste', color: 'info' },
  active: { label: 'Ativa', color: 'success' },
  past_due: { label: 'Em atraso', color: 'error' },
};

/** Selo extra quando o acesso não está completo. */
export const ACCESS_LABELS: Partial<Record<SubscriptionAccess, { label: string; color: ChipColor }>> = {
  read_only: { label: 'Só leitura', color: 'warning' },
  blocked: { label: 'Bloqueada', color: 'error' },
};

export const CYCLE_LABELS: Record<BillingCycle, string> = { monthly: 'Mensal', yearly: 'Anual' };

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'any', label: 'Escolher na página de pagamento' },
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'credit_card', label: 'Cartão de crédito' },
];

export function professionalsLabel(plan: Plan): string {
  if (plan.maxProfessionals === null) return 'Profissionais ilimitados';
  if (plan.maxProfessionals === 1) return '1 profissional';
  return `Até ${plan.maxProfessionals} profissionais`;
}

export function priceLabel(plan: Plan, cycle: BillingCycle): string {
  return cycle === 'monthly' ? `${formatCents(plan.monthlyPriceCents)}/mês` : `${formatCents(plan.annualPriceCents)}/ano`;
}

/** Dias de calendário até a data, no fuso do navegador (0 = hoje, 1 = amanhã). */
export function daysUntil(value: string, now: number): number {
  const target = startOfDay(new Date(value)).getTime();
  return Math.round((target - startOfDay(new Date(now)).getTime()) / 86_400_000);
}
