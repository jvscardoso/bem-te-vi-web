import { Typography } from '@mui/material';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';

export function HomePage() {
  const { user } = useAuth();
  // Pula títulos abreviados ("Dra.", "Dr.") para cumprimentar pelo nome.
  const words = user?.name.split(/\s+/).filter(Boolean) ?? [];
  const firstName = words.find((word) => !word.endsWith('.')) ?? words[0] ?? '';

  return (
    <>
      <PageHeader title={`Olá, ${firstName}`} subtitle="Bem-vindo(a) de volta." />
      <Typography color="text.secondary">O painel com a agenda do dia e o resumo financeiro chega em breve.</Typography>
    </>
  );
}
