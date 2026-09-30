import { Avatar, Stack, Typography } from '@mui/material';
import { useBranding } from '@/theme/BrandingContext';

/** Logo + nome da clínica (ou do bem-te-vi, sem clínica resolvida). */
export function BrandMark({ size = 36, hideName = false }: { size?: number; hideName?: boolean }) {
  const { displayName, logoUrl } = useBranding();
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
      <Avatar
        src={logoUrl ?? undefined}
        alt={displayName}
        variant="rounded"
        sx={{ width: size, height: size, bgcolor: 'primary.main', fontWeight: 700 }}
      >
        {displayName.charAt(0).toUpperCase()}
      </Avatar>
      {!hideName && (
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
          {displayName}
        </Typography>
      )}
    </Stack>
  );
}
