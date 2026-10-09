import type { AuditAction, AuditFieldChange, AuditLogEntry } from '@/api/audit';
import { formatCpf, formatDate } from '@/lib/format';
import { maskCep, maskPhone } from '@/lib/masks';

export const ACTION_LABELS: Record<AuditAction, string> = {
  'patient.view': 'Visualizou o cadastro',
  'patient.list': 'Pesquisou pacientes',
  'patient.list_removed': 'Pesquisou pacientes removidos',
  'patient.create': 'Cadastrou o paciente',
  'patient.update': 'Alterou o cadastro',
  'patient.delete': 'Removeu o paciente',
  'patient.restore': 'Restaurou o paciente',
  'clinical_record.create': 'Registrou ficha de anamnese',
  'clinical_record.list': 'Consultou as fichas de anamnese',
  'patient.export': 'Exportou os dados do paciente',
  'tenant.export': 'Exportou todos os dados da clínica',
  'tenant.closure_requested': 'Pediu o encerramento da conta',
  'tenant.closure_cancelled': 'Cancelou o encerramento da conta',
};

export const AUDIT_ACTIONS = Object.keys(ACTION_LABELS) as AuditAction[];

export const actionLabel = (action: AuditAction) => ACTION_LABELS[action] ?? action;

export const actorName = (entry: AuditLogEntry) => entry.actor.name ?? 'Usuário removido';

/** Rótulos do formulário de paciente, para exibir os campos alterados. */
const PATIENT_FIELDS: Record<string, string> = {
  fullName: 'Nome completo',
  cpf: 'CPF',
  birthDate: 'Data de nascimento',
  phone: 'Telefone',
  email: 'Email',
  address: 'Endereço',
  notes: 'Observações',
};

const ADDRESS_FIELDS: Record<string, string> = {
  cep: 'CEP',
  logradouro: 'Logradouro',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  cidade: 'Cidade',
  uf: 'UF',
};

export interface FieldChange {
  label: string;
  from: string;
  to: string;
}

const EMPTY = '—';

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY;
  if (typeof value !== 'string') return JSON.stringify(value);
  switch (field) {
    case 'cpf':
      return formatCpf(value);
    case 'birthDate':
      return formatDate(value);
    case 'phone':
      return maskPhone(value);
    case 'cep':
      return maskCep(value);
    default:
      return value;
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * Campos alterados de um `patient.update`, já com rótulos e valores formatados. O endereço
 * vem como objeto inteiro (antes/depois); aqui vira uma linha por subcampo que mudou.
 */
export function describeChanges(entry: AuditLogEntry): FieldChange[] {
  const changes = asRecord(entry.details?.changes) as Record<string, AuditFieldChange>;
  return Object.entries(changes).flatMap(([field, change]) => {
    if (field !== 'address') {
      return [
        {
          label: PATIENT_FIELDS[field] ?? field,
          from: formatValue(field, change.from),
          to: formatValue(field, change.to),
        },
      ];
    }
    const from = asRecord(change.from);
    const to = asRecord(change.to);
    const keys = [...new Set([...Object.keys(ADDRESS_FIELDS), ...Object.keys(from), ...Object.keys(to)])];
    return keys
      .filter((key) => (from[key] ?? '') !== (to[key] ?? ''))
      .map((key) => ({
        label: `Endereço · ${ADDRESS_FIELDS[key] ?? key}`,
        from: formatValue(key, from[key]),
        to: formatValue(key, to[key]),
      }));
  });
}

/** Complemento curto da ação (busca feita, quantidade de fichas…), ou null. */
export function detailSummary(entry: AuditLogEntry): string | null {
  const details = asRecord(entry.details);
  switch (entry.action) {
    case 'patient.list':
    case 'patient.list_removed': {
      const total = typeof details.total === 'number' ? ` · ${details.total} resultado(s)` : '';
      return details.q ? `Busca "${String(details.q)}"${total}` : `Lista sem busca${total}`;
    }
    case 'patient.export': {
      const parts = [
        typeof details.clinicalRecords === 'number' && `${details.clinicalRecords} ficha(s)`,
        typeof details.appointments === 'number' && `${details.appointments} agendamento(s)`,
        typeof details.charges === 'number' && `${details.charges} cobrança(s)`,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(' · ') : null;
    }
    case 'clinical_record.list':
      return typeof details.count === 'number' ? `${details.count} ficha(s)` : null;
    default:
      return null;
  }
}
