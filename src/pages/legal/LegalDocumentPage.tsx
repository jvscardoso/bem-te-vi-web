import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { legalApi, legalKeys } from '@/api/legal';
import { BrandMark } from '@/components/BrandMark';
import { PublicCardLayout } from '@/layouts/PublicCardLayout';

const DOCUMENTS = {
  terms: { title: 'Termos de Uso' },
  privacy: { title: 'Política de Privacidade' },
} as const;

/**
 * /termos e /privacidade — os textos são do produto bem-te-vi (não da clínica) e ficam no
 * front; a API só informa a versão vigente, que é a registrada no aceite.
 *
 * TODO: substituir o aviso abaixo pelo texto oficial de cada documento.
 */
function LegalDocumentPage({ kind }: { kind: keyof typeof DOCUMENTS }) {
  const versions = useQuery({ queryKey: legalKeys.current, queryFn: legalApi.current, staleTime: 5 * 60_000 });
  const version = versions.data?.[kind].version;

  return (
    <PublicCardLayout maxWidth={760}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <BrandMark size={40} hideName />
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              {DOCUMENTS[kind].title}
            </Typography>
            {version && (
              <Typography variant="body2" color="text.secondary">
                Versão {version}
              </Typography>
            )}
          </Box>
        </Stack>
        <Alert severity="info">O texto deste documento está em elaboração e será publicado em breve.</Alert>
      </Stack>
    </PublicCardLayout>
  );
}

export function TermsPage() {
  return <LegalDocumentPage kind="terms" />;
}

export function PrivacyPage() {
  return <LegalDocumentPage kind="privacy" />;
}
