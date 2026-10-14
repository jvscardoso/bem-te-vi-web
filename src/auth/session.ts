// Guarda o token de acesso da sessão atual.
//
// Só em memória (task 21): um script injetado por XSS não acha o token no storage, e o que
// estiver em memória vale por poucos minutos (o token de acesso dura 15). Quem mantém a sessão
// entre reloads é o refresh token, num cookie HttpOnly que o JavaScript não lê; ao abrir a
// página, o AuthProvider troca esse cookie por um token novo (`POST /auth/refresh`).

export type LogoutReason = 'logout' | 'expired';

type Listener = () => void;

const listeners = new Set<Listener>();
let token: string | null = null;
/** Vencimento do token atual (ms), lido do `exp` do JWT. */
let expiresAt: number | null = null;
let lastLogoutReason: LogoutReason | null = null;

/** `exp` do JWT, sem validar a assinatura (quem valida é a API; aqui é só para renovar antes). */
function readExpiry(jwt: string): number | null {
  try {
    const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown };
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export const session = {
  getToken: () => token,

  /** O token vence em menos de `marginMs` (ou já venceu). Sem `exp` legível, conta como válido. */
  expiresWithin: (marginMs: number) => expiresAt !== null && expiresAt - Date.now() < marginMs,

  setToken(value: string) {
    token = value;
    expiresAt = readExpiry(value);
    lastLogoutReason = null;
    emit();
  },

  clear(reason: LogoutReason) {
    if (token === null) return;
    token = null;
    expiresAt = null;
    lastLogoutReason = reason;
    emit();
  },

  /** Motivo do último encerramento de sessão (para exibir aviso no login). */
  getLogoutReason: (): LogoutReason | null => lastLogoutReason,

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
