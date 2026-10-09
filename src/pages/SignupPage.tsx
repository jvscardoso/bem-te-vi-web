import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Divider,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { isOutdatedLegalVersion, type LegalAcceptance } from '@/api/legal';
import { tenantsApi, type SignupInput } from '@/api/tenants';
import { useAuth } from '@/auth/AuthContext';
import { BrandMark } from '@/components/BrandMark';
import { ErrorMessages } from '@/components/ErrorMessages';
import { LegalAcceptanceField } from '@/components/LegalAcceptanceField';
import { useLegalAcceptance } from '@/components/useLegalAcceptance';
import { PasswordField } from '@/components/PasswordField';
import { PublicCardLayout } from '@/layouts/PublicCardLayout';
import { muiField } from '@/lib/form';
import { useBranding } from '@/theme/BrandingContext';

const APP_BASE_DOMAIN = import.meta.env.VITE_APP_BASE_DOMAIN?.trim() || null;

// Padrões aplicados pela API quando os campos são omitidos.
const API_DEFAULT_DURATION = 30;
const API_DEFAULT_MIN_DURATION = 5;

const SUBDOMAIN = /^[a-z0-9-]+$/;
const FQDN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const optionalMinutes = z
  .string()
  .refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 5 && Number(value) <= 1440), {
    message: 'Informe um número inteiro entre 5 e 1440',
  });

const schema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome da clínica').max(150, 'Máximo de 150 caracteres'),
    subdomain: z
      .string()
      .min(1, 'Informe o endereço')
      .max(63, 'Máximo de 63 caracteres')
      .regex(SUBDOMAIN, 'Use apenas letras minúsculas, números e hífen'),
    customDomain: z.string().refine((value) => value === '' || FQDN.test(value), 'Informe um domínio válido'),
    defaultDuration: optionalMinutes,
    minDuration: optionalMinutes,
    ownerName: z.string().trim().min(1, 'Informe seu nome'),
    ownerEmail: z.email('Informe um email válido'),
    password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres').max(200, 'Máximo de 200 caracteres'),
    passwordConfirmation: z.string(),
    legal: z.boolean().refine((value) => value, 'É preciso aceitar para continuar'),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.passwordConfirmation) {
      ctx.addIssue({ code: 'custom', path: ['passwordConfirmation'], message: 'As senhas não conferem' });
    }
    const defaultDuration = Number(values.defaultDuration || API_DEFAULT_DURATION);
    const minDuration = Number(values.minDuration || API_DEFAULT_MIN_DURATION);
    if (minDuration > defaultDuration) {
      ctx.addIssue({
        code: 'custom',
        path: ['minDuration'],
        message: `Não pode ser maior que a duração padrão (${defaultDuration} min)`,
      });
    }
  });

type FormValues = z.infer<typeof schema>;

/** "Clínica São José" → "clinica-sao-jose" */
function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/, '');
}

function toSignupInput(values: FormValues, legalAcceptance: LegalAcceptance): SignupInput {
  return {
    name: values.name.trim(),
    subdomain: values.subdomain,
    ...(values.customDomain && { customDomain: values.customDomain }),
    ...(values.defaultDuration && { defaultAppointmentDurationMinutes: Number(values.defaultDuration) }),
    ...(values.minDuration && { minAppointmentDurationMinutes: Number(values.minDuration) }),
    owner: { name: values.ownerName.trim(), email: values.ownerEmail.trim(), password: values.password },
    legalAcceptance,
  };
}

