import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi, appointmentsKeys } from '@/api/appointments';
import type { Appointment } from '@/api/types';
import { useTenantId } from '@/auth/AuthContext';
import { addDays, startOfDay } from '@/lib/dates';

/**
 * Atendimentos de hoje (exceto cancelados). Os blocos "Agenda de hoje" e "Atendimentos de hoje"
 * usam a mesma chave, então dividem uma única consulta. Sem `appointments:all` a API já
 * devolve só a própria agenda.
 */
export function useTodayAppointments() {
  const tenantId = useTenantId();
  // Momento de referência fixado ao abrir a tela (React Compiler exige render puro).
  const [now] = useState(() => Date.now());

  const today = startOfDay(new Date(now));
  const params = {
    from: today.toISOString(),
    to: new Date(addDays(today, 1).getTime() - 1).toISOString(),
    status: ['scheduled', 'confirmed', 'completed', 'no_show'] as Appointment['status'][],
  };

  const query = useQuery({
    queryKey: appointmentsKeys.range(tenantId, params),
    queryFn: () => appointmentsApi.listAll(tenantId, params),
  });

  return { query, now };
}

export const isPending = (appointment: Appointment) =>
  appointment.status === 'scheduled' || appointment.status === 'confirmed';
