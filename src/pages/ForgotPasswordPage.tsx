import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Link as RouterLink, useLocation } from 'react-router';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { authApi } from '@/api/auth';
import { BrandMark } from '@/components/BrandMark';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PublicCardLayout } from '@/layouts/PublicCardLayout';
import { muiField } from '@/lib/form';
import { useBranding } from '@/theme/BrandingContext';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** /esqueci-minha-senha — pede o link de recuperação por email. */
export function ForgotPasswordPage() {
  const { displayName } = useBranding();
  const location = useLocation();
  // Email já digitado no login (enviado pela navegação).
  const [initialEmail] = useState(() => (location.state as { email?: string } | null)?.email ?? '');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>({ defaultValues: { email: initialEmail } });

  const request = useMutation({ mutationFn: (email: string) => authApi.forgotPassword(email) });

  return (
    <PublicCardLayout>
      <Stack spacing={3}>
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <BrandMark size={56} hideName />
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              Esqueci minha senha
            </Typography>
            <Typography color="text.secondary">{displayName}</Typography>
          </Box>
        </Stack>

        {request.isSuccess ? (
          // Mesma mensagem exista a conta ou não: a tela não confirma emails cadastrados.
          <Alert severity="success">
            Se este email estiver cadastrado, você vai receber um link para criar uma nova senha. O link vale por 1 hora.
          </Alert>
        ) : (
          <Stack
            spacing={3}
            component="form"
            onSubmit={handleSubmit(({ email }) => request.mutate(email.trim()))}
            noValidate
          >
            <Typography variant="body2" color="text.secondary">
              Informe o email que você usa para entrar. Vamos enviar um link para você criar uma nova senha.
            </Typography>
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              autoFocus
              {...muiField(
                register('email', { validate: (value) => EMAIL.test(value.trim()) || 'Informe um email válido' }),
                errors.email,
              )}
            />
            <ErrorMessages error={request.error} />
            <Button type="submit" variant="contained" size="large" loading={request.isPending}>
              Enviar link
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
