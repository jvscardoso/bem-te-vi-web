import type { KeyboardEvent, MouseEvent } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Appointment } from '@/api/types';
import { formatLongDate, formatWeekdayShort, isSameDay, isSameMonth, toDateKey } from '@/lib/dates';
import { formatTime } from '@/lib/format';
import { ACTIVE_STATUSES, STATUS_LABELS } from './status';

// Acima disso a célula mostra "+N mais" e o dia completo fica na visão Dia.
const MAX_VISIBLE = 3;

interface MonthGridProps {
  /** Dias da grade, de segunda a domingo, em semanas completas. */
  days: Date[];
  /** Mês exibido: os dias de fora aparecem esmaecidos. */
  month: Date;
  appointments: Appointment[];
  colorFor: (appointment: Appointment) => string;
  showProfessional: boolean;
  /** Número do dia ou "+N mais": abre o dia na visão Dia. */
  onDayClick: (day: Date) => void;
  /** Clique no espaço vazio da célula (só com `appointments:write`). */
  onEmptyClick?: (day: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

/** Calendário do mês: até 3 agendamentos por dia, o resto na visão Dia. */
export function MonthGrid({
  days,
  month,
  appointments,
  colorFor,
  showProfessional,
  onDayClick,
  onEmptyClick,
  onAppointmentClick,
}: MonthGridProps) {
  const today = new Date();
  const sorted = [...appointments].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {days.slice(0, 7).map((day) => (
          <Typography
            key={day.getDay()}
            variant="caption"
            color="text.secondary"
            sx={{ py: 1, textAlign: 'center', textTransform: 'uppercase', borderBottom: 1, borderColor: 'divider' }}
          >
            {formatWeekdayShort(day)}
          </Typography>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {days.map((day, index) => {
          const items = sorted.filter((appointment) => isSameDay(new Date(appointment.scheduledAt), day));
          const outside = !isSameMonth(day, month);
          const isToday = isSameDay(day, today);
          const visible = items.length > MAX_VISIBLE ? items.slice(0, MAX_VISIBLE - 1) : items;
          const hidden = items.length - visible.length;

          return (
            <Box
              key={toDateKey(day)}
              onClick={onEmptyClick ? () => onEmptyClick(day) : undefined}
              sx={{
                minHeight: 120,
                p: 0.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.25,
                minWidth: 0,
                borderBottom: 1,
                borderLeft: index % 7 === 0 ? 0 : 1,
                borderColor: 'divider',
                bgcolor: outside ? 'action.hover' : undefined,
                cursor: onEmptyClick ? 'copy' : 'default',
                '&:hover': onEmptyClick ? { bgcolor: 'action.selected' } : undefined,
              }}
            >
              <ButtonBase
                onClick={(event) => {
                  event.stopPropagation();
                  onDayClick(day);
                }}
                aria-label={`Ver ${formatLongDate(day)} (${items.length} agendamento${items.length === 1 ? '' : 's'})`}
                sx={{
                  alignSelf: 'flex-start',
                  minWidth: 26,
                  height: 26,
                  px: 0.5,
                  borderRadius: 13,
                  typography: 'body2',
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? 'primary.contrastText' : outside ? 'text.disabled' : 'text.primary',
                  bgcolor: isToday ? 'primary.main' : undefined,
                  '&:hover': { bgcolor: isToday ? 'primary.dark' : 'action.focus' },
                }}
              >
                {day.getDate()}
              </ButtonBase>

              {visible.map((appointment) => (
                <MonthItem
                  key={appointment.id}
                  appointment={appointment}
                  color={colorFor(appointment)}
                  showProfessional={showProfessional}
                  onClick={onAppointmentClick}
                />
              ))}

              {hidden > 0 && (
                <ButtonBase
                  onClick={(event) => {
                    event.stopPropagation();
                    onDayClick(day);
                  }}
                  sx={{
                    alignSelf: 'flex-start',
                    px: 0.75,
                    borderRadius: 1,
                    typography: 'caption',
                    fontWeight: 600,
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'action.focus' },
                  }}
                >
                  +{hidden} mais
                </ButtonBase>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function MonthItem({
  appointment,
  color,
  showProfessional,
  onClick,
}: {
  appointment: Appointment;
  color: string;
  showProfessional: boolean;
  onClick: (appointment: Appointment) => void;
}) {
  const inactive = !ACTIVE_STATUSES.includes(appointment.status);
  const open = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
    onClick(appointment);
  };
  const label = [
    formatTime(appointment.scheduledAt),
    appointment.patient.fullName,
    showProfessional && appointment.professional.name,
    STATUS_LABELS[appointment.status],
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open(event);
        }
      }}
      sx={{
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        borderLeft: `3px solid ${color}`,
        bgcolor: alpha(color, inactive ? 0.06 : 0.14),
        opacity: inactive ? 0.7 : 1,
        cursor: 'pointer',
        minWidth: 0,
        '&:hover, &:focus-visible': { bgcolor: alpha(color, 0.24), outline: 'none' },
      }}
    >
      <Typography
        variant="caption"
        component="div"
        noWrap
        sx={{ lineHeight: 1.4, textDecoration: inactive ? 'line-through' : undefined }}
      >
        <Box component="span" sx={{ fontWeight: 600 }}>
          {formatTime(appointment.scheduledAt)}
        </Box>{' '}
        {appointment.patient.fullName}
      </Typography>
    </Box>
  );
}
