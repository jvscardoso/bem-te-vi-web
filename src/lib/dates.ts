// Datas no fuso local do navegador. A API trabalha em UTC (ISO 8601); a conversão
// acontece via Date: montamos datas locais e enviamos com toISOString().

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE);
}

/** Semana começando na segunda-feira. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7;
  return addDays(day, -offset);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Date local → "2026-10-01" */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10-01" → Date local (meia-noite). Inválida → null. */
export function fromDateKey(value: string | null | undefined): Date | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date local → "14:30" */
export function toTimeKey(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** ("2026-10-01", "14:30") → Date local. Inválida → null. */
export function combineDateTime(dateKey: string, timeKey: string): Date | null {
  const date = fromDateKey(dateKey);
  const match = /^(\d{2}):(\d{2})$/.exec(timeKey);
  if (!date || !match) return null;
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

const weekdayShort = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "seg." */
export const formatWeekdayShort = (date: Date) => weekdayShort.format(date).replace('.', '');
/** "01/10" */
export const formatDayMonth = (date: Date) => dayMonth.format(date);
/** "Quinta-feira, 1 de outubro" */
export const formatLongDate = (date: Date) => capitalize(longDate.format(date));
/** "Outubro de 2026" */
export const formatMonthYear = (date: Date) => capitalize(monthYear.format(date));
