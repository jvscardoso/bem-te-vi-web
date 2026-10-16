import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import type { ContractInput, Plan, PlansResponse, SubscriptionDetails } from '@/api/subscription';
import type { BillingCycle } from '@/api/types';
import { ErrorMessages } from '@/components/ErrorMessages';
import { SectionCard } from '@/components/SectionCard';
import { useNotify } from '@/components/notifications/NotificationContext';
import { applyFieldErrors } from '@/lib/errors';
import { muiField } from '@/lib/form';
import { formatCents, formatDate } from '@/lib/format';
import { maskCpfCnpj, onlyDigits } from '@/lib/masks';
import {
  ACCESS_LABELS,
  CYCLE_LABELS,
  PAYMENT_METHODS,
  STATUS_LABELS,
  priceLabel,
  professionalsLabel,
} from './subscriptionText';
import { useContractSubscription, usePlans, useSubscriptionDetails } from './useSubscription';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORM_FIELDS = ['planId', 'cycle', 'paymentMethod', 'billing.name', 'billing.document', 'billing.email'];

/**
 * Assinatura da clínica na plataforma (task 31): situação, plano contratado e contratação.
 * Usada em Configurações › Assinatura e na tela de clínica bloqueada.
 */
export function SubscriptionTab() {
  const details = useSubscriptionDetails();
  const plans = usePlans();

  if (details.error) return <ErrorMessages error={details.error} />;
  if (plans.error && !details.data?.contracted) return <ErrorMessages error={plans.error} />;
  if (!details.data || (!details.data.contracted && !plans.data)) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={320} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <SituationCard details={details.data} />
      {details.data.contracted ? (
        <ContractedCard details={details.data} />
      ) : (
        <ContractForm details={details.data} plans={plans.data!} />
      )}
    </Stack>
  );
}

function SituationCard({ details }: { details: SubscriptionDetails }) {
  const [now] = useState(() => Date.now());
  const status = STATUS_LABELS[details.status];
  const access = ACCESS_LABELS[details.access];
  const trialOver = !!details.trialEndsAt && new Date(details.trialEndsAt).getTime() <= now;

  let summary: string;
  if (details.status === 'trialing') {
    summary = trialOver
      ? `O teste grátis terminou em ${formatDate(details.trialEndsAt)}.`
      : `Teste grátis do plano ${details.plan.name} até ${formatDate(details.trialEndsAt)}.`;
  } else if (details.status === 'active') {
    summary = details.currentPeriodEnd
      ? `Plano ${details.plan.name} ativo, pago até ${formatDate(details.currentPeriodEnd)}.`
      : `Plano ${details.plan.name} ativo.`;
  } else {
    summary = `Pagamento do plano ${details.plan.name} em atraso desde ${formatDate(details.pastDueSince)}.`;
  }

  return (
    <SectionCard title="Situação">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>{details.plan.name}</Typography>
        <Chip size="small" variant="outlined" label={status.label} color={status.color} />
        {access && <Chip size="small" label={access.label} color={access.color} />}
      </Stack>
      <Typography color="text.secondary">{summary}</Typography>
      <AccessAlert details={details} />
    </SectionCard>
  );
}

/** O que acontece com o acesso e quando (a API calcula; aqui só se explica). */
function AccessAlert({ details }: { details: SubscriptionDetails }) {
  const when = details.changesAt ? formatDate(details.changesAt) : null;
  if (details.access === 'blocked') {
    return (
      <Alert severity="error">
        O acesso à clínica está bloqueado. Os dados continuam guardados: contrate um plano para voltar a usar o
        sistema, ou exporte os dados.
      </Alert>
    );
  }
  if (details.access === 'read_only') {
    return (
      <Alert severity="warning">
        A clínica está em modo só leitura: dá para consultar e exportar, mas não alterar dados.
        {when && ` Em ${when} o acesso será bloqueado.`}
      </Alert>
    );
  }
  if (details.reason === 'past_due' && when) {
    return <Alert severity="warning">Pague a mensalidade até {when} para a clínica não entrar em modo só leitura.</Alert>;
  }
  if (details.status === 'trialing' && !details.contracted && when) {
    return (
      <Alert severity="info">
        Sem contratar um plano até {when}, a clínica entra em modo só leitura: os dados continuam disponíveis para
        consulta e exportação.
      </Alert>
    );
  }
  return null;
}

