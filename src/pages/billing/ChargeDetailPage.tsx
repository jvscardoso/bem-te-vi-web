import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router';
import {
  Box,
  Button,
  Chip,
  Link,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import EditOutlined from '@mui/icons-material/EditOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import { billingApi, billingKeys } from '@/api/billing';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';
import { StatusScreen } from '@/components/StatusScreen';
import { useNotify } from '@/components/notifications/NotificationContext';
import { isApiError } from '@/lib/errors';
import { formatCents, formatDate, formatDateTime } from '@/lib/format';
import { ChargeDialog } from './ChargeDialog';
import { PaymentDialog } from './PaymentDialog';
import { canEditCharge, chargeDisplayStatus, DISPLAY_STATUS, PAYMENT_METHODS } from './status';

type DialogState = 'payment' | 'edit' | 'cancel' | null;

export function ChargeDetailPage() {
  const { id = '' } = useParams();
  const tenantId = useTenantId();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [dialog, setDialog] = useState<DialogState>(null);

  const query = useQuery({
    queryKey: billingKeys.detail(tenantId, id),
    queryFn: () => billingApi.get(tenantId, id),
  });

  const cancel = useMutation({
    mutationFn: () => billingApi.cancel(tenantId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingKeys.all(tenantId) });
      notify('Cobrança cancelada.');
      setDialog(null);
    },
  });

  if (isApiError(query.error, 404)) {
    return (
      <StatusScreen
        title="Cobrança não encontrada"
        action={
          <Button component={RouterLink} to="/financeiro" variant="contained">
            Voltar ao financeiro
          </Button>
        }
      />
    );
  }
  if (query.error) return <ErrorMessages error={query.error} />;
  if (!query.data) return <Skeleton variant="rounded" height={280} />;

  const charge = query.data;
  const status = DISPLAY_STATUS[chargeDisplayStatus(charge)];
  const canWrite = can('billing:write');
  const editable = canEditCharge(charge);

  return (
    <Box sx={{ maxWidth: 960 }}>
      <Button component={RouterLink} to="/financeiro" startIcon={<ArrowBack />} size="small" sx={{ mb: 1 }}>
        Financeiro
      </Button>
      <PageHeader
        title={charge.description}
        subtitle={
          <Stack direction="row" spacing={1} component="span" sx={{ alignItems: 'center' }}>
            <Chip size="small" label={status.label} color={status.color} component="span" />
            <span>Vencimento {formatDate(charge.dueDate)}</span>
          </Stack>
        }
        actions={
          canWrite && (
            <>
              {editable && (
                <>
                  <Button color="error" onClick={() => setDialog('cancel')}>
                    Cancelar cobrança
                  </Button>
                  <Button startIcon={<EditOutlined />} onClick={() => setDialog('edit')}>
                    Editar
                  </Button>
                </>
              )}
              {charge.status === 'pending' && (
                <Button variant="contained" startIcon={<PaymentsOutlined />} onClick={() => setDialog('payment')}>
                  Registrar pagamento
                </Button>
              )}
            </>
          )
        }
      />

      <Stack spacing={3}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
          <AmountCard label="Valor" value={formatCents(charge.amountCents)} />
          <AmountCard label="Pago" value={formatCents(charge.paidCents)} color="success.main" />
          <AmountCard
            label="Saldo devedor"
            value={formatCents(charge.balanceCents)}
            color={charge.isOverdue ? 'error.main' : charge.balanceCents > 0 ? 'text.primary' : 'text.secondary'}
          />
        </Box>

        <SectionCard title="Detalhes">
          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
            <Field label="Paciente">
              {can('patients:read') ? (
                <Link component={RouterLink} to={`/pacientes/${charge.patientId}?aba=cobrancas`}>
                  {charge.patient.fullName}
                </Link>
              ) : (
                charge.patient.fullName
              )}
            </Field>
            <Field label="Agendamento">{charge.appointmentId ? 'Vinculada a um agendamento' : 'Sem agendamento'}</Field>
            <Field label="Criada em">{formatDateTime(charge.createdAt)}</Field>
            {charge.status === 'cancelled' && <Field label="Cancelada em">{formatDateTime(charge.updatedAt)}</Field>}
          </Box>
          {canWrite && charge.status === 'pending' && !editable && (
            <Typography variant="body2" color="text.secondary">
              Cobranças com pagamento registrado não podem ser editadas nem canceladas.
            </Typography>
          )}
        </SectionCard>

        <SectionCard title="Pagamentos">
          {charge.payments.length === 0 ? (
            <Typography color="text.secondary">Nenhum pagamento registrado.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Recebido em</TableCell>
                    <TableCell>Forma</TableCell>
                    <TableCell align="right">Valor</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Registrado por</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {charge.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatDateTime(payment.paidAt)}
                        {payment.notes && (
                          <Typography variant="caption" color="text.secondary" component="div">
                            {payment.notes}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{PAYMENT_METHODS[payment.method]}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {formatCents(payment.amountCents)}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{payment.recordedBy.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </SectionCard>
      </Stack>

      {dialog === 'payment' && <PaymentDialog charge={charge} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && <ChargeDialog charge={charge} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === 'cancel'}
        title="Cancelar cobrança?"
        description={`A cobrança "${charge.description}" (${formatCents(charge.amountCents)}) será cancelada. Esta ação não pode ser desfeita.`}
        confirmLabel="Cancelar cobrança"
        confirmColor="error"
        loading={cancel.isPending}
        error={cancel.error}
        onConfirm={() => cancel.mutate()}
        onClose={() => {
          setDialog(null);
          cancel.reset();
        }}
      />
    </Box>
  );
}

function AmountCard({ label, value, color = 'text.primary' }: { label: string; value: string; color?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color }}>
        {value}
      </Typography>
    </Paper>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="div">{children}</Typography>
    </Box>
  );
}
