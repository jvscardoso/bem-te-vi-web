import { api } from './client';

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
};

export function toLegalAcceptance(versions: LegalVersions): LegalAcceptance {
  return { termsVersion: versions.terms.version, privacyVersion: versions.privacy.version };
}
