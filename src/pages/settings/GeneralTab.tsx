import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Chip, InputAdornment, Stack, TextField } from '@mui/material';
import { tenantKeys, tenantsApi, type TenantUpdate } from '@/api/tenants';
import type { Tenant } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { SectionCard } from '@/components/SectionCard';
import { useNotify } from '@/components/notifications/NotificationContext';
import { applyFieldErrors } from '@/lib/errors';
import { muiField } from '@/lib/form';
import { applyBrandingToCache } from '@/theme/brandingCache';

const APP_BASE_DOMAIN = import.meta.env.VITE_APP_BASE_DOMAIN?.trim() || null;

interface FormValues {
  name: string;
}

export function GeneralTab({ tenant }: { tenant: Tenant }) {
  // Assinatura em só leitura: a API recusaria (402).
  const { readOnly } = useAuth();
  const queryClient = useQueryClient();
  const notify = useNotify();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ defaultValues: { name: tenant.name } });
  // O que sobra para a área de erros depois de pôr os erros por campo nos campos.
  const [areaError, setAreaError] = useState<unknown>(null);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const input: TenantUpdate = { name: values.name.trim() };
      return tenantsApi.update(tenant.id, input);
    },
    onMutate: () => setAreaError(null),
    onError: (error) => setAreaError(applyFieldErrors(error, setError, ['name'])),
    onSuccess: (saved) => {
      // O nome aparece na marca pública (login, menu, título da aba).
      applyBrandingToCache(queryClient, tenant.name, { name: saved.name });
      queryClient.setQueryData(tenantKeys.detail(tenant.id), (old?: Tenant) => ({ ...old, ...saved }));
      notify('Dados da clínica atualizados.');
    },
  });

  return (
    <Stack spacing={3} component="form" onSubmit={handleSubmit((values) => save.mutate(values))} noValidate>
      <SectionCard title="Identificação" description="O nome aparece no login e no menu quando não há nome fantasia na marca.">
        <TextField
          label="Nome da clínica"
          {...muiField(
            register('name', {
              validate: (value) =>
                !value.trim() ? 'Informe o nome' : value.length > 150 ? 'Máximo de 150 caracteres' : true,
            }),
            errors.name,
          )}
        />
        {/* Trocar o subdomínio derruba o endereço que a equipe e os pacientes já usam (links de
            email, favoritos, sessão aberta) e exige redirecionar o antigo: fica para depois. */}
        <TextField
          label="Endereço de acesso (subdomínio)"
          value={tenant.subdomain}
          disabled
          helperText="A troca do endereço de acesso ainda não está disponível."
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end" sx={{ gap: 1 }}>
                  {APP_BASE_DOMAIN && `.${APP_BASE_DOMAIN}`}
                  <Chip size="small" color="info" variant="outlined" label="Em breve" />
                </InputAdornment>
              ),
            },
          }}
        />
      </SectionCard>

      <ErrorMessages error={areaError} />
      <Box>
        <Button type="submit" variant="contained" disabled={!isDirty || readOnly} loading={save.isPending}>
          Salvar
        </Button>
      </Box>
    </Stack>
  );
}
