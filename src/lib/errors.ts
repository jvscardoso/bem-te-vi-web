import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/api/client';

/** Mensagens exibíveis para qualquer erro (da API, texto pronto ou inesperado). */
export function getErrorMessages(error: unknown): string[] {
  if (error instanceof ApiError) return error.messages;
  if (typeof error === 'string') return [error];
  if (Array.isArray(error) && error.every((item) => typeof item === 'string')) return error;
  return ['Ocorreu um erro inesperado.'];
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}

/**
 * Mostra embaixo de cada campo os erros de validação que a API devolve por campo (`errors`, nos
 * `400`) e devolve o que sobra para a área de erros (`<ErrorMessages>`): o próprio erro, quando
 * não há erro por campo (regra de negócio, `409`, rede); as frases dos campos que a tela não
 * mostra; ou `null`, quando tudo foi para os campos.
 *
 * `fields`: os campos da tela (mesmo caminho da API, ex.: `address.cep`). `fieldMap`: caminho da
 * API → nome do campo na tela, quando são diferentes.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
  fieldMap: Partial<Record<string, Path<T>>> = {},
): unknown {
  const items = error instanceof ApiError ? (error.body?.errors ?? []) : [];
  if (items.length === 0) return error;

  const rest: string[] = [];
  let first = true;
  for (const item of items) {
    const name = fieldMap[item.field] ?? (fields.includes(item.field) ? (item.field as Path<T>) : undefined);
    if (!name) {
      rest.push(item.message);
      continue;
    }
    setError(name, { type: 'server', message: item.message }, { shouldFocus: first });
    first = false;
  }
  return rest.length > 0 ? rest : null;
}
