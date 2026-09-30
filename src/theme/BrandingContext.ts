import { createContext, useContext } from 'react';
import type { PublicBranding } from '@/api/types';

export type BrandingStatus = 'loading' | 'found' | 'notFound' | 'error';

export interface BrandingContextValue {
  status: BrandingStatus;
  branding: PublicBranding | null;
  /** tradeName ?? name, ou "bem-te-vi" quando não há clínica resolvida. */
  displayName: string;
  logoUrl: string | null;
}

export const BrandingContext = createContext<BrandingContextValue | null>(null);

export function useBranding(): BrandingContextValue {
  const context = useContext(BrandingContext);
  if (!context) throw new Error('useBranding precisa estar dentro de <BrandingProvider>');
  return context;
}
