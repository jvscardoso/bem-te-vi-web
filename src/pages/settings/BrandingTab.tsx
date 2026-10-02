import { useMemo } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import Close from '@mui/icons-material/Close';
import { tenantKeys, tenantsApi } from '@/api/tenants';
import type { Tenant } from '@/api/types';
import { ErrorMessages } from '@/components/ErrorMessages';
import { SectionCard } from '@/components/SectionCard';
import { useNotify } from '@/components/notifications/NotificationContext';
import { muiField } from '@/lib/form';
import { applyBrandingToCache } from '@/theme/brandingCache';
import { createAppTheme, DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '@/theme/createAppTheme';

const HEX = /^#[0-9a-fA-F]{6}$/;

interface FormValues {
  tradeName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
}

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export function BrandingTab({ tenant }: { tenant: Tenant }) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const branding = tenant.branding;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      tradeName: branding?.tradeName ?? '',
      logoUrl: branding?.logoUrl ?? '',
      primaryColor: branding?.primaryColor ?? '',
      secondaryColor: branding?.secondaryColor ?? '',
    },
  });
  const values = useWatch({ control });

  const save = useMutation({
    // Campo vazio = null: volta ao padrão do bem-te-vi.
    mutationFn: (form: FormValues) =>
      tenantsApi.updateBranding(tenant.id, {
        tradeName: form.tradeName.trim() || null,
        logoUrl: form.logoUrl.trim() || null,
        primaryColor: form.primaryColor || null,
        secondaryColor: form.secondaryColor || null,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(tenantKeys.detail(tenant.id), (old?: Tenant) => (old ? { ...old, branding: saved } : old));
      // Re-tematiza o app na hora (o tema vem da marca pública do endereço atual).
      applyBrandingToCache(queryClient, tenant.name, {
        tradeName: saved.tradeName,
        logoUrl: saved.logoUrl,
        primaryColor: saved.primaryColor,
        secondaryColor: saved.secondaryColor,
      });
      notify('Marca atualizada.');
    },
  });

  return (
    <Stack spacing={3} component="form" onSubmit={handleSubmit((form) => save.mutate(form))} noValidate>
      <SectionCard
        title="Marca"
        description="Aparece no login, no menu e no título da aba. Campos vazios usam o padrão do bem-te-vi."
      >
        <TextField
          label="Nome fantasia"
          placeholder={tenant.name}
          {...muiField(
            register('tradeName', { maxLength: { value: 150, message: 'Máximo de 150 caracteres' } }),
            errors.tradeName,
          )}
          helperText={errors.tradeName?.message ?? `Sem nome fantasia, é exibido "${tenant.name}".`}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Endereço do logo (https)"
          placeholder="https://suaclinica.com.br/logo.png"
          {...muiField(
            register('logoUrl', {
              validate: (value) => !value.trim() || isHttpsUrl(value.trim()) || 'Informe um endereço https válido',
            }),
            errors.logoUrl,
          )}
          helperText={
            errors.logoUrl?.message ?? 'Imagem quadrada, de preferência PNG ou SVG. Não há envio de arquivo: use um link.'
          }
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <ColorField control={control} name="primaryColor" label="Cor principal" fallback={DEFAULT_PRIMARY} />
          <ColorField control={control} name="secondaryColor" label="Cor secundária" fallback={DEFAULT_SECONDARY} />
        </Box>
      </SectionCard>

      <SectionCard title="Pré-visualização">
        <BrandPreview
          name={values.tradeName?.trim() || tenant.name}
          logoUrl={values.logoUrl && isHttpsUrl(values.logoUrl.trim()) ? values.logoUrl.trim() : null}
          primaryColor={values.primaryColor}
          secondaryColor={values.secondaryColor}
        />
      </SectionCard>

      <ErrorMessages error={save.error} />
      <Box>
        <Button type="submit" variant="contained" disabled={!isDirty} loading={save.isPending}>
          Salvar marca
        </Button>
      </Box>
    </Stack>
  );
}

interface ColorFieldProps {
  control: Control<FormValues>;
  name: 'primaryColor' | 'secondaryColor';
  label: string;
  fallback: string;
}

/** Cor #RRGGBB: seletor nativo + texto. Vazio = cor padrão. */
function ColorField({ control, name, label, fallback }: ColorFieldProps) {
  return (
    <Controller
      name={name}
      control={control}
      rules={{ validate: (value) => !value || HEX.test(value) || 'Use o formato #RRGGBB' }}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          placeholder={`Padrão (${fallback})`}
          value={field.value}
          onChange={(event) => field.onChange(event.target.value.trim().toUpperCase())}
          onBlur={field.onBlur}
          inputRef={field.ref}
          error={!!fieldState.error}
          helperText={fieldState.error?.message ?? (field.value ? undefined : 'Usando a cor padrão')}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { maxLength: 7, spellCheck: false, style: { fontFamily: 'monospace' } },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Box
                    component="input"
                    type="color"
                    aria-label={`Escolher ${label.toLowerCase()}`}
                    value={HEX.test(field.value) ? field.value : fallback}
                    onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                    sx={{ width: 32, height: 32, p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer' }}
                  />
                </InputAdornment>
              ),
              endAdornment: field.value ? (
                <InputAdornment position="end">
                  <Tooltip title="Usar a cor padrão">
                    <IconButton size="small" aria-label="Usar a cor padrão" onClick={() => field.onChange('')}>
                      <Close fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ) : undefined,
            },
          }}
        />
      )}
    />
  );
}

interface BrandPreviewProps {
  name: string;
  logoUrl: string | null;
  primaryColor?: string;
  secondaryColor?: string;
}

/** Miniatura do login e do menu com o tema montado pelos valores atuais (sem salvar). */
function BrandPreview({ name, logoUrl, primaryColor, secondaryColor }: BrandPreviewProps) {
  const theme = useMemo(() => createAppTheme({ primaryColor, secondaryColor }), [primaryColor, secondaryColor]);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <Paper variant="outlined" sx={{ p: 3, bgcolor: 'background.default' }}>
          <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
            <Avatar src={logoUrl ?? undefined} variant="rounded" sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}>
              {name.charAt(0).toUpperCase()}
            </Avatar>
            <Typography sx={{ fontWeight: 700 }}>{name}</Typography>
            <Box sx={{ width: '100%', height: 32, border: 1, borderColor: 'primary.main', borderRadius: 1 }} />
            <Button variant="contained" fullWidth size="small" tabIndex={-1}>
              Entrar
            </Button>
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Avatar src={logoUrl ?? undefined} variant="rounded" sx={{ width: 28, height: 28, bgcolor: 'primary.main' }}>
                {name.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                {name}
              </Typography>
            </Stack>
            <Box sx={{ px: 1.5, py: 0.75, borderRadius: 2, bgcolor: 'action.selected', color: 'primary.main', fontSize: 14 }}>
              Agenda
            </Box>
            <Box sx={{ px: 1.5, fontSize: 14 }}>Pacientes</Box>
            <Stack direction="row" spacing={1}>
              <Chip size="small" color="primary" label="Confirmado" />
              <Chip size="small" color="secondary" label="Destaque" />
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
