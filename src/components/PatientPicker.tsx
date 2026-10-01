import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Autocomplete, TextField, type TextFieldProps } from '@mui/material';
import { patientsApi, patientsKeys } from '@/api/patients';
import type { UUID } from '@/api/types';
import { useTenantId } from '@/auth/AuthContext';
import { isApiError } from '@/lib/errors';
import { formatCpf } from '@/lib/format';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

export interface PatientOption {
  id: UUID;
  fullName: string;
  cpf?: string | null;
}

interface PatientPickerProps {
  value: PatientOption | null;
  onChange: (value: PatientOption | null) => void;
  label?: string;
  error?: boolean;
  helperText?: TextFieldProps['helperText'];
  disabled?: boolean;
  size?: 'small' | 'medium';
  inputRef?: TextFieldProps['inputRef'];
  onBlur?: () => void;
}

/** Busca de paciente por nome ou CPF (usa a busca `q` da API, com debounce). */
export function PatientPicker({
  value,
  onChange,
  label = 'Paciente',
  error,
  helperText,
  disabled,
  size,
  inputRef,
  onBlur,
}: PatientPickerProps) {
  const tenantId = useTenantId();
  const [input, setInput] = useState('');
  const q = useDebouncedValue(input.trim(), 300);
  const params = { q: q || undefined, page: 1, pageSize: 20 };

  const query = useQuery({
    queryKey: patientsKeys.list(tenantId, params),
    queryFn: () => patientsApi.list(tenantId, params),
    enabled: !disabled,
    placeholderData: keepPreviousData,
  });

  const options: PatientOption[] = query.data?.data ?? [];
  const forbidden = isApiError(query.error, 403);

  return (
    <Autocomplete
      value={value}
      onChange={(_, option) => onChange(option)}
      inputValue={input}
      onInputChange={(_, text) => setInput(text)}
      options={options}
      // A API já filtra; não refiltrar no cliente.
      filterOptions={(items) => items}
      getOptionLabel={(option) => option.fullName}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      getOptionKey={(option) => option.id}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <li key={key} {...rest}>
            <span>
              {option.fullName}
              {option.cpf && (
                <span style={{ opacity: 0.6, marginLeft: 8, fontSize: '0.85em' }}>{formatCpf(option.cpf)}</span>
              )}
            </span>
          </li>
        );
      }}
      loading={query.isFetching}
      loadingText="Buscando…"
      noOptionsText={q ? 'Nenhum paciente encontrado' : 'Digite o nome ou CPF'}
      disabled={disabled}
      size={size}
      onBlur={onBlur}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          inputRef={inputRef}
          error={error || forbidden}
          helperText={forbidden ? 'Sem permissão para buscar pacientes.' : helperText}
        />
      )}
    />
  );
}
