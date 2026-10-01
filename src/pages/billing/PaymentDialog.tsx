import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { billingApi, billingKeys } from '@/api/billing';
import type { Charge, PaymentMethod } from '@/api/types';
import { useTenantId } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { MoneyField } from '@/components/MoneyField';
import { useNotify } from '@/components/notifications/NotificationContext';
import { formatCents } from '@/lib/format';
import { centsToMoney, moneyToCents } from '@/lib/masks';
import { PAYMENT_METHODS } from './status';

interface FormValues {
  amount: string;
  method: PaymentMethod;
  paidAt: string;
  notes: string;
}

/** "2026-10-01T14:30" no fuso local (valor de <input type="datetime-local">). */
function nowLocalInput(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function PaymentDialog({ charge, onClose }: { charge: Charge; onClose: () => void }) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const notify = useNotify();

  const { control, handleSubmit } = useForm<FormValues>({
    // Valor sugerido: o saldo devedor.
    defaultValues: { amount: centsToMoney(charge.balanceCents), method: 'pix', paidAt: nowLocalInput(), notes: '' },
  });

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      billingApi.addPayment(tenantId, charge.id, {
        amountCents: moneyToCents(values.amount),
        method: values.method,
        paidAt: new Date(values.paidAt).toISOString(),
        ...(values.notes.trim() && { notes: values.notes.trim() }),
      }),
    onSuccess: (_, values) => {
      // A resposta é só o pagamento: recarrega a cobrança para ver status e saldo.
      void queryClient.invalidateQueries({ queryKey: billingKeys.all(tenantId) });
      const settled = moneyToCents(values.amount) === charge.balanceCents;
      notify(settled ? 'Pagamento registrado. Cobrança quitada.' : 'Pagamento parcial registrado.');
      onClose();
    },
  });

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Registrar pagamento</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} component="form" id="payment-form" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
          <Alert severity="info" icon={false}>
            {charge.description} · saldo devedor <strong>{formatCents(charge.balanceCents)}</strong>
          </Alert>
          <Controller
            name="amount"
            control={control}
            rules={{
              validate: (value) => {
                const cents = moneyToCents(value);
                if (cents < 1) return 'Informe o valor';
                return cents <= charge.balanceCents || `Máximo de ${formatCents(charge.balanceCents)} (saldo devedor)`;
              },
            }}
            render={({ field, fieldState }) => (
              <MoneyField
                label="Valor recebido"
                autoFocus
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                inputRef={field.ref}
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? 'Pode ser parcial.'}
              />
            )}
          />
          <Controller
            name="method"
            control={control}
            render={({ field }) => (
              <TextField select label="Forma de pagamento" {...field} inputRef={field.ref}>
                {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Controller
            name="paidAt"
            control={control}
            rules={{
              validate: (value) =>
                !value ? 'Informe a data' : new Date(value) <= new Date() || 'A data não pode estar no futuro',
            }}
            render={({ field, fieldState }) => (
              <TextField
                label="Recebido em"
                type="datetime-local"
                {...field}
                inputRef={field.ref}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
          />
          <Controller
            name="notes"
            control={control}
            rules={{ maxLength: { value: 500, message: 'Máximo de 500 caracteres' } }}
            render={({ field, fieldState }) => (
              <TextField
                label="Observações"
                multiline
                minRows={2}
                {...field}
                inputRef={field.ref}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
        </Stack>
      </DialogContent>
      {save.error && (
        <Box sx={{ px: 3, pt: 2 }}>
          <ErrorMessages error={save.error} />
        </Box>
      )}
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button type="submit" form="payment-form" variant="contained" loading={save.isPending}>
          Registrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
