import type { LegalDocument } from '@/api/types';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalText {
  /** Início da vigência (AAAA-MM-DD). */
  effectiveDate: string;
  sections: LegalSection[];
}

interface LegalDocumentInfo {
  title: string;
  path: string;
  /** Texto de cada versão publicada, pela chave da versão da API ("1", "2"…). */
  texts: Record<string, LegalText>;
}

/**
 * Termos de Uso e Política de Privacidade do produto bem-te-vi (não da clínica).
 *
 * A versão vigente é a da API (`GET /public/legal`); aqui fica o texto de cada versão. Para
 * publicar um texto novo, cadastre-o com a próxima versão e peça à sessão da API para subir
 * `LEGAL_TERMS_VERSION` / `LEGAL_PRIVACY_VERSION`: todos os usuários passam a ter aceite pendente.
 *
 * TODO: cadastrar os textos oficiais (dependem do jurídico). Sem texto para a versão vigente,
 * a página mostra o aviso de texto em elaboração.
 */
export const LEGAL_DOCUMENTS: Record<LegalDocument, LegalDocumentInfo> = {
  terms: { title: 'Termos de Uso', path: '/termos', texts: {} },
  privacy: { title: 'Política de Privacidade', path: '/privacidade', texts: {} },
};
