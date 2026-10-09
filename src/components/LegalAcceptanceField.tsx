import { Checkbox, FormControl, FormControlLabel, FormHelperText, Link } from '@mui/material';
import { LEGAL_DOCUMENTS } from '@/legal/documents';
import { ErrorMessages } from './ErrorMessages';

interface LegalAcceptanceFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  /** Erro ao carregar as versões vigentes (sem elas não dá para registrar o aceite). */
  loadError?: unknown;
}

/**
 * Caixa de aceite dos Termos de Uso e da Política de Privacidade (LGPD). Os links abrem os
 * textos em outra aba, para não perder o que já foi preenchido.
 */
export function LegalAcceptanceField({ checked, onChange, error, loadError }: LegalAcceptanceFieldProps) {
  if (loadError) return <ErrorMessages error={loadError} />;

  return (
    <FormControl error={!!error}>
      <FormControlLabel
        sx={{ alignItems: 'flex-start', '& .MuiCheckbox-root': { pt: 0.25 } }}
        control={<Checkbox checked={checked} onChange={(_, value) => onChange(value)} />}
        label={
          <>
            Li e aceito os{' '}
            <Link href={LEGAL_DOCUMENTS.terms.path} target="_blank" rel="noopener">
              Termos de Uso
            </Link>{' '}
            e a{' '}
            <Link href={LEGAL_DOCUMENTS.privacy.path} target="_blank" rel="noopener">
              Política de Privacidade
            </Link>
            .
          </>
        }
      />
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}
