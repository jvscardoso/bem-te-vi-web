import { createTheme } from '@mui/material/styles';
import { ptBR } from '@mui/material/locale';

// Tema padrão do bem-te-vi (usado quando a clínica não definiu cores).
export const DEFAULT_PRIMARY = '#2F5D50';
export const DEFAULT_SECONDARY = '#E8B525';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function validColor(value: string | null | undefined, fallback: string) {
  return value && HEX_COLOR.test(value) ? value : fallback;
}

export interface ThemeColors {
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export function createAppTheme({ primaryColor, secondaryColor }: ThemeColors = {}) {
  return createTheme({
    palette: {
      primary: { main: validColor(primaryColor, DEFAULT_PRIMARY) },
      secondary: { main: validColor(secondaryColor, DEFAULT_SECONDARY) },
      background: { default: '#F6F7F9' },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiTextField: { defaultProps: { fullWidth: true } },
      MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { outlined: { borderColor: '#E3E6EA' } } },
      MuiAppBar: { defaultProps: { elevation: 0, color: 'inherit' } },
    },
  }, ptBR);
}
