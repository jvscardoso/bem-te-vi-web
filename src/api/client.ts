import { session } from '@/auth/session';
import type { ApiError as ApiErrorBody } from './types';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

type QueryValue = string | number | boolean | null | undefined | (string | number)[];

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Envia o Bearer token (padrão: true). */
  auth?: boolean;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;
  /** Mensagens prontas para exibir (a API manda string ou array). */
  readonly messages: string[];

  constructor(status: number, body: ApiErrorBody | null, messages: string[]) {
    super(messages.join('\n'));
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.messages = messages;
  }
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(API_URL + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
  }
  return url;
}

function messagesFor(status: number, body: ApiErrorBody | null): string[] {
  if (status === 429) return ['Muitas tentativas. Aguarde um minuto e tente novamente.'];
  const message = body?.message;
  if (Array.isArray(message) && message.length > 0) return message;
  if (typeof message === 'string' && message) return [message];
  if (status >= 500) return ['Erro inesperado no servidor. Tente novamente em instantes.'];
  return ['Não foi possível concluir a operação.'];
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? session.getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, null, ['Não foi possível conectar ao servidor. Verifique sua conexão.']);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorBody = (data as ApiErrorBody | null) ?? null;
    // Token expirado, usuário desativado, clínica suspensa ou sessão encerrada
    // pela troca de senha: descarta a sessão (os guards levam ao login).
    // Só se o token recusado ainda for o atual — após trocar a própria senha,
    // requisições antigas em voo não podem derrubar a sessão nova.
    if (response.status === 401 && token && session.getToken() === token) session.clear('expired');
    throw new ApiError(response.status, errorBody, messagesFor(response.status, errorBody));
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], options?: Omit<RequestOptions, 'method' | 'query'>) =>
    request<T>(path, { ...options, method: 'GET', query }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
