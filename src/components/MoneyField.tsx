import { InputAdornment, TextField, type TextFieldProps } from '@mui/material';
import { maskMoney } from '@/lib/masks';

type MoneyFieldProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  /** Texto mascarado ("150,00"); converta com `moneyToCents`. */
  value: string;
  onChange: (value: string) => void;
};

/** Campo de valor em reais, digitado como em caixa eletrônico (centavos à direita). */
export function MoneyField({ value, onChange, slotProps, ...props }: MoneyFieldProps) {
  return (
    <TextField
      {...props}
      value={value}
      onChange={(event) => onChange(maskMoney(event.target.value))}
      placeholder="0,00"
      slotProps={{
        ...slotProps,
        htmlInput: { inputMode: 'numeric', style: { textAlign: 'right' } },
        input: { startAdornment: <InputAdornment position="start">R$</InputAdornment> },
        inputLabel: { shrink: true },
      }}
    />
  );
}
