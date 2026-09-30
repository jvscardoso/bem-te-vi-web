import { z } from 'zod';
import { typeHasOptions } from '@/api/anamnesis';
import type { AnamnesisField, AnamnesisFieldType, AnamnesisTemplate } from '@/api/types';

export const MAX_FIELDS = 50;
const MAX_OPTIONS = 50;
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const FIELD_TYPES = ['text', 'textarea', 'number', 'boolean', 'date', 'select', 'multiselect'] as const;

const fieldSchema = z.object({
  label: z.string().trim().min(1, 'Informe o rótulo').max(150, 'Máximo de 150 caracteres'),
  key: z
    .string()
    .min(1, 'Informe a chave')
    .max(60, 'Máximo de 60 caracteres')
    .regex(KEY_PATTERN, 'Comece com letra; use só minúsculas, números e "_"'),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  /** Uma opção por linha (só para escolha única/múltipla). */
  optionsText: z.string(),
  /** Chave digitada à mão (ou de campo já existente): não acompanha mais o rótulo. */
  keyLocked: z.boolean(),
  /** Chave original do campo ao abrir o formulário (edição). */
  originalKey: z.string().optional(),
});

export const templateSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome do formulário').max(100, 'Máximo de 100 caracteres'),
    fields: z.array(fieldSchema).min(1, 'Adicione ao menos um campo').max(MAX_FIELDS, `Máximo de ${MAX_FIELDS} campos`),
  })
  .superRefine((values, ctx) => {
    const seen = new Map<string, number>();
    values.fields.forEach((field, index) => {
      const previous = seen.get(field.key);
      if (field.key && previous !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['fields', index, 'key'],
          message: `Chave repetida (campo ${previous + 1})`,
        });
      } else {
        seen.set(field.key, index);
      }

      if (!typeHasOptions(field.type)) return;
      const options = parseOptions(field.optionsText);
      const message =
        options.length === 0
          ? 'Informe ao menos uma opção'
          : options.length > MAX_OPTIONS
            ? `Máximo de ${MAX_OPTIONS} opções`
            : options.some((option) => option.length > 80)
              ? 'Cada opção pode ter até 80 caracteres'
              : new Set(options).size !== options.length
                ? 'Há opções repetidas'
                : null;
      if (message) ctx.addIssue({ code: 'custom', path: ['fields', index, 'optionsText'], message });
    });
  });

export type TemplateFormValues = z.infer<typeof templateSchema>;
export type FieldFormValues = TemplateFormValues['fields'][number];

export function parseOptions(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** "Início dos sintomas?" → "inicio_dos_sintomas" */
export function keyFromLabel(label: string): string {
  let key = label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (key && !/^[a-z]/.test(key)) key = `campo_${key}`;
  return key.slice(0, 60).replace(/_+$/, '');
}

/** Garante chave única acrescentando _2, _3… */
export function uniqueKey(base: string, taken: string[]): string {
  if (!base || !taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base.slice(0, 56)}_${n}`)) n += 1;
  return `${base.slice(0, 56)}_${n}`;
}

export function newField(): FieldFormValues {
  return { label: '', key: '', type: 'text', required: false, optionsText: '', keyLocked: false };
}

export function toFormValues(template?: AnamnesisTemplate): TemplateFormValues {
  if (!template) return { name: '', fields: [newField()] };
  return {
    name: template.name,
    fields: template.fields.map((field) => ({
      label: field.label,
      key: field.key,
      type: field.type as AnamnesisFieldType,
      required: field.required,
      optionsText: (field.options ?? []).join('\n'),
      keyLocked: true,
      originalKey: field.key,
    })),
  };
}

/** Campo no formato da API (sem `options` para tipos que não as aceitam). */
export function toApiField(field: FieldFormValues): AnamnesisField {
  return {
    key: field.key,
    label: field.label.trim(),
    type: field.type,
    required: field.required,
    ...(typeHasOptions(field.type) && { options: parseOptions(field.optionsText) }),
  };
}

const PROPERTY_LABELS: Record<string, string> = {
  key: 'chave',
  label: 'rótulo',
  type: 'tipo',
  required: 'obrigatório',
  options: 'opções',
};

/** "fields.2.key deve…" → "Campo 3 (chave): deve…" */
export function humanizeTemplateErrors(messages: string[]): string[] {
  return messages.map((message) =>
    message.replace(/^fields\.(\d+)(?:\.(\w+))?\s*/, (_, index: string, property?: string) => {
      const label = property ? PROPERTY_LABELS[property] ?? property : null;
      return `Campo ${Number(index) + 1}${label ? ` (${label})` : ''}: `;
    }),
  );
}
