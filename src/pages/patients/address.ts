import { maskCep } from '@/lib/masks';

/** Endereço do paciente em até três linhas legíveis (rua, bairro/cidade, CEP). */
export function addressLines(value: unknown): string[] {
  const address = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const text = (key: string) => (typeof address[key] === 'string' ? (address[key] as string) : '');

  const street = [text('logradouro'), text('numero')].filter(Boolean).join(', ');
  const cityLine = [text('bairro'), [text('cidade'), text('uf')].filter(Boolean).join('/')].filter(Boolean).join(' · ');
  return [
    [street, text('complemento')].filter(Boolean).join(' — '),
    cityLine,
    text('cep') && `CEP ${maskCep(text('cep'))}`,
  ].filter(Boolean);
}
