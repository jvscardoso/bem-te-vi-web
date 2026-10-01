import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Appointment } from '@/api/types';
import { addMinutes, minutesSinceMidnight, startOfDay } from '@/lib/dates';
import { formatTime } from '@/lib/format';
import { ACTIVE_STATUSES, STATUS_LABELS } from './status';

const HOUR_HEIGHT = 56;
const SLOT_MINUTES = 15;
const GUTTER_WIDTH = 56;

export interface GridColumn {
  key: string;
  header: ReactNode;
  /** Dia da coluna (meia-noite local). */
  day: Date;
  isToday: boolean;
  /** Na visão por profissional, o clique já traz o profissional. */
  professionalId?: string;
  appointments: Appointment[];
}

interface TimeGridProps {
  columns: GridColumn[];
  startHour: number;
  endHour: number;
  colorFor: (appointment: Appointment) => string;
  showProfessional: boolean;
  onSlotClick?: (column: GridColumn, start: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

interface Placed {
  appointment: Appointment;
  lane: number;
  lanes: number;
}

/** Distribui agendamentos sobrepostos lado a lado (faixas). */
function layoutColumn(appointments: Appointment[]): Placed[] {
  const sorted = [...appointments].sort(
    (a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.endsAt.localeCompare(b.endsAt),
  );
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    cluster.forEach((item) => (item.lanes = laneEnds.length));
    cluster = [];
    laneEnds = [];
  };

  for (const appointment of sorted) {
    const start = new Date(appointment.scheduledAt).getTime();
    const end = new Date(appointment.endsAt).getTime();
    if (start >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    const item = { appointment, lane, lanes: 1 };
    cluster.push(item);
    placed.push(item);
    clusterEnd = Math.max(clusterEnd, end);
  }
  closeCluster();
  return placed;
}

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function TimeGrid({
  columns,
  startHour,
  endHour,
  colorFor,
  showProfessional,
  onSlotClick,
  onAppointmentClick,
}: TimeGridProps) {
  const now = useNow();
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const bodyHeight = hours.length * HOUR_HEIGHT;
  const minColumnWidth = columns.length > 3 ? 120 : 200;

  const toY = (minutes: number) => ((minutes - startHour * 60) / 60) * HOUR_HEIGHT;

  const handleSlotClick = (column: GridColumn) => (event: MouseEvent<HTMLDivElement>) => {
    if (!onSlotClick) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = startHour * 60 + ((event.clientY - rect.top) / HOUR_HEIGHT) * 60;
    const snapped = Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES;
    onSlotClick(column, addMinutes(column.day, snapped));
  };

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `${GUTTER_WIDTH}px repeat(${columns.length}, minmax(${minColumnWidth}px, 1fr))`,
          minWidth: GUTTER_WIDTH + columns.length * minColumnWidth,
        }}
      >
        {/* Cabeçalho */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }} />
        {columns.map((column) => (
          <Box
            key={column.key}
            sx={{
              py: 1,
              px: 1,
              textAlign: 'center',
              borderBottom: 1,
              borderLeft: 1,
              borderColor: 'divider',
              bgcolor: column.isToday ? (theme) => alpha(theme.palette.primary.main, 0.06) : undefined,
            }}
          >
            {column.header}
          </Box>
        ))}

        {/* Horas */}
        <Box sx={{ position: 'relative', height: bodyHeight }}>
          {hours.map((hour) => (
            <Typography
              key={hour}
              variant="caption"
              color="text.secondary"
              sx={{ position: 'absolute', top: toY(hour * 60) - 8, right: 8 }}
            >
              {hour > startHour && `${String(hour).padStart(2, '0')}:00`}
            </Typography>
          ))}
        </Box>

        {/* Colunas */}
        {columns.map((column) => {
          const dayStart = startOfDay(column.day).getTime();
          const nowMinutes = minutesSinceMidnight(now);
          const showNow = column.isToday && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60;

          return (
            <Box
              key={column.key}
              onClick={handleSlotClick(column)}
              sx={{
                position: 'relative',
                height: bodyHeight,
                borderLeft: 1,
                borderColor: 'divider',
                cursor: onSlotClick ? 'copy' : 'default',
                backgroundImage: (theme) =>
                  `repeating-linear-gradient(to bottom, ${theme.palette.divider} 0 1px, transparent 1px ${HOUR_HEIGHT / 2}px)`,
                backgroundSize: `100% ${HOUR_HEIGHT}px`,
                '&:hover': onSlotClick ? { bgcolor: 'action.hover' } : undefined,
              }}
            >
              {layoutColumn(column.appointments).map(({ appointment, lane, lanes }) => {
                const start = new Date(appointment.scheduledAt);
                const end = new Date(appointment.endsAt);
                // Recorta ao dia da coluna (atendimentos que cruzam a meia-noite).
                const startMinutes = Math.max((start.getTime() - dayStart) / 60_000, startHour * 60);
                const endMinutes = Math.min((end.getTime() - dayStart) / 60_000, endHour * 60);
                const top = toY(startMinutes);
                const height = Math.max(toY(endMinutes) - top, 22);
                const color = colorFor(appointment);
                const inactive = !ACTIVE_STATUSES.includes(appointment.status);
                const compact = height < 44;

                return (
                  <Box
                    key={appointment.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${formatTime(appointment.scheduledAt)} ${appointment.patient.fullName}, ${STATUS_LABELS[appointment.status]}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAppointmentClick(appointment);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onAppointmentClick(appointment);
                      }
                    }}
                    sx={{
                      position: 'absolute',
                      top: top + 1,
                      height: height - 2,
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                      px: 0.75,
                      py: compact ? 0.25 : 0.5,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      borderRadius: 1,
                      borderLeft: `3px solid ${color}`,
                      bgcolor: alpha(color, inactive ? 0.06 : 0.14),
                      opacity: inactive ? 0.7 : 1,
                      '&:hover, &:focus-visible': { bgcolor: alpha(color, 0.24), outline: 'none', zIndex: 1 },
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="div"
                      noWrap
                      sx={{ fontWeight: 600, lineHeight: 1.3, textDecoration: inactive ? 'line-through' : undefined }}
                    >
                      {compact && `${formatTime(appointment.scheduledAt)} `}
                      {appointment.patient.fullName}
                    </Typography>
                    {!compact && (
                      <Typography variant="caption" component="div" color="text.secondary" noWrap sx={{ lineHeight: 1.3 }}>
                        {formatTime(appointment.scheduledAt)}–{formatTime(appointment.endsAt)}
                        {showProfessional && ` · ${appointment.professional.name}`}
                        {inactive && ` · ${STATUS_LABELS[appointment.status]}`}
                      </Typography>
                    )}
                  </Box>
                );
              })}

              {showNow && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: toY(nowMinutes),
                    borderTop: 2,
                    borderColor: 'error.main',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
