const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateOnly = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** 15000 → "R$ 150,00" */
export function formatCents(cents: number): string {
  return currency.format(cents / 100);
}

/** "150,50" | "R$ 1.234,5" → 123450. Retorna null se inválido. */
export function parseMoneyToCents(value: string): number | null {
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

/** "12345678901" → "123.456.789-01" */
export function formatCpf(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Campos só-data (birthDate, dueDate) voltam como meia-noite UTC;
 * formatar em UTC evita exibir o dia anterior no fuso do Brasil.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  return dateOnly.format(new Date(value));
}

/** Data e hora no fuso local do navegador. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  return dateTime.format(new Date(value));
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  return time.format(new Date(value));
}
