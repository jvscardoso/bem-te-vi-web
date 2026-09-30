import { Box, CircularProgress } from '@mui/material';

export function FullScreenLoader() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress aria-label="Carregando" />
    </Box>
  );
}
