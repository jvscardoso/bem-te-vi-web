import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

interface StatusScreenProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Ocupa a tela inteira (fora do layout) ou só a área de conteúdo. */
  fullScreen?: boolean;
}

export function StatusScreen({ title, description, action, fullScreen }: StatusScreenProps) {
  return (
    <Box sx={{ minHeight: fullScreen ? '100vh' : 320, display: 'grid', placeItems: 'center', p: 3 }}>
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', maxWidth: 440 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {description && <Typography color="text.secondary">{description}</Typography>}
        {action}
      </Stack>
    </Box>
  );
}
