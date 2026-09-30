// Guarda o token de acesso da sessão atual.
//
// Usamos sessionStorage (e não localStorage): o token sobrevive a um reload,
// mas não é compartilhado entre abas nem persiste após fechar o navegador,
// reduzindo a janela de exposição em máquinas compartilhadas (recepção etc.).

const TOKEN_KEY = 'btv.accessToken';

export type LogoutReason = 'logout' | 'expired';

type Listener = () => void;

const listeners = new Set<Listener>();
let token: string | null = readToken();
let lastLogoutReason: LogoutReason | null = null;

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(value: string | null) {
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Armazenamento indisponível (modo privado etc.): segue só em memória.
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export const session = {
  getToken: () => token,

  setToken(value: string) {
    token = value;
    lastLogoutReason = null;
    writeToken(value);
    emit();
  },

  clear(reason: LogoutReason) {
    if (token === null) return;
    token = null;
    lastLogoutReason = reason;
    writeToken(null);
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
