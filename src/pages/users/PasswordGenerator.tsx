import { Button, Stack } from '@mui/material';
import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined';
import ContentCopy from '@mui/icons-material/ContentCopy';
import { useNotify } from '@/components/notifications/NotificationContext';
import { generatePassword } from '@/lib/masks';

/** Botões "Gerar senha" e "Copiar" abaixo do campo de senha (o admin repassa a senha ao usuário). */
export function PasswordGenerator({ value, onGenerate }: { value: string; onGenerate: (password: string) => void }) {
  const notify = useNotify();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      notify('Senha copiada.');
    } catch {
      notify('Não foi possível copiar. Copie manualmente.', 'warning');
    }
  };

  return (
    <Stack direction="row" spacing={1}>
      <Button size="small" startIcon={<AutorenewOutlined />} onClick={() => onGenerate(generatePassword())}>
        Gerar senha
      </Button>
      <Button size="small" startIcon={<ContentCopy />} onClick={copy} disabled={!value}>
        Copiar
      </Button>
    </Stack>
  );
}
