import { Fragment } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Box, Button, Dialog, DialogActions, DialogContent, Link, Stack, Typography } from '@mui/material';
import { isOutdatedLegalVersion, legalApi } from '@/api/legal';
import type { LegalDocument } from '@/api/types';
import { BrandMark } from '@/components/BrandMark';
import { ErrorMessages } from '@/components/ErrorMessages';
import { useLegalAcceptance } from '@/components/useLegalAcceptance';
import { LEGAL_DOCUMENTS } from '@/legal/documents';
import { useAuth } from './AuthContext';

/** "Atualizamos nossa Política…" / "nossos Termos…": o artigo depende do documento. */
const UPDATED_PREFIX: Record<LegalDocument, string> = { terms: 'nossos', privacy: 'nossa' };

function DocumentLink({ kind }: { kind: LegalDocument }) {
  return (
    <Link href={LEGAL_DOCUMENTS[kind].path} target="_blank" rel="noopener">
      {LEGAL_DOCUMENTS[kind].title}
    </Link>
  );
}

/**
 * Bloqueio enquanto há Termos/Política pendentes (`pendingLegalDocuments` de `/auth/me`):
 * usuário criado com senha pelo admin, ou versão nova publicada. A API não bloqueia as
 * outras rotas; quem impede o uso é o front, que não renderiza o app por trás deste modal.
 */
export function PendingLegalScreen({ pending }: { pending: LegalDocument[] }) {
  const { user, logout, refresh } = useAuth();
  const legal = useLegalAcceptance();

  const accept = useMutation({
    // Sempre as duas versões vigentes, mesmo que só uma esteja pendente.
    mutationFn: async () => {
      await legalApi.accept(legal.acceptance!);
      await refresh(); // o /auth/me sem pendências libera o app
    },
    onError: (error) => {
      if (isOutdatedLegalVersion(error)) void legal.refresh();
    },
  });

  const single = pending.length === 1 ? pending[0] : null;
  const title = single
    ? `Atualizamos ${UPDATED_PREFIX[single]} ${LEGAL_DOCUMENTS[single].title}`
    : 'Termos de Uso e Política de Privacidade';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Sem onClose: Esc e clique fora não fecham. */}
      <Dialog open fullWidth maxWidth="xs" aria-labelledby="pending-legal-title">
        <DialogContent>
          <Stack spacing={2.5} sx={{ alignItems: 'center', textAlign: 'center', pt: 1 }}>
            <BrandMark size={48} hideName />
            <Typography id="pending-legal-title" variant="h6" component="h1" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography color="text.secondary">
              {single ? (
                <>
                  Atualizamos {UPDATED_PREFIX[single]} <DocumentLink kind={single} />. Leia e aceite para continuar.
                </>
              ) : (
                <>
                  Para continuar, aceite os <DocumentLink kind="terms" /> e a <DocumentLink kind="privacy" />.
                </>
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ao clicar em “Aceitar e continuar”, você declara que leu e aceita{' '}
              {pending.map((kind, index) => (
                <Fragment key={kind}>
                  {index > 0 && ' e '}
                  {kind === 'terms' ? 'os' : 'a'} {LEGAL_DOCUMENTS[kind].title}
                </Fragment>
              ))}
              .
            </Typography>
            {user && (
              <Typography variant="caption" color="text.secondary">
                Conectado como {user.email}
              </Typography>
            )}
          </Stack>
          <Box sx={{ mt: 2 }}>
            <ErrorMessages error={legal.error ?? accept.error} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={logout} disabled={accept.isPending}>
            Sair
          </Button>
          <Button
            variant="contained"
            onClick={() => accept.mutate()}
            loading={accept.isPending}
            disabled={!legal.acceptance}
          >
            Aceitar e continuar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
