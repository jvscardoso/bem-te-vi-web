import { useState } from 'react';
import { useNavigate } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Autocomplete,
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Search from '@mui/icons-material/Search';
import { patientsApi, patientsKeys } from '@/api/patients';
import type { Patient } from '@/api/types';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { formatCpf } from '@/lib/format';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

// Cada busca vira um registro "Pesquisou pacientes" na auditoria: o mínimo de caracteres e o
// debounce maior que o das listas evitam um registro por letra digitada.
const MIN_CHARS = 2;
const DEBOUNCE_MS = 400;
const MAX_RESULTS = 6;
const PLACEHOLDER = 'Buscar paciente por nome ou CPF';

type Option =
  | { kind: 'patient'; patient: Patient }
  | { kind: 'all'; total: number }
  | { kind: 'status'; text: string };

/** Busca global de pacientes na barra superior (exige `patients:read`). */
export function PatientSearch() {
  const { can } = useAuth();
  if (!can('patients:read')) return null;
  return <PatientSearchField />;
}

function PatientSearchField() {
  const theme = useTheme();
  // Abaixo de `sm` não sobra espaço na barra: vira um ícone que abre a busca por cima dela.
  const compact = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(false);
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const term = input.trim();
  const q = useDebouncedValue(term, DEBOUNCE_MS);
  const enabled = q.length >= MIN_CHARS;
  const params = { q, page: 1, pageSize: MAX_RESULTS };

  const query = useQuery({
    queryKey: patientsKeys.list(tenantId, params),
    queryFn: () => patientsApi.list(tenantId, params),
    enabled,
    placeholderData: keepPreviousData,
  });

  // Com a busca desligada, o placeholder ainda traria o resultado anterior.
  const page = enabled ? query.data : undefined;
  // Só afirma "nenhum" quando a resposta é do termo que está no campo (debounce já terminou).
  const settled = enabled && q === term && !query.isFetching;
  let status: string | null = null;
  if (settled && query.isError) status = 'Não foi possível buscar agora';
  else if (settled && page?.data.length === 0) status = 'Nenhum paciente encontrado';
  else if (!page?.data.length) status = 'Buscando…';
  // Com freeSolo o Autocomplete esconde a lista vazia (e o noOptionsText): o aviso vira uma opção desabilitada.
  const options: Option[] = page?.data.length
    ? [
        ...page.data.map((patient): Option => ({ kind: 'patient', patient })),
        ...(page.meta.total > page.data.length ? [{ kind: 'all', total: page.meta.total } as const] : []),
      ]
    : status
      ? [{ kind: 'status', text: status }]
      : [];

  const close = () => {
    setInput('');
    setListOpen(false);
    setExpanded(false);
  };

  const openList = (text: string) => {
    if (!text) return;
    navigate(`/pacientes?q=${encodeURIComponent(text)}`);
    close();
  };

  if (compact && !expanded) {
    return (
      <Tooltip title="Buscar paciente">
        <IconButton aria-label="Buscar paciente" onClick={() => setExpanded(true)} sx={{ mr: 1 }}>
          <Search />
        </IconButton>
      </Tooltip>
    );
  }

  const field = (
    <Autocomplete<Option, false, false, true>
      freeSolo
      size="small"
      value={null}
      inputValue={input}
      onInputChange={(_, text, reason) => {
        // Depois de escolher um resultado, o Autocomplete tentaria pôr o rótulo no campo.
        if (reason === 'reset') return;
        setInput(text);
        setListOpen(true);
      }}
      onChange={(_, option) => {
        if (option === null) return;
        // Enter sem escolher um resultado: abre a lista completa com o termo.
        if (typeof option === 'string') return openList(option.trim());
        if (option.kind === 'all') return openList(term);
        if (option.kind === 'status') return;
        navigate(`/pacientes/${option.patient.id}`);
        close();
      }}
      options={options}
      // A API já filtra; não refiltrar no cliente.
      filterOptions={(items) => items}
      getOptionLabel={(option) => (typeof option === 'string' ? option : '')}
      getOptionKey={(option) =>
        typeof option === 'string' ? option : option.kind === 'patient' ? option.patient.id : option.kind
      }
      getOptionDisabled={(option) => typeof option !== 'string' && option.kind === 'status'}
      // Só abre a partir do mínimo de caracteres: antes disso não há o que mostrar.
      open={listOpen && term.length >= MIN_CHARS}
      onOpen={() => setListOpen(true)}
      onClose={() => setListOpen(false)}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        if (option.kind === 'status') {
          return (
            <li key={key} {...rest}>
              <Typography variant="body2" color="text.secondary">
                {option.text}
              </Typography>
            </li>
          );
        }
        if (option.kind === 'all') {
          return (
            <li key={key} {...rest}>
              <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                Ver todos os {option.total} resultados
              </Typography>
            </li>
          );
        }
        const { patient } = option;
        const details = [patient.cpf && formatCpf(patient.cpf), patient.phone].filter(Boolean).join(' · ');
        return (
          <li key={key} {...rest}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                {patient.fullName}
              </Typography>
              {details && (
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {details}
                </Typography>
              )}
            </Box>
          </li>
        );
      }}
      slotProps={{ paper: { sx: { minWidth: 320 } } }}
      // No desktop, `ml` afasta o campo do chip de recolher o menu, que avança sobre a barra.
      sx={compact ? { width: '100%' } : { width: { sm: 280, md: 380 }, ml: { md: 2 }, mr: { sm: 1, md: 0 } }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={PLACEHOLDER}
          autoFocus={compact}
          onBlur={() => compact && !input && setExpanded(false)}
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps.htmlInput, maxLength: 100, 'aria-label': PLACEHOLDER },
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
    />
  );

  if (!compact) return field;

  // Celular: cobre a barra inteira enquanto busca.
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        bgcolor: 'background.paper',
      }}
    >
      <IconButton aria-label="Fechar busca" onClick={close}>
        <ArrowBack />
      </IconButton>
      {field}
    </Box>
  );
}
