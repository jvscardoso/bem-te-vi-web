import { IconButton, InputAdornment, TextField, type TextFieldProps } from '@mui/material';
import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';

type SearchFieldProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
};

export function SearchField({ value, onChange, ...props }: SearchFieldProps) {
  return (
    <TextField
      size="small"
      {...props}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{
        // Sem type="search": o botão nativo de limpar duplicaria o nosso.
        htmlInput: { maxLength: 100, role: 'searchbox', 'aria-label': props.placeholder },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="Limpar busca" onClick={() => onChange('')}>
                <Close fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  );
}
