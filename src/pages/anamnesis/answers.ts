import type { AnswerValue } from '@/api/anamnesis';
import type { AnamnesisField } from '@/api/types';
import { formatDate } from '@/lib/format';

/**
 * Valor no formulário: string para quase tudo (inclusive number, convertido no envio),
 * 'true' | 'false' | '' para boolean (permite "não respondido") e string[] para multiselect.
 */
export type FormAnswer = string | string[];
export type FormAnswers = Record<string, FormAnswer>;

export function emptyAnswer(field: AnamnesisField): FormAnswer {
  return field.type === 'multiselect' ? [] : '';
}

export function emptyAnswers(fields: AnamnesisField[]): FormAnswers {
  return Object.fromEntries(fields.map((field) => [field.key, emptyAnswer(field)]));
}

const isBlank = (value: FormAnswer | undefined) =>
  value === undefined || (Array.isArray(value) ? value.length === 0 : value.trim() === '');

/** Regras equivalentes às da API, para feedback antes do envio. */
export function validateAnswer(field: AnamnesisField, value: FormAnswer | undefined): string | true {
  if (isBlank(value)) return field.required ? 'Campo obrigatório' : true;
  if (field.type === 'number' && !Number.isFinite(Number(String(value).replace(',', '.')))) {
    return 'Informe um número';
  }
  return true;
}

/** Converte para o JSON da API, omitindo campos opcionais não respondidos. */
export function toApiAnswers(fields: AnamnesisField[], values: FormAnswers): Record<string, AnswerValue> {
  const answers: Record<string, AnswerValue> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (isBlank(value)) continue;
    switch (field.type) {
      case 'number':
        answers[field.key] = Number(String(value).replace(',', '.'));
        break;
      case 'boolean':
        answers[field.key] = value === 'true';
        break;
      case 'multiselect':
        answers[field.key] = value as string[];
        break;
      default:
        answers[field.key] = (value as string).trim();
    }
  }
  return answers;
}

/** Texto de exibição de uma resposta (o tipo vem do campo ou é inferido do valor). */
export function formatAnswer(value: AnswerValue, field?: AnamnesisField): string {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  if (field?.type === 'date' || (!field && /^\d{4}-\d{2}-\d{2}$/.test(value))) return formatDate(value);
  return value;
}

export interface AnswerRow {
  key: string;
  label: string;
  value: string;
  multiline: boolean;
}

/**
 * Linhas para exibir uma ficha: campos do formulário na ordem atual (pulando os
 * sem resposta) + respostas cujas chaves não existem mais no formulário.
 */
export function answerRows(answers: Record<string, AnswerValue>, fields: AnamnesisField[] = []): AnswerRow[] {
  const known = new Set(fields.map((field) => field.key));
  const rows: AnswerRow[] = [];
  for (const field of fields) {
    if (!(field.key in answers)) continue;
    rows.push({
      key: field.key,
      label: field.label,
      value: formatAnswer(answers[field.key], field),
      multiline: field.type === 'textarea',
    });
  }
  for (const [key, value] of Object.entries(answers)) {
    if (known.has(key)) continue;
    rows.push({ key, label: key, value: formatAnswer(value), multiline: typeof value === 'string' && value.length > 60 });
  }
  return rows;
}

const KEYED_MESSAGE = /^"([a-z][a-z0-9_]*)"\s+(.+)$/;

/**
 * Separa os erros de validação da API (`"queixa" é obrigatório`) em erros por
 * campo (exibidos junto do campo) e erros gerais.
 */
export function splitAnswerErrors(messages: string[], fields: AnamnesisField[]) {
  const byKey: Record<string, string> = {};
  const general: string[] = [];
  const labels = new Map(fields.map((field) => [field.key, field.label]));

  for (const message of messages) {
    const match = KEYED_MESSAGE.exec(message);
    if (match && labels.has(match[1])) {
      const text = match[2];
      byKey[match[1]] = text.charAt(0).toUpperCase() + text.slice(1);
    } else {
      general.push(message);
    }
  }
  return { byKey, general };
}
