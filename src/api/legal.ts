import { ApiError, api } from './client';
import type { LegalDocument } from './types';

/** Versões que a pessoa viu e aceitou (precisam ser as vigentes, ou a API responde 400). */
export interface LegalAcceptance {
  termsVersion: string;
  privacyVersion: string;
}

export interface LegalVersions {
  terms: { version: string };
  privacy: { version: string };
}

export const legalKeys = { current: ['public-legal'] as const };

export const legalApi = {
  /** Versões vigentes dos Termos de Uso e da Política de Privacidade (os textos ficam no front). */
  current: () => api.get<LegalVersions>('/public/legal', undefined, { auth: false }),

  /** Aceite do usuário logado (pendências de `GET /auth/me`). Sempre as duas versões vigentes. */
  accept: (acceptance: LegalAcceptance) =>
    api.post<{ pendingLegalDocuments: LegalDocument[] }>('/auth/me/legal-acceptances', acceptance),
};

export function toLegalAcceptance(versions: LegalVersions): LegalAcceptance {
  return { termsVersion: versions.terms.version, privacyVersion: versions.privacy.version };
}

/**
 * 400 de versão desatualizada: os documentos mudaram enquanto a tela estava aberta. A API
 * não cria nada (no convite, o link continua valendo); recarregue as versões e peça o aceite de novo.
 */
export function isOutdatedLegalVersion(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 400 &&
    error.messages.some((message) => message.startsWith('Aceite a versão vigente'))
  );
}
