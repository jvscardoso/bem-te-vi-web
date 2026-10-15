import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { patientsApi, patientsKeys } from '@/api/patients';
import { useTenantId } from '@/auth/AuthContext';
import { SearchField } from '@/components/SearchField';

/** Total de pacientes e busca rápida que leva à lista já filtrada. */
export function PatientsCard() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const params = { page: 1, pageSize: 1 };

  // Só o total (pageSize 1): a lista completa fica na tela de pacientes.
  const total = useQuery({
    queryKey: patientsKeys.list(tenantId, params),
    queryFn: () => patientsApi.list(tenantId, params),
  }).data?.meta.total;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = search.trim();
    navigate(q ? `/pacientes?q=${encodeURIComponent(q)}` : '/pacientes');
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          Pacientes
        </Typography>
        {total !== undefined && (
          <Typography variant="body2" color="text.secondary">
            {total} {total === 1 ? 'cadastrado' : 'cadastrados'}
          </Typography>
        )}
      </Stack>
      <Box component="form" onSubmit={submit}>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, CPF ou telefone e Enter"
          fullWidth
        />
      </Box>
    </Paper>
  );
}
