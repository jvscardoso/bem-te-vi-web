import { Controller, type Control } from 'react-hook-form';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material';
import type { AnamnesisField } from '@/api/types';
import { validateAnswer, type FormAnswer, type FormAnswers } from './answers';

interface AnamnesisFieldInputProps {
  field: AnamnesisField;
  control: Control<{ answers: FormAnswers }>;
}

/** Componente de entrada adequado ao tipo do campo da anamnese. */
export function AnamnesisFieldInput({ field, control }: AnamnesisFieldInputProps) {
  return (
    <Controller
      name={`answers.${field.key}`}
      control={control}
      rules={{ validate: (value) => validateAnswer(field, value as FormAnswer) }}
      render={({ field: input, fieldState }) => {
        const error = fieldState.error?.message;

        switch (field.type) {
          case 'boolean':
            return (
              <FormControl error={!!error} required={field.required}>
                <FormLabel>{field.label}</FormLabel>
                <RadioGroup row value={input.value} onChange={input.onChange} onBlur={input.onBlur}>
                  <FormControlLabel value="true" control={<Radio slotProps={{ input: { ref: input.ref } }} />} label="Sim" />
                  <FormControlLabel value="false" control={<Radio />} label="Não" />
                </RadioGroup>
                {error && <FormHelperText>{error}</FormHelperText>}
              </FormControl>
            );

          case 'multiselect': {
            const selected = (input.value as string[]) ?? [];
            const toggle = (option: string) =>
              input.onChange(
                selected.includes(option)
                  ? selected.filter((item) => item !== option)
                  : field.options!.filter((item) => item === option || selected.includes(item)),
              );
            return (
              <FormControl error={!!error} required={field.required} component="fieldset">
                <FormLabel component="legend">{field.label}</FormLabel>
                <FormGroup row>
                  {field.options?.map((option, index) => (
                    <FormControlLabel
                      key={option}
                      label={option}
                      control={
                        <Checkbox
                          checked={selected.includes(option)}
                          onChange={() => toggle(option)}
                          onBlur={input.onBlur}
                          slotProps={index === 0 ? { input: { ref: input.ref } } : undefined}
                        />
                      }
                    />
                  ))}
                </FormGroup>
                {error && <FormHelperText>{error}</FormHelperText>}
              </FormControl>
            );
          }

          case 'select':
            return (
              <TextField
                select
                label={field.label}
                required={field.required}
                value={input.value}
                onChange={input.onChange}
                onBlur={input.onBlur}
                inputRef={input.ref}
                error={!!error}
                helperText={error}
              >
                {!field.required && (
                  <MenuItem value="">
                    <em>Não informado</em>
                  </MenuItem>
                )}
                {field.options?.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            );

          default:
            return (
              <TextField
                label={field.label}
                required={field.required}
                type={field.type === 'date' ? 'date' : 'text'}
                multiline={field.type === 'textarea'}
                minRows={field.type === 'textarea' ? 3 : undefined}
                value={input.value}
                onChange={input.onChange}
                onBlur={input.onBlur}
                inputRef={input.ref}
                error={!!error}
                helperText={error}
                slotProps={{
                  htmlInput: { inputMode: field.type === 'number' ? 'decimal' : undefined },
                  inputLabel: field.type === 'date' ? { shrink: true } : undefined,
                }}
              />
            );
        }
      }}
    />
  );
}
