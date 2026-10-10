import { createTheme, getContrastRatio, lighten } from '@mui/material/styles';
import { ptBR } from '@mui/material/locale';
import type { ColorMode } from './colorMode';

// Tema padrão do bem-te-vi (usado quando a clínica não definiu cores).
export const DEFAULT_PRIMARY = '#2F5D50';
export const DEFAULT_SECONDARY = '#E8B525';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const SURFACES = {
  light: { default: '#F6F7F9', paper: '#FFFFFF', border: '#E3E6EA' },
  dark: { default: '#0F1214', paper: '#171B1F', border: '#2A3036' },
} as const;

function validColor(value: string | null | undefined, fallback: string) {
  return value && HEX_COLOR.test(value) ? value : fallback;
}

/**
 * No modo escuro, a cor da clínica costuma ser escura demais para texto e ícones sobre o fundo
 * (ex.: o verde padrão). Clareia aos poucos até atingir o contraste mínimo; cores já claras
 * ficam como estão.
 */
function readableOnDark(color: string, minContrast: number) {
  let result = color;
  for (let step = 0; step < 8 && getContrastRatio(result, SURFACES.dark.paper) < minContrast; step++) {
    result = lighten(result, 0.15);
  }
  return result;
}

export interface ThemeColors {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  mode?: ColorMode;
}

export function createAppTheme({ primaryColor, secondaryColor, mode = 'light' }: ThemeColors = {}) {
  const dark = mode === 'dark';
  const surface = SURFACES[mode];
  const primary = validColor(primaryColor, DEFAULT_PRIMARY);
  const secondary = validColor(secondaryColor, DEFAULT_SECONDARY);

  return createTheme(
    {
      palette: {
        mode,
        // Texto preto ou branco sobre a cor da clínica pelo critério de acessibilidade (AA, 4,5:1), não 3:1.
        contrastThreshold: 4.5,
        primary: { main: dark ? readableOnDark(primary, 6) : primary },
        secondary: { main: dark ? readableOnDark(secondary, 3) : secondary },
        background: { default: surface.default, paper: surface.paper },
        divider: surface.border,
      },
      shape: { borderRadius: 10 },
      typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        button: { textTransform: 'none', fontWeight: 600 },
      },
      components: {
        MuiButton: { defaultProps: { disableElevation: true } },
        MuiTextField: { defaultProps: { fullWidth: true } },
        MuiPaper: {
          defaultProps: { elevation: 0 },
          // Sem o degradê que o MUI aplica ao Paper no modo escuro: o contraste vem da cor de fundo.
          styleOverrides: { root: { backgroundImage: 'none' }, outlined: { borderColor: surface.border } },
        },
        MuiAppBar: { defaultProps: { elevation: 0, color: 'inherit' } },
      },
    },
    ptBR,
  );
}
