// Máscaras progressivas para campos digitados (aplicadas a cada tecla).

const digits = (value: string) => value.replace(/\D/g, '');

/** "12345678901" → "123.456.789-01" (parcial enquanto digita) */
export function maskCpf(value: string): string {
  const d = digits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Celular "(11) 91234-5678" ou fixo "(11) 1234-5678" */
export function maskPhone(value: string): string {
  const d = digits(value).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** "01310100" → "01310-100" */
export function maskCep(value: string): string {
  const d = digits(value).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

export const onlyDigits = digits;

/** Senha aleatória legível (sem 0/O, 1/l/I) para o admin repassar ao usuário. */
export function generatePassword(length = 12): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

const moneyFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Dinheiro digitado da direita para a esquerda: "15000" → "150,00". */
export function maskMoney(value: string): string {
  const d = digits(value).replace(/^0+/, '').slice(0, 11);
  return d ? moneyFormat.format(Number(d) / 100) : '';
}

/** "1.234,50" → 123450 (0 se vazio). */
export function moneyToCents(value: string): number {
  return Number(digits(value) || '0');
}

/** 123450 → "1.234,50" (valor inicial para o campo mascarado). */
export function centsToMoney(cents: number): string {
  return cents > 0 ? moneyFormat.format(cents / 100) : '';
}
