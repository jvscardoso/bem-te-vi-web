import { useState, type ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha, darken, getContrastRatio } from '@mui/material/styles';
import { BrandMark } from '@/components/BrandMark';
import { useBranding } from '@/theme/BrandingContext';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, validColor } from '@/theme/createAppTheme';

/**
 * Tela de entrada em duas metades: à esquerda a marca da clínica (cor, logo e nome), à direita
 * o formulário. No celular o painel some e a marca aparece pequena acima do formulário.
 */
export function AuthSplitLayout({ children }: { children: ReactNode }) {
  const { status, displayName } = useBranding();
  const tagline = status === 'found' ? 'Acesse sua conta para continuar' : 'Gestão de clínicas';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(440px, 40%)' },
        bgcolor: 'background.paper',
      }}
    >
      <BrandPanel name={displayName} tagline={tagline} />

      <Box sx={{ display: 'grid', placeItems: 'center', px: { xs: 2, sm: 6 }, py: { xs: 4, md: 6 } }}>
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          {/* Celular: sem o painel, a marca fica aqui. */}
          <Stack spacing={1.5} sx={{ display: { md: 'none' }, alignItems: 'center', textAlign: 'center', mb: 4 }}>
            <BrandMark size={56} hideName />
            <Typography variant="h5" component="p" sx={{ fontWeight: 700 }}>
              {displayName}
            </Typography>
          </Stack>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

function BrandPanel({ name, tagline }: { name: string; tagline: string }) {
  const { branding, logoUrl } = useBranding();
  // A cor original da marca, nos dois modos: a `palette.primary` do tema escuro vem clareada
  // (para texto sobre fundo escuro) e deixaria o painel desbotado.
  const primary = validColor(branding?.primaryColor, DEFAULT_PRIMARY);
  const secondary = validColor(branding?.secondaryColor, DEFAULT_SECONDARY);

  return (
    <Box
      sx={(theme) => ({
        display: { xs: 'none', md: 'flex' },
        position: 'relative',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        p: 6,
        color: theme.palette.getContrastText(primary),
        background: `linear-gradient(135deg, ${primary} 0%, ${darken(primary, 0.3)} 100%)`,
      })}
    >
      {/* Formas decorativas na cor secundária da clínica, atrás do conteúdo. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          width: 520,
          height: 520,
          borderRadius: '50%',
          top: -180,
          right: -160,
          bgcolor: alpha(secondary, 0.22),
        }}
      />
      <Box
        aria-hidden
        sx={(theme) => ({
          position: 'absolute',
          width: 360,
          height: 360,
          borderRadius: '50%',
          bottom: -140,
          left: -100,
          bgcolor: alpha(theme.palette.common.white, 0.08),
        })}
      />

      <Stack spacing={3} sx={{ position: 'relative', alignItems: 'center', textAlign: 'center', maxWidth: 480 }}>
        <LogoTile logoUrl={logoUrl} name={name} color={primary} />
        <Box>
          <Typography variant="h3" component="p" sx={{ fontWeight: 700, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
            {name}
          </Typography>
          <Typography variant="h6" component="p" sx={{ mt: 1.5, fontWeight: 400, opacity: 0.85 }}>
            {tagline}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

/** Logo sobre um quadro branco: qualquer logo (escuro, colorido, transparente) fica legível na cor da clínica. */
function LogoTile({ logoUrl, name, color }: { logoUrl: string | null; name: string; color: string }) {
  // Logo externo que não carrega (URL quebrada): cai para a inicial em vez do ícone de imagem quebrada.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = logoUrl && failedUrl !== logoUrl;

  return (
    <Box
      sx={{
        width: 128,
        height: 128,
        borderRadius: 4,
        bgcolor: 'common.white',
        boxShadow: 6,
        display: 'grid',
        placeItems: 'center',
        p: showImage ? 2 : 0,
        overflow: 'hidden',
      }}
    >
      {showImage ? (
        <Box
          component="img"
          src={logoUrl}
          alt={`Logo de ${name}`}
          onError={() => setFailedUrl(logoUrl)}
          sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      ) : (
        <Typography
          aria-hidden
          // Cor da marca clara demais (amarelo, por exemplo) não aparece sobre o branco: escurece.
          sx={{
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1,
            color: getContrastRatio(color, '#fff') >= 3 ? color : darken(color, 0.5),
          }}
        >
          {name.charAt(0).toUpperCase()}
        </Typography>
      )}
    </Box>
  );
}
