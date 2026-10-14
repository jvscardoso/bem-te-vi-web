import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // A API na mesma origem do front (VITE_API_URL=/api): o cookie de refresh é SameSite=Strict, e
    // `clinica-a.localhost` e `localhost:3000` são sites diferentes para o navegador. Pelo proxy,
    // o cookie vale para /api/auth em qualquer subdomínio, como em produção nos domínios próprios.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Base usada por todas as telas e que muda pouco: arquivo estável, fica no cache
            // do navegador entre as publicações. O MUI fica com a divisão automática, para
            // o login não baixar componentes que só outras telas usam.
            {
              name: 'vendor',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|@tanstack)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
