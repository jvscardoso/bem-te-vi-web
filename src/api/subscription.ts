import { api } from './client';
import type { BillingCycle, ISODateTime, SubscriptionAccess, SubscriptionState, SubscriptionStatus, UUID } from './types';

/** Plano da plataforma. Preços sempre da API (`GET /public/plans`), nunca escritos no front. */
export interface Plan {
  id: string;
  name: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  /** null = sem limite. */
  maxProfessionals: number | null;
  /** Preço por profissional acima do limite; null = não aceita extras. */
  extraProfessionalCents: number | null;
  // Recursos do WhatsApp, ainda não lançados.
  monthlyReminders: number;
  monthlyBotBookings: number;
  monthlyCampaignMessages: number;
}

export interface PlansResponse {
  trialDays: number;
  trialPlanId: string;
  annualDiscountPercent: number;
  data: Plan[];
}

export type PaymentMethod = 'pix' | 'boleto' | 'credit_card' | 'any';

export interface BillingDetails {
  name: string;
  /** CPF ou CNPJ, com ou sem pontuação. */
  document: string;
  email: string;
}

/** Detalhes da assinatura (`tenant:manage`). */
export interface SubscriptionDetails {
  plan: Plan;
  status: SubscriptionStatus;
  cycle: BillingCycle;
  trialEndsAt: ISODateTime | null;
  currentPeriodEnd: ISODateTime | null;
  pastDueSince: ISODateTime | null;
  contracted: boolean;
  contractedAt: ISODateTime | null;
  /** Página de pagamento do Asaas (Pix, boleto ou cartão); abre em nova aba. */
  paymentUrl: string | null;
  billing: BillingDetails | null;
  access: SubscriptionAccess;
  reason: SubscriptionState['reason'];
  changesAt: ISODateTime | null;
}

export interface ContractInput {
  planId: string;
  cycle: BillingCycle;
  paymentMethod: PaymentMethod;
  billing: BillingDetails;
}

export const subscriptionKeys = {
  plans: ['public-plans'] as const,
  detail: (tenantId: UUID) => ['subscription', tenantId] as const,
};

export const subscriptionApi = {
  plans: () => api.get<PlansResponse>('/public/plans', undefined, { auth: false }),
  get: (tenantId: UUID) => api.get<SubscriptionDetails>(`/tenants/${tenantId}/subscription`),
  contract: (tenantId: UUID, input: ContractInput) =>
    api.post<SubscriptionDetails>(`/tenants/${tenantId}/subscription`, input),
};
