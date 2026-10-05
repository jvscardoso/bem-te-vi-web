import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { publicApi } from '@/api/auth';
import { isApiError } from '@/lib/errors';
import { BrandingContext, type BrandingContextValue } from './BrandingContext';
import { getBrandingHost } from './brandingHost';
import { createAppTheme } from './createAppTheme';

const PRODUCT_NAME = 'bem-te-vi';

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [host] = useState(getBrandingHost);

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

  const theme = useMemo(
    () => createAppTheme({ primaryColor: branding?.primaryColor, secondaryColor: branding?.secondaryColor }),
    [branding?.primaryColor, branding?.secondaryColor],
  );

  useEffect(() => {
    document.title = value.displayName;
  }, [value.displayName]);

  return (
    <BrandingContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </BrandingContext.Provider>
  );
}
