import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router';
import { Box, Button, ButtonBase, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { appointmentsApi, appointmentsKeys } from '@/api/appointments';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import {
  addDays,
  addMonths,
  DAY,
  formatLongDate,
  formatMonthYear,
  formatWeekdayShort,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from '@/lib/dates';
import { ACTIVE_STATUSES } from '@/pages/schedule/status';

/** Calendário compacto do mês: quantos atendimentos há em cada dia; clicar abre o dia na agenda. */
export function MonthCalendar() {
  const tenantId = useTenantId();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => startOfMonth(today));

  // Semanas completas (segunda a domingo), como a visão Mês da agenda.
  const start = startOfWeek(month);
  const end = addDays(startOfWeek(addDays(addMonths(month, 1), -1)), 7);
  const days = Array.from({ length: Math.round((end.getTime() - start.getTime()) / DAY) }, (_, index) =>
    addDays(start, index),
  );
  const params = { from: start.toISOString(), to: new Date(end.getTime() - 1).toISOString(), status: ACTIVE_STATUSES };

  const query = useQuery({
    queryKey: appointmentsKeys.range(tenantId, params),
    queryFn: () => appointmentsApi.listAll(tenantId, params),
    placeholderData: keepPreviousData,
  });

  const counts = new Map<string, number>();
  for (const appointment of query.data ?? []) {
    const key = toDateKey(new Date(appointment.scheduledAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }} noWrap>
          {formatMonthYear(month)}
        </Typography>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Tooltip title="Mês anterior">
            <IconButton size="small" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronLeft fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Próximo mês">
            <IconButton size="small" aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button component={RouterLink} to={`/agenda?visao=mes&data=${toDateKey(month)}`} size="small">
            {can('appointments:all') ? 'Agenda' : 'Sua agenda'}
          </Button>
        </Stack>
      </Stack>

      {query.error ? (
        <ErrorMessages error={query.error} />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5 }}>
          {days.slice(0, 7).map((day) => (
            <Typography
              key={day.getDay()}
              variant="caption"
              color="text.secondary"
              sx={{ textAlign: 'center', textTransform: 'uppercase', fontSize: 11 }}
            >
              {formatWeekdayShort(day).charAt(0)}
            </Typography>
          ))}
          {days.map((day) => {
            const count = counts.get(toDateKey(day)) ?? 0;
            const outside = !isSameMonth(day, month);
            const isToday = isSameDay(day, today);
            return (
              <ButtonBase
                key={toDateKey(day)}
                onClick={() => navigate(`/agenda?visao=dia&data=${toDateKey(day)}`)}
                aria-label={`${formatLongDate(day)}: ${count} atendimento${count === 1 ? '' : 's'}`}
                sx={{
                  flexDirection: 'column',
                  py: 0.5,
                  borderRadius: 1,
                  minHeight: 44,
                  border: 1,
                  borderColor: isToday ? 'primary.main' : 'transparent',
                  color: outside ? 'text.disabled' : 'text.primary',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: isToday ? 700 : 400, lineHeight: 1.4 }}>
                  {day.getDate()}
                </Typography>
                {count > 0 ? (
                  <Box
                    sx={{
                      minWidth: 18,
                      px: 0.5,
                      borderRadius: 9,
                      typography: 'caption',
                      fontSize: 11,
                      fontWeight: 700,
                      lineHeight: '16px',
                      bgcolor: outside ? 'action.selected' : 'primary.main',
                      color: outside ? 'text.secondary' : 'primary.contrastText',
                    }}
                  >
                    {count}
                  </Box>
                ) : (
                  <Box sx={{ height: 16 }} />
                )}
              </ButtonBase>
            );
          })}
        </Box>
      )}
    </Paper>
  );
}
