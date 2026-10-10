import type { ReactNode } from 'react';
import { Box, Paper } from '@mui/material';

/** Card centralizado das telas públicas (login, senha, convite). */
export function PublicCardLayout({ children, maxWidth = 420 }: { children: ReactNode; maxWidth?: number }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, bgcolor: 'background.default' }}>
      <Paper variant="outlined" sx={{ width: '100%', maxWidth, p: { xs: 3, sm: 4 } }}>
        {children}
      </Paper>
    </Box>
  );
}
