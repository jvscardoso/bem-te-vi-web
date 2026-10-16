import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { Alert, Button, type AlertColor } from '@mui/material';
import type { SubscriptionState } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { formatDate } from '@/lib/format';
import { daysUntil } from './subscriptionText';
import { useSubscriptionDetails } from './useSubscription';

const SUBSCRIPTION_PATH = '/configuracoes?aba=assinatura';
/** A partir de quantos dias para o fim do teste o aviso fica em destaque. */
const TRIAL_WARNING_DAYS = 3;

/**
 * Aviso da assinatura no topo de todas as telas da clínica, para todo usuário (a situação vem do
 * `/auth/me`). Só quem tem `tenant:manage` vê o botão de contratar; os demais são orientados a
 * falar com o administrador. A clínica bloqueada nem chega aqui: o `RequireAuth` mostra a tela de
 * bloqueio no lugar do app.
 */
export function SubscriptionBanner() {
  const { subscription, can } = useAuth();
  const [now] = useState(() => Date.now());
  const isManager = can('tenant:manage');
  // Só para saber se o admin já contratou durante o teste (o /auth/me não diz).
  const details = useSubscriptionDetails(isManager && subscription?.status === 'trialing');

  if (!subscription || subscription.access === 'blocked') return null;
  const notice = noticeFor(subscription, now, details.data?.contracted ?? false);
  if (!notice) return null;

  const action = isManager ? (
    <Button color="inherit" size="small" component={RouterLink} to={SUBSCRIPTION_PATH} sx={{ whiteSpace: 'nowrap' }}>
      {notice.managerAction}
    </Button>
  ) : undefined;

  return (
    <Alert
      severity={notice.severity}
      variant={notice.discreet ? 'outlined' : 'standard'}
      sx={{ mb: 3, alignItems: 'center', ...(notice.discreet && { py: 0 }) }}
      action={action}
    >
      {notice.text}
      {!isManager && notice.otherUsers && ` ${notice.otherUsers}`}
    </Alert>
  );
}

interface Notice {
  severity: AlertColor;
  discreet?: boolean;
  text: string;
  managerAction: string;
  /** Complemento para quem não pode contratar. */
  otherUsers?: string;
}

function noticeFor(subscription: SubscriptionState, now: number, contracted: boolean): Notice | null {
  const when = subscription.changesAt ? formatDate(subscription.changesAt) : null;

  if (subscription.access === 'read_only') {
    return {
      severity: 'error',
      text: `Modo só leitura${subscription.reason === 'past_due' ? ': a mensalidade está em atraso' : ': o teste grátis terminou'}. Dá para consultar e exportar os dados, mas não alterar.${when ? ` Em ${when} o acesso será bloqueado.` : ''}`,
      managerAction: 'Contratar plano',
      otherUsers: 'Para voltar a alterar dados, fale com o administrador da clínica.',
    };
  }

  if (subscription.status === 'past_due') {
    return {
      severity: 'warning',
      text: `Pagamento em atraso.${when ? ` Em ${when} a clínica entra em modo só leitura.` : ''}`,
      managerAction: 'Ver assinatura',
      otherUsers: 'Avise o administrador da clínica.',
    };
  }

  if (subscription.status === 'trialing' && subscription.trialEndsAt) {
    const date = formatDate(subscription.trialEndsAt);
    if (contracted) {
      return {
        severity: 'info',
        discreet: true,
        text: `Plano contratado. A assinatura começa com a confirmação do pagamento (teste grátis até ${date}).`,
        managerAction: 'Ver pagamento',
      };
    }
    const days = daysUntil(subscription.trialEndsAt, now);
    if (days <= TRIAL_WARNING_DAYS) {
      return {
        severity: 'warning',
        text: `${days <= 0 ? 'O teste grátis termina hoje' : days === 1 ? 'O teste grátis termina amanhã' : `O teste grátis termina em ${days} dias`} (${date}). Depois disso, a clínica entra em modo só leitura.`,
        managerAction: 'Contratar plano',
        otherUsers: 'Avise o administrador da clínica.',
      };
    }
    return { severity: 'info', discreet: true, text: `Teste grátis até ${date}.`, managerAction: 'Contratar' };
  }

  return null;
}
