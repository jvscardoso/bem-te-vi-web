import { z } from 'zod';
import type { PatientAddress, PatientInput } from '@/api/patients';
import type { Patient } from '@/api/types';
import { toDateInputValue } from '@/lib/format';
import { maskCep, maskCpf, onlyDigits } from '@/lib/masks';

export const ADDRESS_KEYS = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'] as const;

const optionalDigits = (length: number, message: string) =>
  z.string().refine((value) => value === '' || onlyDigits(value).length === length, message);

export const patientSchema = z.object({
  fullName: z.string().trim().min(1, 'Informe o nome completo').max(150, 'Máximo de 150 caracteres'),
  cpf: optionalDigits(11, 'O CPF precisa ter 11 dígitos'),
  birthDate: z
    .string()
    .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Data inválida')
    .refine((value) => value === '' || value <= new Date().toISOString().slice(0, 10), 'Data no futuro'),
  phone: z.string().max(20, 'Máximo de 20 caracteres'),
  email: z.union([z.literal(''), z.email('Informe um email válido')]),
  address: z.object({
    cep: optionalDigits(8, 'O CEP precisa ter 8 dígitos'),
    logradouro: z.string().max(200),
    numero: z.string().max(20),
    complemento: z.string().max(100),
    bairro: z.string().max(100),
    cidade: z.string().max(100),
    uf: z.string().refine((value) => value === '' || /^[A-Za-z]{2}$/.test(value), 'Use a sigla (ex.: SP)'),
  }),
  notes: z.string(),
});

export type PatientFormValues = z.infer<typeof patientSchema>;

function readAddress(address: Patient['address']): PatientFormValues['address'] {
  const source = (address ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof source[key] === 'string' ? (source[key] as string) : '');
  return {
    cep: maskCep(text('cep')),
    logradouro: text('logradouro'),
    numero: text('numero'),
    complemento: text('complemento'),
    bairro: text('bairro'),
    cidade: text('cidade'),
    uf: text('uf'),
  };
}

export function toFormValues(patient?: Patient): PatientFormValues {
  return {
    fullName: patient?.fullName ?? '',
    cpf: maskCpf(patient?.cpf ?? ''),
    birthDate: toDateInputValue(patient?.birthDate),
    phone: patient?.phone ?? '',
    email: patient?.email ?? '',
    address: readAddress(patient?.address ?? null),
    notes: patient?.notes ?? '',
  };
}

/**
 * Monta o endereço preservando chaves desconhecidas (o campo é JSON livre e pode
 * ter sido gravado por outro cliente). Sem nenhum valor → null.
 */
function buildAddress(values: PatientFormValues['address'], original: Patient['address']): PatientAddress | null {
  const result: Record<string, unknown> = { ...(original ?? {}) };
  for (const key of ADDRESS_KEYS) delete result[key];
  for (const key of ADDRESS_KEYS) {
    let value = values[key].trim();
    if (key === 'cep') value = onlyDigits(value);
    if (key === 'uf') value = value.toUpperCase();
    if (value) result[key] = value;
  }
  return Object.keys(result).length > 0 ? (result as PatientAddress) : null;
}

/**
 * Converte o formulário no corpo da API.
 * Na criação, campos vazios são omitidos; na edição viram `null` (limpa o valor).
 */
export function toPatientInput(values: PatientFormValues, original?: Patient): PatientInput {
  const empty = original ? null : undefined;
  const opt = (value: string) => (value.trim() === '' ? empty : value.trim());
  const address = buildAddress(values.address, original?.address ?? null);

  return {
    fullName: values.fullName.trim(),
    cpf: values.cpf ? onlyDigits(values.cpf) : empty,
    birthDate: values.birthDate || empty,
    phone: opt(values.phone),
    email: opt(values.email),
    address: address ?? empty,
    notes: opt(values.notes),
  };
}
