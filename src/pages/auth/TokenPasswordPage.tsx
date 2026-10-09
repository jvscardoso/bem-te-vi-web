import { useEffect, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router';
import { Alert, Box, Button, Link, Stack, Typography } from '@mui/material';
import { ApiError } from '@/api/client';
import { isOutdatedLegalVersion, type LegalAcceptance } from '@/api/legal';
import { session } from '@/auth/session';
import { BrandMark } from '@/components/BrandMark';
import { ErrorMessages } from '@/components/ErrorMessages';
import { LegalAcceptanceField } from '@/components/LegalAcceptanceField';
import { useLegalAcceptance } from '@/components/useLegalAcceptance';
import { PasswordField } from '@/components/PasswordField';
import { PublicCardLayout } from '@/layouts/PublicCardLayout';
import { muiField } from '@/lib/form';

/** Estado enviado ao /login depois de criar a senha (email preenchido + aviso). */
export interface LoginNotice {
  email?: string;
  notice?: string;
}

interface TokenPasswordPageProps {
  title: string;
  description: ReactNode;
  submitLabel: string;
  passwordLabel?: string;
  /** Exige o aceite dos Termos e da Política (primeiro acesso, como no aceite de convite). */
  requireLegalAcceptance?: boolean;
  /** Troca o token + senha (e o aceite, se exigido) na API e devolve o email da conta. */
  submit: (token: string, password: string, legal?: LegalAcceptance) => Promise<{ email: string }>;
  successNotice: string;
  /** Conteúdo exibido quando o link é inválido, expirou ou já foi usado. */
  invalidLink: ReactNode;
}

interface FormValues {
  password: string;
  confirmation: string;
  legal: boolean;
}

/**
 * Página aberta por link de email com `?token=` (redefinir senha, aceitar convite):
 * cria a senha e leva ao login. O token é lido uma vez e removido da URL, para não
 * ficar no histórico do navegador.
 */
export function TokenPasswordPage({
  title,
  description,
  submitLabel,
  passwordLabel = 'Nova senha',
  requireLegalAcceptance = false,
  submit,
  successNotice,
  invalidLink,
}: TokenPasswordPageProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [token] = useState(() => params.get('token'));

  // Tira o token só da barra de endereço (e do histórico), sem navegar: a localização do
  // roteador continua com ele, então uma remontagem (StrictMode, rota lazy) ainda o encontra.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('token')) return;
    url.searchParams.delete('token');
    window.history.replaceState(window.history.state, '', url);
  }, []);

  const legal = useLegalAcceptance();

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { password: '', confirmation: '', legal: false } });
  const legalChecked = useWatch({ control, name: 'legal' });

  const save = useMutation({
    mutationFn: (password: string) =>
      submit(token!, password, requireLegalAcceptance ? (legal.acceptance ?? undefined) : undefined),
    onSuccess: ({ email }) => {
      // A troca encerra todas as sessões do usuário, inclusive alguma aberta neste navegador.
      session.clear('logout');
      navigate('/login', { replace: true, state: { email, notice: successNotice } satisfies LoginNotice });
    },
    onError: (error) => {
      // Os documentos mudaram com a tela aberta (o link continua valendo): versões novas e novo aceite.
      if (isOutdatedLegalVersion(error)) {
        setValue('legal', false);
        void legal.refresh();
      }
    },
  });

  // Link inexistente, expirado, já usado ou substituído. Outros 400 (senha fora das regras,
  // versão dos termos desatualizada) ficam no formulário com a mensagem da API.
  const linkInvalid =
    !token ||
    (save.error instanceof ApiError &&
      save.error.status === 400 &&
      save.error.messages.some((message) => message.startsWith('Link inválido')));

  return (
    <PublicCardLayout>
      <Stack spacing={3}>
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <BrandMark size={56} hideName />
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            {!linkInvalid && <Typography color="text.secondary">{description}</Typography>}
          </Box>
        </Stack>

        {linkInvalid ? (
          <>
            <Alert severity="warning">Link inválido ou expirado.</Alert>
            {invalidLink}
          </>
        ) : (
          <Stack spacing={2.5} component="form" onSubmit={handleSubmit(({ password }) => save.mutate(password))} noValidate>
            <PasswordField
              label={passwordLabel}
              autoComplete="new-password"
              autoFocus
              {...muiField(
                register('password', {
                  validate: (value) =>
                    value.length < 8 ? 'Mínimo de 8 caracteres' : value.length > 200 ? 'Máximo de 200 caracteres' : true,
                }),
                errors.password,
              )}
              helperText={errors.password?.message ?? 'Mínimo de 8 caracteres.'}
            />
            <PasswordField
              label={`Confirme a ${passwordLabel.toLowerCase()}`}
              autoComplete="new-password"
              {...muiField(
                register('confirmation', {
                  validate: (value) => value === getValues('password') || 'As senhas não conferem',
                }),
                errors.confirmation,
              )}
            />
            {requireLegalAcceptance && (
              <Controller
                name="legal"
                control={control}
                rules={{ validate: (value) => value || 'É preciso aceitar para continuar' }}
                render={({ field, fieldState }) => (
                  <LegalAcceptanceField
                    checked={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    loadError={legal.error}
                  />
                )}
              />
            )}
            <ErrorMessages error={save.error} />
            <Button
              type="submit"
              variant="contained"
              size="large"
              loading={save.isPending}
              disabled={requireLegalAcceptance && (!legal.acceptance || !legalChecked)}
            >
              {submitLabel}
            </Button>
          </Stack>
        )}

        <Typography variant="body2" sx={{ textAlign: 'center' }}>
          <Link component={RouterLink} to="/login">
            Voltar para o login
          </Link>
        </Typography>
      </Stack>
    </PublicCardLayout>
  );
}
