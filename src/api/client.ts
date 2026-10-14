import { session } from '@/auth/session';
import type { ApiError as ApiErrorBody } from './types';

// Pode ser relativa (`/api`): em dev o Vite faz o proxy para a API, e em domínio próprio de
// clínica a API é servida no mesmo domínio. Assim o cookie de refresh (SameSite=Strict) vale.
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Renova o token quando falta menos que isto para vencer. */
const REFRESH_MARGIN_MS = 60_000;

// Rotas de autenticação não entram no ciclo "401 → refresh → repetir": o 401 delas é a resposta
// (senha errada, sessão encerrada), não um token vencido.
const AUTH_ROUTES = new Set([
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/accept-invite',
]);

type QueryValue = string | number | boolean | null | undefined | (string | number)[];

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
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
  const url = new URL(API_URL + path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
  }
  return url;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** A API informa valores em centavos nas mensagens ("excede o saldo (15000 centavos)"); exibimos em reais. */
const humanizeCents = (message: string) =>
  message.replace(/(\d+) centavos/g, (_, cents: string) => currency.format(Number(cents) / 100));

function messagesFor(status: number, body: ApiErrorBody | null): string[] {
  if (status === 429) return ['Muitas tentativas. Aguarde um minuto e tente novamente.'];
  if (status === 413) return ['O arquivo é grande demais.'];
  const message = body?.message;
  if (Array.isArray(message) && message.length > 0) return message.map(humanizeCents);
  if (typeof message === 'string' && message) return [humanizeCents(message)];
  if (status >= 500) return ['Erro inesperado no servidor. Tente novamente em instantes.'];
  return ['Não foi possível concluir a operação.'];
}

let refreshing: Promise<string | null> | null = null;

/**
 * Troca o cookie de refresh por um token de acesso novo e o guarda na sessão. Devolve `null` se
 * a sessão acabou (401). Um refresh por vez: chamadas simultâneas (várias requisições com o token
 * vencido, o carregamento da página) reaproveitam a mesma promessa, porque o refresh é rotativo e
 * um segundo envio do mesmo cookie fora da janela de tolerância encerraria a sessão.
 */
export function refreshSession(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const { accessToken } = await request<{ accessToken: string }>('/auth/refresh', { method: 'POST', auth: false });
      session.setToken(accessToken);
      return accessToken;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { method = 'GET', body, query, auth = true, signal } = options;
  const renewable = auth && !AUTH_ROUTES.has(path);

  // Renova antes de vencer, para a requisição não ir com um token que a API vai recusar.
  if (renewable && session.getToken() && session.expiresWithin(REFRESH_MARGIN_MS)) {
    if ((await refreshSession()) === null) {
      session.clear('expired');
      throw new ApiError(401, null, ['Sua sessão expirou. Entre novamente.']);
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  // FormData (upload) vai como está: o navegador define o Content-Type com o boundary do multipart.
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
  const token = auth ? session.getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal,
      // O cookie de refresh (HttpOnly) só vai e volta com `include`, também entre origens.
      credentials: 'include',
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
    if (response.status === 401 && token && renewable && !retried) {
      // O token já foi trocado enquanto esta requisição estava em voo (outro refresh, troca de
      // senha): repete com o atual. Senão, tenta renovar uma vez e repetir.
      const current = session.getToken();
      if (current && current !== token) return request<T>(path, options, true);
      if (await refreshSession()) return request<T>(path, options, true);
    }
    // Sessão encerrada de vez (refresh recusado, conta desativada, clínica suspensa): descarta a
    // sessão e os guards levam ao login. Só se o token recusado ainda for o atual: requisições
    // antigas em voo não podem derrubar uma sessão que já foi renovada.
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
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
