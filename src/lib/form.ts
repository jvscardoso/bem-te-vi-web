import type { FieldError, UseFormRegisterReturn } from 'react-hook-form';

/**
 * Liga um campo do React Hook Form a um TextField do MUI.
 * O `ref` precisa ir para o <input> (inputRef), senão o foco no erro não funciona.
 */
export function muiField(registration: UseFormRegisterReturn, error?: FieldError) {
  const { ref, ...rest } = registration;
  return { ...rest, inputRef: ref, error: !!error, helperText: error?.message };
}
