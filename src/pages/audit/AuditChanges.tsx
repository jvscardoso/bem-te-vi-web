import { Box, Stack, Typography } from '@mui/material';
import ArrowForward from '@mui/icons-material/ArrowForward';
import type { FieldChange } from './auditFormat';

/** "Telefone: (81) 99999-0000 → (81) 98888-7777", uma linha por campo alterado. */
export function AuditChanges({ changes }: { changes: FieldChange[] }) {
  if (changes.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nenhum campo alterado.
      </Typography>
    );
  }
  return (
    <Stack spacing={0.75}>
      {changes.map((change) => (
        <Box key={change.label} sx={{ typography: 'body2' }}>
          <Box component="span" sx={{ fontWeight: 600 }}>
            {change.label}:
          </Box>{' '}
          <Box component="span" sx={{ color: 'text.secondary', textDecoration: 'line-through' }}>
            {change.from}
          </Box>
          <ArrowForward sx={{ fontSize: 14, mx: 0.75, verticalAlign: 'middle', color: 'text.secondary' }} />
          <Box component="span">{change.to}</Box>
        </Box>
      ))}
    </Stack>
  );
}
