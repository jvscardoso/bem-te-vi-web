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

// Cor fixa extra para status (ex.: agendamento confirmado). Status não usam `primary`: com a cor
// da clínica, eles mudariam de marca para marca e poderiam coincidir com `info` (azul).
const PURPLE = {
  light: { main: '#7B1FA2', light: '#AE52D4', dark: '#4A0072', contrastText: '#FFFFFF' },
  dark: { main: '#CE93D8', light: '#F3E5F5', dark: '#AB47BC', contrastText: 'rgba(0, 0, 0, 0.87)' },
} as const;

declare module '@mui/material/styles' {
  interface Palette {
    purple: Palette['primary'];
  }
  interface PaletteOptions {
    purple?: PaletteOptions['primary'];
  }
}
declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    purple: true;
  }
}
declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    purple: true;
  }
}

/** Cor da marca como a clínica definiu (sem o ajuste do modo escuro), ou o padrão do bem-te-vi. */
export function validColor(value: string | null | undefined, fallback: string) {
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
        purple: PURPLE[mode],
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
