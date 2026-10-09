import type { ReactNode } from 'react';
import {
  AppBar,
  Box,
  Button,
  Dialog,
  Divider,
  GlobalStyles,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Toolbar,
  Typography,
} from '@mui/material';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import type { AnswerValue } from '@/api/anamnesis';
import type { PatientExport } from '@/api/patients';
import type { AnamnesisField, ChargeStatus } from '@/api/types';
import { formatCents, formatCpf, formatDate, formatDateTime } from '@/lib/format';
import { formatAnswer } from '@/pages/anamnesis/answers';
import { PAYMENT_METHODS } from '@/pages/billing/status';
import { STATUS_LABELS } from '@/pages/schedule/status';
import { addressLines } from '../address';

const CHARGE_STATUS: Record<ChargeStatus, string> = { pending: 'Pendente', paid: 'Paga', cancelled: 'Cancelada' };

/**
 * Impressão: só o conteúdo do relatório. O diálogo em tela cheia é `position: fixed`, que o
 * navegador imprimiria só na primeira página; aqui ele vira bloco normal e o app some.
 */
const printStyles = (
  <GlobalStyles
    styles={{
      '@media print': {
        '#root': { display: 'none' },
        '.export-view-toolbar': { display: 'none !important' },
        '.MuiDialog-root, .MuiDialog-container, .MuiDialog-paper': {
          position: 'static !important',
          display: 'block !important',
          height: 'auto !important',
          maxHeight: 'none !important',
          overflow: 'visible !important',
          boxShadow: 'none !important',
        },
        '.MuiBackdrop-root': { display: 'none !important' },
      },
    }}
  />
);

function answerText(value: unknown, type: AnamnesisField['type'] | null): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object' && !Array.isArray(value)) return JSON.stringify(value);
  return formatAnswer(value as AnswerValue, type ? ({ type } as AnamnesisField) : undefined);
}

/**
 * Versão legível do arquivo de exportação (LGPD), para o paciente que não sabe abrir um JSON:
 * mesma informação, organizada, com "Imprimir / salvar em PDF". Usa os dados já baixados, sem
 * nova chamada à API (cada exportação fica registrada na auditoria).
 */
export function PatientExportView({ data, onClose }: { data: PatientExport; onClose: () => void }) {
  const { patient } = data;
  const address = addressLines(patient.address);

  return (
    <Dialog open fullScreen onClose={onClose}>
      {printStyles}
      <AppBar position="sticky" color="default" elevation={0} className="export-view-toolbar">
        <Toolbar sx={{ gap: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Typography sx={{ flexGrow: 1, fontWeight: 600 }} noWrap>
            Dados do paciente · formato legível
          </Typography>
          <Button variant="contained" startIcon={<PrintOutlined />} onClick={() => window.print()}>
            Imprimir / salvar PDF
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 900, mx: 'auto', width: '100%' }}>
        <Stack spacing={4}>
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              {patient.fullName}
            </Typography>
            <Typography color="text.secondary">
              Dados mantidos por {data.clinic.name} · exportado em {formatDateTime(data.exportedAt)}
            </Typography>
            {patient.deletedAt && (
              <Typography color="text.secondary">Cadastro removido em {formatDateTime(patient.deletedAt)}</Typography>
            )}
          </Box>

          <Section title="Cadastro">
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
              <Field label="Nome completo">{patient.fullName}</Field>
              <Field label="CPF">{formatCpf(patient.cpf)}</Field>
              <Field label="Data de nascimento">{formatDate(patient.birthDate)}</Field>
              <Field label="Telefone">{patient.phone}</Field>
              <Field label="Email">{patient.email}</Field>
              <Field label="Cadastrado em">{formatDateTime(patient.createdAt)}</Field>
            </Box>
            <Field label="Endereço">{address.length > 0 ? address.join(' · ') : null}</Field>
            <Field label="Observações">{patient.notes}</Field>
          </Section>

          <Section title={`Fichas de anamnese (${data.clinicalRecords.length})`}>
            {data.clinicalRecords.length === 0 && <Empty />}
            {data.clinicalRecords.map((record) => (
              <Box key={record.id} sx={{ breakInside: 'avoid' }}>
                <Typography sx={{ fontWeight: 600 }}>{record.form.name}</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {formatDateTime(record.createdAt)}
                  {record.filledBy && ` · preenchida por ${record.filledBy.name}`}
                </Typography>
                <Stack spacing={1} sx={{ pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>
                  {record.answers.map((answer) => (
                    <Field key={answer.key} label={answer.label ?? `${answer.key} (campo retirado do formulário)`}>
                      {answerText(answer.value, answer.type)}
                    </Field>
                  ))}
                </Stack>
              </Box>
            ))}
          </Section>

          <Section title={`Agendamentos (${data.appointments.length})`}>
            {data.appointments.length === 0 ? (
              <Empty />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Profissional</TableCell>
                    <TableCell>Situação</TableCell>
                    <TableCell>Observações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.appointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(appointment.scheduledAt)}</TableCell>
                      <TableCell>{appointment.professional.name}</TableCell>
                      <TableCell>{STATUS_LABELS[appointment.status] ?? appointment.status}</TableCell>
                      <TableCell>{appointment.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section title={`Cobranças (${data.charges.length})`}>
            {data.charges.length === 0 && <Empty />}
            {data.charges.map((charge) => (
              <Box key={charge.id} sx={{ breakInside: 'avoid' }}>
                <Typography sx={{ fontWeight: 600 }}>
                  {charge.description} · {formatCents(charge.amountCents)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Vencimento {formatDate(charge.dueDate)} · {CHARGE_STATUS[charge.status] ?? charge.status}
                </Typography>
                {charge.payments.map((payment) => (
                  <Typography key={payment.id} variant="body2" sx={{ pl: 1.5 }}>
                    Pagamento de {formatCents(payment.amountCents)} em {formatDate(payment.paidAt)} (
                    {PAYMENT_METHODS[payment.method] ?? payment.method}){payment.notes && ` · ${payment.notes}`}
                  </Typography>
                ))}
              </Box>
            ))}
          </Section>
        </Stack>
      </Box>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section">
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Stack spacing={2}>{children}</Stack>
    </Box>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
        {children || '—'}
      </Typography>
    </Box>
  );
}

function Empty() {
  return (
    <Typography variant="body2" color="text.secondary">
      Nenhum registro.
    </Typography>
  );
}
