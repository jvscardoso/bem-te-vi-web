import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link as RouterLink, useLocation, useNavigate, type Location } from 'react-router';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '@/auth/AuthContext';
import { session } from '@/auth/session';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PasswordField } from '@/components/PasswordField';
import { AuthSplitLayout } from '@/layouts/AuthSplitLayout';
import { muiField } from '@/lib/form';
import type { LoginNotice } from './auth/TokenPasswordPage';

interface FormValues {
  email: string;
  password: string;
}

// Validação simples, sem Zod: o login é a primeira tela e deve carregar o mínimo de código.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [logoutReason] = useState(session.getLogoutReason);
  // Vindo de "criar nova senha" ou "aceitar convite": email preenchido e aviso de sucesso.
  const [arrival] = useState(() => (location.state as LoginNotice | null) ?? {});

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { email: arrival.email ?? '', password: '' } });
  const email = useWatch({ control, name: 'email' });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setSubmitError(null);
    try {
      await login(email.trim(), password);
      const from = (location.state as { from?: Location } | null)?.from;
      navigate(from ? `${from.pathname}${from.search}` : '/', { replace: true });
    } catch (error) {
      setSubmitError(error);
    }
  });

  return (
    <AuthSplitLayout>
      <Stack spacing={3} component="form" onSubmit={onSubmit} noValidate>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            Entrar
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Use o email e a senha da sua conta.
          </Typography>
        </Box>

        {arrival.notice && !submitError && <Alert severity="success">{arrival.notice}</Alert>}
        {logoutReason === 'expired' && !submitError && !arrival.notice && (
          <Alert severity="info">Sua sessão foi encerrada. Entre novamente para continuar.</Alert>
        )}
        <ErrorMessages error={submitError} />

        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          autoFocus={!arrival.email}
          {...muiField(
            register('email', { validate: (value) => EMAIL.test(value.trim()) || 'Informe um email válido' }),
            errors.email,
          )}
        />
        <PasswordField
          label="Senha"
          autoComplete="current-password"
          autoFocus={!!arrival.email}
          {...muiField(register('password', { required: 'Informe a senha' }), errors.password)}
        />

        <Button type="submit" variant="contained" size="large" loading={isSubmitting}>
          Entrar
        </Button>

        <Typography variant="body2" sx={{ textAlign: 'center' }}>
          {/* Leva o email já digitado para não precisar digitar de novo. */}
          <Link component={RouterLink} to="/esqueci-minha-senha" state={{ email: email.trim() }}>
            Esqueci minha senha
          </Link>
        </Typography>
      </Stack>
    </AuthSplitLayout>
  );
}
