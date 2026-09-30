import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

interface SectionCardProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/** Bloco de conteúdo com título, usado em telas de formulário/configuração. */
export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
        {children}
      </Stack>
    </Paper>
  );
}