export function SignupPage() {
  const { status: brandingStatus } = useBranding();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [subdomainEdited, setSubdomainEdited] = useState(false);
  const [created, setCreated] = useState<{ subdomain: string; loginFailed: boolean } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      subdomain: '',
      customDomain: '',
      defaultDuration: '',
      minDuration: '',
      ownerName: '',
      ownerEmail: '',
      password: '',
      passwordConfirmation: '',
      legal: false,
    },
  });

  const subdomain = useWatch({ control, name: 'subdomain' });
  const legal = useLegalAcceptance();
  const legalChecked = useWatch({ control, name: 'legal' });

  // O cadastro é da plataforma: no endereço de uma clínica, só faz sentido o login.
  if (brandingStatus === 'found') return <Navigate to="/login" replace />;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await tenantsApi.signup(toSignupInput(values, legal.acceptance!));
    } catch (error) {
      setSubmitError(error);
      // Os documentos mudaram com a tela aberta: busca as versões novas e pede o aceite de novo.
      if (isOutdatedLegalVersion(error)) {
        setValue('legal', false);
        void legal.refresh();
      }
      return;
    }

    // Em produção, a clínica é acessada pelo próprio subdomínio (outra origem,
    // sem sessão): leva o dono ao login de lá.
    if (APP_BASE_DOMAIN && !import.meta.env.DEV) {
      setCreated({ subdomain: values.subdomain, loginFailed: false });
      return;
    }

    try {
      await login(values.ownerEmail.trim(), values.password);
    } catch {
      setCreated({ subdomain: values.subdomain, loginFailed: true });
      return;
    }

    if (import.meta.env.DEV) {
      // Recarrega já com a marca da nova clínica (?tenant= é lembrado na aba).
      window.location.assign(`/inicio?tenant=${encodeURIComponent(values.subdomain)}`);
    } else {
      navigate('/', { replace: true });
    }
  });

  if (created) return <SignupSuccess {...created} />;

  return (
    <PublicCardLayout maxWidth={560}>
      <Stack spacing={3} component="form" onSubmit={onSubmit} noValidate>
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <BrandMark size={48} hideName />
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              Cadastre sua clínica
            </Typography>
            <Typography color="text.secondary">Comece a usar o bem-te-vi em poucos minutos.</Typography>
          </Box>
        </Stack>

        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">
            Clínica
          </Typography>
          <TextField
            label="Nome da clínica"
            autoFocus
            {...muiField(
              register('name', {
                onChange: (event) => {
                  if (!subdomainEdited) setValue('subdomain', slugify(event.target.value));
                },
              }),
              errors.name,
            )}
          />
          <TextField
            label="Endereço de acesso"
            {...muiField(
              register('subdomain', {
                setValueAs: (value: string) => value.trim().toLowerCase(),
                onChange: () => setSubdomainEdited(true),
              }),
              errors.subdomain,
            )}
            helperText={
              errors.subdomain?.message ??
              (APP_BASE_DOMAIN
                ? `Sua clínica ficará em ${subdomain || 'sua-clinica'}.${APP_BASE_DOMAIN}`
                : 'Letras minúsculas, números e hífen. Não poderá ser usado por outra clínica.')
            }
            slotProps={{
              // Preenchido via setValue (a partir do nome): o MUI não percebe sozinho.
              inputLabel: { shrink: subdomain ? true : undefined },
              input: APP_BASE_DOMAIN
                ? { endAdornment: <InputAdornment position="end">.{APP_BASE_DOMAIN}</InputAdornment> }
                : undefined,
            }}
          />
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">
            Seu acesso (administrador da clínica)
          </Typography>
          <TextField label="Seu nome" autoComplete="name" {...muiField(register('ownerName'), errors.ownerName)} />
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            {...muiField(register('ownerEmail'), errors.ownerEmail)}
          />
          <PasswordField
            label="Senha"
            autoComplete="new-password"
            {...muiField(register('password'), errors.password)}
            helperText={errors.password?.message ?? 'Mínimo de 8 caracteres'}
          />
          <PasswordField
            label="Confirme a senha"
            autoComplete="new-password"
            {...muiField(register('passwordConfirmation'), errors.passwordConfirmation)}
          />
        </Stack>

        <Accordion
          disableGutters
          variant="outlined"
          defaultExpanded={!!(errors.customDomain || errors.defaultDuration || errors.minDuration)}
          sx={{ '&::before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box>
              <Typography variant="subtitle2">Opções avançadas</Typography>
              <Typography variant="caption" color="text.secondary">
                Domínio próprio e duração dos atendimentos. Dá para ajustar depois.
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <TextField
                label="Domínio próprio (opcional)"
                placeholder="agenda.suaclinica.com.br"
                {...muiField(
                  register('customDomain', { setValueAs: (value: string) => value.trim().toLowerCase() }),
                  errors.customDomain,
                )}
                helperText={
                  errors.customDomain?.message ?? 'Precisará ser verificado por DNS nas configurações da clínica.'
                }
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Duração padrão"
                  placeholder={String(API_DEFAULT_DURATION)}
                  {...muiField(register('defaultDuration'), errors.defaultDuration)}
                  helperText={errors.defaultDuration?.message ?? `Padrão: ${API_DEFAULT_DURATION} min`}
                  slotProps={{
                    htmlInput: { inputMode: 'numeric' },
                    input: { endAdornment: <InputAdornment position="end">min</InputAdornment> },
                  }}
                />
                <TextField
                  label="Duração mínima"
                  placeholder={String(API_DEFAULT_MIN_DURATION)}
                  {...muiField(register('minDuration'), errors.minDuration)}
                  helperText={errors.minDuration?.message ?? `Padrão: ${API_DEFAULT_MIN_DURATION} min`}
                  slotProps={{
                    htmlInput: { inputMode: 'numeric' },
                    input: { endAdornment: <InputAdornment position="end">min</InputAdornment> },
                  }}
                />
              </Stack>
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Controller
          name="legal"
          control={control}
          render={({ field, fieldState }) => (
            <LegalAcceptanceField
              checked={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              loadError={legal.error}
            />
          )}
        />

        <ErrorMessages error={submitError} />

        <Button type="submit" variant="contained" size="large" loading={isSubmitting} disabled={!legal.acceptance || !legalChecked}>
          Criar clínica
        </Button>

        <Typography variant="body2" sx={{ textAlign: 'center' }}>
          Já tem conta?{' '}
          <Link component={RouterLink} to="/login">
            Entrar
          </Link>
        </Typography>
      </Stack>
    </PublicCardLayout>
  );
}

function SignupSuccess({ subdomain, loginFailed }: { subdomain: string; loginFailed: boolean }) {
  const clinicLoginUrl = APP_BASE_DOMAIN && !import.meta.env.DEV ? `https://${subdomain}.${APP_BASE_DOMAIN}/login` : null;

  return (
    <PublicCardLayout>
      <Stack spacing={3} sx={{ textAlign: 'center', alignItems: 'center' }}>
        <BrandMark size={48} hideName />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          Clínica criada!
        </Typography>
        {clinicLoginUrl ? (
          <Typography color="text.secondary">
            Sua clínica já está disponível em <strong>{clinicLoginUrl.replace('https://', '').replace('/login', '')}</strong>.
            Entre com o email e a senha que você acabou de cadastrar.
          </Typography>
        ) : (
          <Typography color="text.secondary">Entre com o email e a senha que você acabou de cadastrar.</Typography>
        )}
        {loginFailed && (
          <Alert severity="warning" sx={{ textAlign: 'left' }}>
            Não foi possível entrar automaticamente. Tente fazer login em instantes.
          </Alert>
        )}
        {clinicLoginUrl ? (
          <Button variant="contained" size="large" href={clinicLoginUrl}>
            Ir para o login da clínica
          </Button>
        ) : (
          <Button
            variant="contained"
            size="large"
            component={RouterLink}
            to={import.meta.env.DEV ? `/login?tenant=${encodeURIComponent(subdomain)}` : '/login'}
            reloadDocument
          >
            Ir para o login
          </Button>
        )}
      </Stack>
    </PublicCardLayout>
  );
}
