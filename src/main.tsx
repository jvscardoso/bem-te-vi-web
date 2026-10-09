import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { AuthProvider } from '@/auth/AuthProvider';
import { NotificationProvider } from '@/components/notifications/NotificationProvider';
import { BrandingProvider } from '@/theme/BrandingProvider';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Erros 4xx são definitivos; só vale repetir falha de rede/servidor.
      retry: (failureCount, error) =>
        failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

// Toda leitura de paciente e de fichas de anamnese é registrada na trilha de auditoria (LGPD):
// voltar o foco para a aba não deve gerar um novo "Visualizou o cadastro".
for (const root of ['patients', 'anamnesis-records']) {
  queryClient.setQueryDefaults([root], { refetchOnWindowFocus: false });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <NotificationProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </NotificationProvider>
      </BrandingProvider>
    </QueryClientProvider>
  </StrictMode>,
);
