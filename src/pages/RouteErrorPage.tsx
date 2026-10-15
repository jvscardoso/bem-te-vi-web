import { useState } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Box, Button } from '@mui/material';
import { StatusScreen } from '@/components/StatusScreen';
import { NotFoundPage } from './NotFoundPage';

const RELOAD_KEY = 'btv.chunkReloadAt';
// Só recarrega sozinho se não fez isso há pouco: se o arquivo continuar faltando depois do
// reload, o problema é outro e a tela de erro aparece em vez de um loop.
const RELOAD_GUARD_MS = 30_000;

/**
 * Arquivo de tela que não carregou. Depois de uma publicação nova, quem está com o app aberto
 * pede os arquivos da versão antiga, que não existem mais (cada build muda os nomes). As
 * mensagens variam por navegador (Chrome, Firefox, Safari) e pelo pré-carregamento do Vite.
 */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS|error loading dynamically/i.test(
    message,
  );
}

/** Recarrega a página se não recarregou pelo mesmo motivo nos últimos segundos. */
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY));
    if (last && Date.now() - last < RELOAD_GUARD_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * Tela de erro do roteador (`errorElement`): erro inesperado ao montar uma tela ou falha ao
 * baixar o código dela. No layout do app, aparece no lugar do conteúdo (o menu continua);
 * fora dele, na tela inteira.
 */
export function RouteErrorPage({ fullScreen }: { fullScreen?: boolean }) {
  const error = useRouteError();
  const chunkError = isChunkLoadError(error);
  // Decidido no primeiro render: o reload descarta a página, então não há o que mostrar depois.
  const [reloading] = useState(() => chunkError && reloadOnce());

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage fullScreen={fullScreen} />;
  if (reloading) return null;

  if (chunkError) {
    return (
      <StatusScreen
        fullScreen={fullScreen}
        title="Nova versão disponível"
        description="O bem-te-vi foi atualizado enquanto esta página estava aberta. Recarregue para continuar."
        action={
          <Button variant="contained" onClick={() => window.location.reload()}>
            Recarregar
          </Button>
        }
      />
    );
  }

  const detail = import.meta.env.DEV && error instanceof Error ? error.message : null;
  return (
    <StatusScreen
      fullScreen={fullScreen}
      title="Algo deu errado"
      description={
        <>
          Não foi possível mostrar esta tela. Recarregue a página; se o problema continuar, fale com o suporte.
          {detail && (
            <Box component="code" sx={{ display: 'block', mt: 2, fontSize: 12, wordBreak: 'break-word' }}>
              {detail}
            </Box>
          )}
        </>
      }
      action={
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Recarregar
          </Button>
          {/* Navegação completa: o estado em memória pode ser a causa do erro. */}
          <Button onClick={() => window.location.assign('/')}>Ir para o início</Button>
        </Box>
      }
    />
  );
}
