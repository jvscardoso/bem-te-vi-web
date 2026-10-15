import { useNavigation } from 'react-router';
import { LinearProgress } from '@mui/material';

/**
 * Barra no topo enquanto o roteador baixa o código da próxima tela. Sem ela, a tela anterior
 * fica parada até a nova aparecer, e numa conexão lenta parece que o clique não funcionou.
 * Só aparece depois de um instante, para não piscar quando a tela já está no cache.
 */
export function NavigationProgress() {
  const navigation = useNavigation();
  if (navigation.state === 'idle') return null;

  return (
    <LinearProgress
      aria-label="Carregando a página"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: (theme) => theme.zIndex.tooltip + 1,
        '@keyframes btvNavigationProgress': { from: { opacity: 0 }, to: { opacity: 1 } },
        animation: 'btvNavigationProgress 150ms ease-in 200ms both',
      }}
    />
  );
}
