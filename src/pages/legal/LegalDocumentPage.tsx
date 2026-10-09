import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { legalApi, legalKeys } from '@/api/legal';
import type { LegalDocument } from '@/api/types';
import { BrandMark } from '@/components/BrandMark';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PublicCardLayout } from '@/layouts/PublicCardLayout';
import { formatDate } from '@/lib/format';
import { LEGAL_DOCUMENTS } from '@/legal/documents';

/** /termos e /privacidade: texto do front para a versão vigente informada pela API. */
function LegalDocumentPage({ kind }: { kind: LegalDocument }) {
  const versions = useQuery({ queryKey: legalKeys.current, queryFn: legalApi.current, staleTime: 5 * 60_000 });
  const info = LEGAL_DOCUMENTS[kind];
  const version = versions.data?.[kind].version;
  const text = version ? info.texts[version] : undefined;

  return (
    <PublicCardLayout maxWidth={760}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <BrandMark size={40} hideName />
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              {info.title}
            </Typography>
            {version && (
              <Typography variant="body2" color="text.secondary">
                Versão {version}
                {text && ` · vigente desde ${formatDate(text.effectiveDate)}`}
              </Typography>
            )}
          </Box>
        </Stack>

        <ErrorMessages error={versions.error} />
        {versions.data &&
          (text ? (
            <Stack spacing={2.5}>
              {text.sections.map((section) => (
                <Box key={section.heading}>
                  <Typography variant="h6" component="h2" gutterBottom>
                    {section.heading}
                  </Typography>
                  {section.paragraphs.map((paragraph, index) => (
                    <Typography key={index} sx={{ mb: 1.5 }}>
                      {paragraph}
                    </Typography>
                  ))}
                </Box>
              ))}
            </Stack>
          ) : (
            <Alert severity="info">O texto deste documento está em elaboração e será publicado em breve.</Alert>
          ))}
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
