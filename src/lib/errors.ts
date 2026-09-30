import { ApiError } from '@/api/client';

/** Mensagens exibíveis para qualquer erro (da API ou inesperado). */
export function getErrorMessages(error: unknown): string[] {
  if (error instanceof ApiError) return error.messages;
  return ['Ocorreu um erro inesperado.'];
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}
