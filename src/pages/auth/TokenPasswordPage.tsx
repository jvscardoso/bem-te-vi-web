import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router';
import { Alert, Box, Button, Link, Stack, Typography } from '@mui/material';
import { ApiError } from '@/api/client';
import { session } from '@/auth/session';
import { BrandMark } from '@/components/BrandMark';
import { ErrorMessages } from '@/components/ErrorMessages';
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
  /** Troca o token + senha na API e devolve o email da conta. */
  submit: (token: string, password: string) => Promise<{ email: string }>;
  successNotice: string;
  /** Conteúdo exibido quando o link é inválido, expirou ou já foi usado. */
  invalidLink: ReactNode;
}

interface FormValues {
  password: string;
  confirmation: string;
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

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { password: '', confirmation: '' } });

  const save = useMutation({
    mutationFn: (password: string) => submit(token!, password),
    onSuccess: ({ email }) => {
      // A troca encerra todas as sessões do usuário, inclusive alguma aberta neste navegador.
      session.clear('logout');
      navigate('/login', { replace: true, state: { email, notice: successNotice } satisfies LoginNotice });
    },
  });

  // 400 com mensagem única = link inválido/expirado/já usado; com lista = validação da senha.
  const linkInvalid =
    !token || (save.error instanceof ApiError && save.error.status === 400 && !Array.isArray(save.error.body?.message));

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
              label="Nova senha"
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
              label="Confirme a nova senha"
              autoComplete="new-password"
              {...muiField(
                register('confirmation', {
                  validate: (value) => value === getValues('password') || 'As senhas não conferem',
                }),
                errors.confirmation,
              )}
            />
            <ErrorMessages error={save.error} />
            <Button type="submit" variant="contained" size="large" loading={save.isPending}>
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
