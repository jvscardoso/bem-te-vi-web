import type { AuthContextValue } from '@/auth/AuthContext';

type Can = AuthContextValue['can'];

/**
 * Tem alguma agenda para ver: a de todos (`appointments:all`) ou a própria, e só tem agenda
 * própria quem atende (`appointments:attend`, task 23).
 */
export const hasAnyAgenda = (can: Can) => can('appointments:all') || can('appointments:attend');

/**
 * Pode criar agendamento: além de `appointments:write`, precisa de um profissional possível.
 * Sem `all`, o profissional é sempre o próprio usuário, e a API recusa quem não atende (400).
 * Editar os já existentes continua só com `appointments:write`.
 */
export const canCreateAppointments = (can: Can) => can('appointments:write') && hasAnyAgenda(can);
