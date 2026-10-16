import { Avatar, Stack, Typography } from '@mui/material';
import { useBranding } from '@/theme/BrandingContext';

/** Logo + nome da clínica (ou do bem-te-vi, sem clínica resolvida). */
interface BrandMarkProps {
  size?: number;
  hideName?: boolean;
  /** Cores do quadrado sem logo quando o fundo já é a cor da clínica (menu lateral). */
  avatarColors?: { bg: string; fg: string };
}

export function BrandMark({ size = 36, hideName = false, avatarColors }: BrandMarkProps) {
  const { displayName, logoUrl } = useBranding();
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
      <Avatar
        src={logoUrl ?? undefined}
        alt={displayName}
        variant="rounded"
        sx={{
          width: size,
          height: size,
          bgcolor: avatarColors?.bg ?? 'primary.main',
          color: avatarColors?.fg,
          fontWeight: 700,
        }}
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
