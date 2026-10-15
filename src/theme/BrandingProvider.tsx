import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { publicApi } from '@/api/auth';
import { AddressNotFoundScreen } from '@/components/AddressNotFoundScreen';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { isApiError } from '@/lib/errors';
import { BrandingContext, type BrandingContextValue } from './BrandingContext';
import { getBrandingHost, isPlatformAddress } from './brandingHost';
import { ColorModeContext, useColorModeState } from './colorMode';
import { createAppTheme } from './createAppTheme';

const PRODUCT_NAME = 'bem-te-vi';

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [host] = useState(getBrandingHost);
  const [platformAddress] = useState(isPlatformAddress);

  const query = useQuery({
    queryKey: ['public-branding', host],
    queryFn: () => publicApi.branding(host),
    staleTime: 5 * 60_000,
    gcTime: Infinity,
    retry: (count, error) => !isApiError(error, 404) && count < 2,
    refetchOnWindowFocus: false,
  });

  const branding = query.data ?? null;

  const value = useMemo<BrandingContextValue>(() => {
    let status: BrandingContextValue['status'] = 'loading';
    if (branding) status = 'found';
    else if (isApiError(query.error, 404)) status = 'notFound';
    else if (query.error) status = 'error';

    return {
      status,
      branding,
      displayName: branding ? (branding.tradeName ?? branding.name) : PRODUCT_NAME,
      logoUrl: branding?.logoUrl ?? null,
    };
  }, [branding, query.error]);

  const colorMode = useColorModeState();
  const theme = useMemo(
    () =>
      createAppTheme({
        primaryColor: branding?.primaryColor,
        secondaryColor: branding?.secondaryColor,
        mode: colorMode.mode,
      }),
    [branding?.primaryColor, branding?.secondaryColor, colorMode.mode],
  );

  useEffect(() => {
    document.title = value.status === 'notFound' && !platformAddress ? 'Endereço não encontrado' : value.displayName;
  }, [value.displayName, value.status, platformAddress]);

  // Endereço de clínica: espera a marca em vez de mostrar a do bem-te-vi e trocar em seguida, e
  // sem clínica ativa nele não há o que abrir (o login falharia sem explicar por quê). Erro de
  // rede ou da API segue com a marca padrão, como antes.
  let content = children;
  if (!platformAddress && value.status === 'loading') content = <FullScreenLoader />;
  else if (!platformAddress && value.status === 'notFound') content = <AddressNotFoundScreen />;

  return (
    <BrandingContext.Provider value={value}>
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          {/* enableColorScheme: campos nativos (data, hora, rolagem) acompanham o modo escuro. */}
          <CssBaseline enableColorScheme />
          {content}
        </ThemeProvider>
      </ColorModeContext.Provider>
    </BrandingContext.Provider>
  );
}