function ContractedCard({ details }: { details: SubscriptionDetails }) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const price = details.cycle === 'monthly' ? details.plan.monthlyPriceCents : details.plan.annualPriceCents;
  // Contratada ainda no teste: a primeira cobrança vence no fim dele (depois disso, vence na contratação).
  const contractedInTrial =
    !!details.trialEndsAt && !!details.contractedAt && details.contractedAt < details.trialEndsAt;

  // O pagamento confirmado chega à API pelo Asaas; aqui só relemos a situação.
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['subscription'] }),
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }),
    ]).finally(() => setRefreshing(false));
  };

  return (
    <SectionCard
      title="Plano contratado"
      description={`Contratado em ${formatDate(details.contractedAt)}. A troca de plano ainda não está disponível.`}
    >
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
        <Info label="Plano" value={details.plan.name} />
        <Info label="Ciclo" value={CYCLE_LABELS[details.cycle]} />
        <Info label="Valor" value={`${formatCents(price)}${details.cycle === 'monthly' ? '/mês' : '/ano'}`} />
      </Box>
      {details.billing && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
          <Info label="Cobrança em nome de" value={details.billing.name} />
          <Info label="CPF ou CNPJ" value={maskCpfCnpj(details.billing.document)} />
          <Info label="Email da cobrança" value={details.billing.email} />
        </Box>
      )}

      {details.status !== 'active' && (
        <Alert severity="info">
          {details.status === 'trialing'
            ? `A assinatura fica ativa quando o pagamento for confirmado.${contractedInTrial ? ` Contratar não encurta o teste: a primeira cobrança vence em ${formatDate(details.trialEndsAt)}.` : ''}`
            : 'Assim que o pagamento em atraso for confirmado, o acesso volta ao normal.'}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        {details.paymentUrl && details.status !== 'active' && (
          <Button
            variant="contained"
            href={details.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewOutlined />}
          >
            Abrir página de pagamento
          </Button>
        )}
        <Button onClick={refresh} loading={refreshing}>
          {details.status === 'active' ? 'Atualizar situação' : 'Já paguei, atualizar situação'}
        </Button>
      </Stack>
    </SectionCard>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ wordBreak: 'break-word' }}>{value}</Typography>
    </Box>
  );
}

