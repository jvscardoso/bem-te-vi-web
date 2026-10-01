import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { appointmentsApi, appointmentsKeys } from '@/api/appointments';
import type { Appointment } from '@/api/types';
import { usersApi, usersKeys } from '@/api/users';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import {
  addDays,
  formatDayMonth,
  formatLongDate,
  formatMonthYear,
  formatWeekdayShort,
  fromDateKey,
  isSameDay,
  startOfDay,
  startOfWeek,
  toDateKey,
} from '@/lib/dates';
import { AgendaList } from './AgendaList';
import { AppointmentDialog, type AppointmentDraft } from './AppointmentDialog';
import { ACTIVE_STATUSES, ALL_STATUSES, professionalColor } from './status';
import { TimeGrid, type GridColumn } from './TimeGrid';

type View = 'dia' | 'semana';

const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 20;

type DialogState = { appointment: Appointment } | { draft: AppointmentDraft } | null;

export function SchedulePage() {
  const tenantId = useTenantId();
  const { can } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<DialogState>(null);

  // Estado na URL: ?data=2026-10-01&visao=dia&profissional=<id>&todos=1
  const date = fromDateKey(params.get('data')) ?? startOfDay(new Date());
  const view: View = params.get('visao') === 'dia' ? 'dia' : 'semana';
  const professionalId = params.get('profissional') ?? '';
  const showInactive = params.get('todos') === '1';

  const updateParams = (changes: Record<string, string | null>) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        return next;
      },
      { replace: true },
    );

  const rangeStart = view === 'dia' ? startOfDay(date) : startOfWeek(date);
  const days = view === 'dia' ? 1 : 7;
  const rangeEnd = addDays(rangeStart, days);

  const listParams = {
    professionalId: professionalId || undefined,
    from: rangeStart.toISOString(),
    // `to` é inclusivo para o início: 1 ms antes do fim da janela.
    to: new Date(rangeEnd.getTime() - 1).toISOString(),
    status: showInactive ? ALL_STATUSES : ACTIVE_STATUSES,
  };

  const professionals = useQuery({
    queryKey: usersKeys.professionals(tenantId),
    queryFn: () => usersApi.professionals(tenantId),
  });
  const appointments = useQuery({
    queryKey: appointmentsKeys.range(tenantId, listParams),
    queryFn: () => appointmentsApi.listAll(tenantId, listParams),
    placeholderData: keepPreviousData,
  });

  const colorIndex = useMemo(
    () => new Map((professionals.data ?? []).map((professional, index) => [professional.id, index])),
    [professionals.data],
  );
  const colorFor = (appointment: Appointment) =>
    professionalColor(colorIndex.get(appointment.professionalId) ?? colorIndex.size);

  const items = appointments.data ?? [];
  const today = new Date();
  const canWrite = can('appointments:write');
  const showProfessional = !professionalId;

  // Colunas: por profissional (dia, todos) ou por dia (semana / um profissional).
  const buildColumns = (): GridColumn[] => {
    if (view === 'dia' && !professionalId) {
      const pros = [...(professionals.data ?? [])];
      // Profissional desativado com agendamentos no dia também ganha coluna.
      for (const appointment of items) {
        if (!pros.some((pro) => pro.id === appointment.professionalId)) {
          pros.push({
            id: appointment.professionalId,
            name: appointment.professional.name,
            defaultAppointmentDurationMinutes: null,
            effectiveAppointmentDurationMinutes: 0,
          });
        }
      }
      return pros.map((pro, index) => ({
        key: pro.id,
        header: (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: professionalColor(colorIndex.get(pro.id) ?? index) }} />
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
              {pro.name}
            </Typography>
          </Stack>
        ),
        day: rangeStart,
        isToday: isSameDay(rangeStart, today),
        professionalId: pro.id,
        appointments: items.filter((appointment) => appointment.professionalId === pro.id),
      }));
    }

    return Array.from({ length: days }, (_, index) => {
      const day = addDays(rangeStart, index);
      const isToday = isSameDay(day, today);
      return {
        key: toDateKey(day),
        header: (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
              {formatWeekdayShort(day)}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: isToday ? 700 : 500, color: isToday ? 'primary.main' : undefined }}>
              {formatDayMonth(day)}
            </Typography>
          </Box>
        ),
        day,
        isToday,
        professionalId: professionalId || undefined,
        appointments: items.filter((appointment) => isSameDay(new Date(appointment.scheduledAt), day)),
      };
    });
  };
  const columns = buildColumns();

  // Faixa de horas: padrão 7h–20h, ampliada para caber todos os agendamentos.
  const hourRange = (): [number, number] => {
    let min = DEFAULT_START_HOUR;
    let max = DEFAULT_END_HOUR;
    for (const appointment of items) {
      const start = new Date(appointment.scheduledAt);
      const end = new Date(appointment.endsAt);
      min = Math.min(min, start.getHours());
      // Atendimento que cruza a meia-noite vai até o fim do dia.
      max = Math.max(max, isSameDay(start, end) ? Math.ceil(end.getHours() + end.getMinutes() / 60) : 24);
    }
    return [min, Math.min(max, 24)];
  };
  const [startHour, endHour] = hourRange();

  const title =
    view === 'dia'
      ? formatLongDate(rangeStart)
      : `${formatDayMonth(rangeStart)} a ${formatDayMonth(addDays(rangeEnd, -1))} · ${formatMonthYear(rangeStart)}`;

  const step = (direction: -1 | 1) => updateParams({ data: toDateKey(addDays(date, direction * days)) });

  const newAppointment = () => {
    const start = new Date();
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
    const base = isSameDay(date, new Date()) ? start : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9);
    setDialog({ draft: { start: base, professionalId: professionalId || undefined } });
  };

  return (
    <>
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' } }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Button variant="outlined" size="small" onClick={() => updateParams({ data: null })}>
              Hoje
            </Button>
            <Tooltip title={view === 'dia' ? 'Dia anterior' : 'Semana anterior'}>
              <IconButton aria-label="Anterior" onClick={() => step(-1)}>
                <ChevronLeft />
              </IconButton>
            </Tooltip>
            <Tooltip title={view === 'dia' ? 'Próximo dia' : 'Próxima semana'}>
              <IconButton aria-label="Próximo" onClick={() => step(1)}>
                <ChevronRight />
              </IconButton>
            </Tooltip>
            <Typography variant="h6" component="h1" sx={{ fontWeight: 600, ml: 1 }}>
              {title}
            </Typography>
          </Stack>
          {canWrite && (
            <Button variant="contained" startIcon={<AddOutlined />} onClick={newAppointment}>
              Novo agendamento
            </Button>
          )}
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, value: View | null) => value && updateParams({ visao: value === 'semana' ? null : value })}
          >
            <ToggleButton value="dia">Dia</ToggleButton>
            <ToggleButton value="semana">Semana</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            select
            size="small"
            label="Profissional"
            value={professionalId}
            onChange={(event) => updateParams({ profissional: event.target.value || null })}
            sx={{ minWidth: 220 }}
            // Mostra "Todos os profissionais" (valor vazio) em vez de um campo em branco.
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          >
            <MenuItem value="">Todos os profissionais</MenuItem>
            {professionals.data?.map((professional) => (
              <MenuItem key={professional.id} value={professional.id}>
                {professional.name}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={showInactive}
                onChange={(_, checked) => updateParams({ todos: checked ? '1' : null })}
              />
            }
            label="Mostrar cancelados e faltas"
          />
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ height: 4 }}>{appointments.isFetching && <LinearProgress />}</Box>
        {appointments.error ? (
          <Box sx={{ p: 2 }}>
            <ErrorMessages error={appointments.error} />
          </Box>
        ) : isMobile ? (
          <AgendaList
            from={rangeStart}
            days={days}
            appointments={items}
            colorFor={colorFor}
            showProfessional={showProfessional}
            onAppointmentClick={(appointment) => setDialog({ appointment })}
          />
        ) : (
          <TimeGrid
            columns={columns}
            startHour={startHour}
            endHour={endHour}
            colorFor={colorFor}
            showProfessional={showProfessional && view === 'semana'}
            onSlotClick={
              canWrite
                ? (column, start) => setDialog({ draft: { start, professionalId: column.professionalId } })
                : undefined
            }
            onAppointmentClick={(appointment) => setDialog({ appointment })}
          />
        )}
      </Paper>

      {dialog && (
        <AppointmentDialog
          appointment={'appointment' in dialog ? dialog.appointment : undefined}
          draft={'draft' in dialog ? dialog.draft : undefined}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
