import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, InputAdornment, Stack, TextField } from '@mui/material';
import { tenantKeys, tenantsApi, type TenantUpdate } from '@/api/tenants';
import type { Tenant } from '@/api/types';
import { ErrorMessages } from '@/components/ErrorMessages';
import { SectionCard } from '@/components/SectionCard';
import { useNotify } from '@/components/notifications/NotificationContext';
import { applyFieldErrors } from '@/lib/errors';
import { muiField } from '@/lib/form';
import { applyBrandingToCache } from '@/theme/brandingCache';
import { devClinicUrl } from '@/theme/brandingHost';

const APP_BASE_DOMAIN = import.meta.env.VITE_APP_BASE_DOMAIN?.trim() || null;

// Rótulo DNS, como a API exige: sem hífen no começo nem no fim. Os reservados (`admin`, `www`…)
// são conferidos só pela API (409 "Este subdomínio não está disponível"), porque a lista varia
// por ambiente.
const SUBDOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

interface FormValues {
  name: string;
  subdomain: string;
}

export function GeneralTab({ tenant }: { tenant: Tenant }) {
  const queryClient = useQueryClient();
  const notify = useNotify();

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<FormValues>({ defaultValues: { name: tenant.name, subdomain: tenant.subdomain } });
  // O que sobra para a área de erros depois de pôr os erros por campo nos campos.
  const [areaError, setAreaError] = useState<unknown>(null);
  const subdomain = useWatch({ control, name: 'subdomain' });
  const subdomainChanged = subdomain !== tenant.subdomain;

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const input: TenantUpdate = {};
      if (dirtyFields.name) input.name = values.name.trim();
      if (dirtyFields.subdomain) input.subdomain = values.subdomain;
      return tenantsApi.update(tenant.id, input);
    },
    onMutate: () => setAreaError(null),
    // 400 de formato vai para o campo; o 409 ("já está em uso", "não está disponível") fica na área.
    onError: (error) => setAreaError(applyFieldErrors(error, setError, ['name', 'subdomain'])),
    onSuccess: (saved) => {
      // O nome aparece na marca pública (login, menu, título da aba).
      applyBrandingToCache(queryClient, tenant.name, { name: saved.name });
      queryClient.setQueryData(tenantKeys.detail(tenant.id), (old?: Tenant) => ({ ...old, ...saved }));
      notify('Dados da clínica atualizados.');

      // Em dev, leva ao endereço novo (em *.localhost é outra origem: a sessão fica para trás e
      // pede login, como em produção).
      if (saved.subdomain !== tenant.subdomain && import.meta.env.DEV) {
        window.location.assign(devClinicUrl(saved.subdomain, '/configuracoes'));
      }
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
        <TextField
          label="Endereço de acesso (subdomínio)"
          {...muiField(
            register('subdomain', {
              setValueAs: (value: string) => value.trim().toLowerCase(),
              validate: (value) =>
                !value
                  ? 'Informe o subdomínio'
                  : value.length > 63
                    ? 'Máximo de 63 caracteres'
                    : SUBDOMAIN.test(value) ||
                      'Use letras minúsculas, números e hífen, sem hífen no começo nem no fim',
            }),
            errors.subdomain,
          )}
          slotProps={
            APP_BASE_DOMAIN
              ? { input: { endAdornment: <InputAdornment position="end">.{APP_BASE_DOMAIN}</InputAdornment> } }
              : undefined
          }
        />
        {subdomainChanged && (
          <Alert severity="warning">
            O endereço de acesso da clínica vai mudar. O endereço atual deixa de funcionar e toda a equipe precisará
            usar o novo{APP_BASE_DOMAIN ? `: ${subdomain || '…'}.${APP_BASE_DOMAIN}` : '.'}
          </Alert>
        )}
      </SectionCard>

      <ErrorMessages error={areaError} />
      <Box>
        <Button type="submit" variant="contained" disabled={!isDirty} loading={save.isPending}>
          Salvar
        </Button>
      </Box>
    </Stack>
  );
}