function ContractForm({ details, plans }: { details: SubscriptionDetails; plans: PlansResponse }) {
  const notify = useNotify();
  const contract = useContractSubscription();
  const [areaError, setAreaError] = useState<unknown>(null);
  const [now] = useState(() => Date.now());

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<ContractInput>({
    defaultValues: {
      planId: details.plan.id,
      cycle: 'monthly',
      paymentMethod: 'any',
      billing: { name: '', document: '', email: '' },
    },
  });
  const [planId, cycle] = useWatch({ control, name: ['planId', 'cycle'] });
  const selected = plans.data.find((plan) => plan.id === planId) ?? plans.data[0];

  const submit = (values: ContractInput) => {
    setAreaError(null);
    contract.mutate(
      { ...values, billing: { ...values.billing, name: values.billing.name.trim() } },
      {
        onSuccess: (saved) => {
          notify('Plano contratado. Conclua o pagamento na página do Asaas.');
          // Pode ser barrado como pop-up (abre depois da resposta da API): o botão fica na tela.
          if (saved.paymentUrl) window.open(saved.paymentUrl, '_blank', 'noopener,noreferrer');
        },
        onError: (error) => setAreaError(applyFieldErrors(error, setError, FORM_FIELDS)),
      },
    );
  };

  // Contratar no teste não o encurta: a primeira cobrança vence no fim dele.
  const firstDue =
    details.status === 'trialing' && details.trialEndsAt && new Date(details.trialEndsAt).getTime() > now
      ? formatDate(details.trialEndsAt)
      : null;

  return (
    <Stack spacing={3} component="form" onSubmit={handleSubmit(submit)} noValidate>
      <SectionCard
        title="Escolha o plano"
        description="Os preços já incluem tudo. Lembretes e agendamento por WhatsApp chegam em breve."
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          value={cycle}
          onChange={(_, value: BillingCycle | null) => value && setValue('cycle', value)}
          aria-label="Ciclo de cobrança"
        >
          <ToggleButton value="monthly">Mensal</ToggleButton>
          <ToggleButton value="yearly">Anual · {plans.annualDiscountPercent}% de desconto</ToggleButton>
        </ToggleButtonGroup>

        <Box
          role="radiogroup"
          aria-label="Plano"
          sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }}
        >
          {plans.data.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              cycle={cycle}
              selected={plan.id === selected.id}
              current={plan.id === details.plan.id && details.status === 'trialing'}
              onSelect={() => setValue('planId', plan.id)}
            />
          ))}
        </Box>
      </SectionCard>

      <SectionCard
        title="Dados da cobrança"
        description="Quem recebe a cobrança e a nota: pode ser a empresa, o dono ou o contador."
      >
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
          <TextField
            label="Nome ou razão social"
            required
            {...muiField(
              register('billing.name', {
                validate: (value) =>
                  !value.trim() ? 'Informe o nome' : value.length > 150 ? 'Máximo de 150 caracteres' : true,
              }),
              errors.billing?.name,
            )}
          />
          <Controller
            name="billing.document"
            control={control}
            rules={{
              validate: (value) =>
                [11, 14].includes(onlyDigits(value).length) || 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)',
            }}
            render={({ field, fieldState }) => (
              <TextField
                label="CPF ou CNPJ"
                required
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                {...field}
                inputRef={field.ref}
                onChange={(event) => field.onChange(maskCpfCnpj(event.target.value))}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <TextField
            label="Email da cobrança"
            type="email"
            required
            {...muiField(
              register('billing.email', {
                validate: (value) => EMAIL.test(value.trim()) || 'Informe um email válido',
              }),
              errors.billing?.email,
            )}
          />
          <Controller
            name="paymentMethod"
            control={control}
            render={({ field }) => (
              <TextField select label="Forma de pagamento" {...field} inputRef={field.ref}>
                {PAYMENT_METHODS.map((method) => (
                  <MenuItem key={method.value} value={method.value}>
                    {method.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Box>
      </SectionCard>

      <Alert severity="info">
        Ao contratar, abrimos a página de pagamento do Asaas em outra aba (Pix, boleto ou cartão). Os dados do cartão
        não passam pelo bem-te-vi.
        {firstDue && ` A primeira cobrança vence em ${firstDue}, no fim do teste grátis.`}
      </Alert>

      <ErrorMessages error={areaError} />
      <Box>
        <Button type="submit" variant="contained" size="large" loading={contract.isPending}>
          Contratar {selected.name} · {priceLabel(selected, cycle)}
        </Button>
      </Box>
    </Stack>
  );
}

interface PlanCardProps {
  plan: Plan;
  cycle: BillingCycle;
  selected: boolean;
  current: boolean;
  onSelect: () => void;
}

function PlanCard({ plan, cycle, selected, current, onSelect }: PlanCardProps) {
  const savingCents = plan.monthlyPriceCents * 12 - plan.annualPriceCents;
  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: selected ? 'primary.main' : undefined,
        borderWidth: selected ? 2 : 1,
        bgcolor: selected ? 'action.selected' : undefined,
      }}
    >
      <CardActionArea role="radio" aria-checked={selected} onClick={onSelect} sx={{ p: 2, height: '100%' }}>
        <Stack spacing={1} sx={{ height: '100%' }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>{plan.name}</Typography>
            {current && <Chip size="small" label="Seu teste" color="info" variant="outlined" />}
          </Stack>
          <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
            {priceLabel(plan, cycle)}
          </Typography>
          {cycle === 'yearly' && (
            <Typography variant="caption" color="success.main">
              Equivale a {formatCents(Math.round(plan.annualPriceCents / 12))}/mês · economize {formatCents(savingCents)}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {professionalsLabel(plan)}
          </Typography>
          {plan.extraProfessionalCents !== null && (
            <Typography variant="body2" color="text.secondary">
              + {formatCents(plan.extraProfessionalCents)}/mês por profissional extra
            </Typography>
          )}
        </Stack>
      </CardActionArea>
    </Card>
  );
}
