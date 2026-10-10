import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ColorMode = 'light' | 'dark';

export interface ColorModeContextValue {
  /** Modo em uso (a escolha do usuário ou, sem escolha, o do sistema). */
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
}

export const ColorModeContext = createContext<ColorModeContextValue | null>(null);

export function useColorMode(): ColorModeContextValue {
  const context = useContext(ColorModeContext);
  if (!context) throw new Error('useColorMode precisa estar dentro de <BrandingProvider>');
  return context;
}

// Preferência por navegador (não por usuário nem por clínica): vale também nas telas públicas.
const STORAGE_KEY = 'btv.colorMode';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readSaved(): ColorMode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

const systemMode = (): ColorMode => (window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light');

/**
 * Estado do modo de cor: lido antes do primeiro render (sem piscar o tema claro) e, enquanto
 * o usuário não escolher, acompanha o tema do sistema operacional.
 */
export function useColorModeState(): ColorModeContextValue {
  const [saved, setSaved] = useState<ColorMode | null>(readSaved);
  const [system, setSystem] = useState<ColorMode>(systemMode);

  useEffect(() => {
    const query = window.matchMedia?.(DARK_QUERY);
    if (!query) return;
    const onChange = () => setSystem(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const setMode = useCallback((mode: ColorMode) => {
    setSaved(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Armazenamento indisponível: vale só nesta sessão.
    }
  }, []);

  return { mode: saved ?? system, setMode };
}
