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
