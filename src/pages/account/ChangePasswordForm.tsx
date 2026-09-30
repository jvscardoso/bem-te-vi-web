import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Box, Button, Stack } from '@mui/material';
import { authApi } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PasswordField } from '@/components/PasswordField';
import { useNotify } from '@/components/notifications/NotificationContext';
import { muiField } from '@/lib/form';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres').max(200, 'Máximo de 200 caracteres'),
    confirmation: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.newPassword !== values.confirmation) {
      ctx.addIssue({ code: 'custom', path: ['confirmation'], message: 'As senhas não conferem' });
    }
    if (values.newPassword && values.newPassword === values.currentPassword) {
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'A nova senha deve ser diferente da atual' });
    }
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordForm() {
  const { user, replaceToken } = useAuth();
  const notify = useNotify();
  // Remonta os campos após o sucesso: o reset() limpa o DOM, mas os rótulos do MUI ficariam no alto.
  const [formKey, setFormKey] = useState(0);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmation: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => authApi.changePassword(values.currentPassword, values.newPassword),
    onSuccess: ({ accessToken }) => {
      // A troca encerra todas as sessões, inclusive esta: passa a usar o token novo.
      replaceToken(accessToken);
      reset();
      setFormKey((key) => key + 1);
      notify('Senha alterada com sucesso.');
    },
  });

  return (
    <Stack key={formKey} spacing={2} component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      {/* Ajuda gerenciadores de senha a associar a conta. */}
      <input type="text" name="username" autoComplete="username" value={user?.email ?? ''} hidden readOnly />
      <PasswordField
        label="Senha atual"
        autoComplete="current-password"
        {...muiField(register('currentPassword'), errors.currentPassword)}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          {...muiField(register('newPassword'), errors.newPassword)}
          helperText={errors.newPassword?.message ?? 'Mínimo de 8 caracteres'}
        />
        <PasswordField
          label="Confirme a nova senha"
          autoComplete="new-password"
          {...muiField(register('confirmation'), errors.confirmation)}
        />
      </Stack>
      <ErrorMessages error={mutation.error} />
      <Box>
        <Button type="submit" variant="contained" loading={mutation.isPending}>
          Alterar senha
        </Button>
      </Box>
    </Stack>
  );
}
