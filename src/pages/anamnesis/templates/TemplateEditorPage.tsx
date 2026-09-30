import { useState } from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormGetValues,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { anamnesisApi, anamnesisKeys, FIELD_TYPE_LABELS, typeHasOptions } from '@/api/anamnesis';
import { ApiError } from '@/api/client';
import type { AnamnesisTemplate } from '@/api/types';
import { useTenantId } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';
import { StatusScreen } from '@/components/StatusScreen';
import { useNotify } from '@/components/notifications/NotificationContext';
import { isApiError } from '@/lib/errors';
import { muiField } from '@/lib/form';
import { TemplatePreviewDialog } from './TemplatePreviewDialog';
import {
  humanizeTemplateErrors,
  keyFromLabel,
  MAX_FIELDS,
  newField,
  templateSchema,
  toApiField,
  toFormValues,
  uniqueKey,
  type TemplateFormValues,
} from './templateForm';

/** Criação (/anamnese/formularios/novo) e edição (/anamnese/formularios/:id). */
export function TemplateEditorPage() {
  const { id } = useParams();
  const tenantId = useTenantId();

  const query = useQuery({
    queryKey: anamnesisKeys.template(tenantId, id ?? ''),
    queryFn: () => anamnesisApi.template(tenantId, id!),
    enabled: !!id,
  });

  if (!id) return <TemplateEditor />;
  if (isApiError(query.error, 404)) {
    return (
      <StatusScreen
        title="Formulário não encontrado"
        action={
          <Button component={RouterLink} to="/anamnese/formularios" variant="contained">
            Voltar para formulários
          </Button>
        }
      />
    );
  }
  if (query.error) return <ErrorMessages error={query.error} />;
  if (!query.data) return <Skeleton variant="rounded" height={320} />;
  return <TemplateEditor template={query.data} />;
}

function TemplateEditor({ template }: { template?: AnamnesisTemplate }) {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [previewOpen, setPreviewOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<TemplateFormValues>({ resolver: zodResolver(templateSchema), defaultValues: toFormValues(template) });

  const { fields, append, remove, move } = useFieldArray({ control, name: 'fields' });
  const values = useWatch({ control, name: 'fields' });

  const save = useMutation({
    mutationFn: (form: TemplateFormValues) => {
      const input = { name: form.name.trim(), fields: form.fields.map(toApiField) };
      return template
        ? anamnesisApi.updateTemplate(tenantId, template.id, input)
        : anamnesisApi.createTemplate(tenantId, input);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(anamnesisKeys.template(tenantId, saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: anamnesisKeys.templates(tenantId) });
      notify(template ? 'Formulário atualizado.' : 'Formulário criado.');
      navigate('/anamnese/formularios');
    },
  });

  const saveError =
    save.error instanceof ApiError ? humanizeTemplateErrors(save.error.messages) : save.error;

  return (
    <Box sx={{ maxWidth: 880 }}>
      <PageHeader
        title={template ? 'Editar formulário' : 'Novo formulário'}
        subtitle={template?.name}
        actions={
          <Button startIcon={<VisibilityOutlined />} onClick={() => setPreviewOpen(true)}>
            Pré-visualizar
          </Button>
        }
      />

      <Stack spacing={3} component="form" onSubmit={handleSubmit((form) => save.mutate(form))} noValidate>
        <SectionCard title="Identificação">
          <TextField
            label="Nome do formulário"
            placeholder="Ex.: Ficha padrão, Avaliação odontológica"
            autoFocus={!template}
            {...muiField(register('name'), errors.name)}
          />
          {template && (
            <Alert severity="info">
              Alterações valem para as próximas fichas. Fichas já preenchidas continuam como foram salvas.
            </Alert>
          )}
        </SectionCard>

        <Box>
          <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              Campos
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {fields.length} de {MAX_FIELDS}
            </Typography>
          </Stack>

          <Stack spacing={2}>
            {fields.map((item, index) => (
              <FieldEditor
                key={item.id}
                index={index}
                count={fields.length}
                control={control}
                register={register}
                getValues={getValues}
                setValue={setValue}
                errors={errors}
                type={values?.[index]?.type ?? item.type}
                keyChanged={!!item.originalKey && values?.[index]?.key !== item.originalKey}
                onMove={(to) => move(index, to)}
                onRemove={() => remove(index)}
              />
            ))}
          </Stack>

          {errors.fields?.root?.message || errors.fields?.message ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errors.fields?.root?.message ?? errors.fields?.message}
            </Alert>
          ) : null}

          <Button
            startIcon={<AddOutlined />}
            onClick={() => append(newField())}
            disabled={fields.length >= MAX_FIELDS}
            sx={{ mt: 2 }}
          >
            Adicionar campo
          </Button>
        </Box>

        <ErrorMessages error={saveError} />

        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button component={RouterLink} to="/anamnese/formularios" disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" loading={save.isPending}>
            {template ? 'Salvar alterações' : 'Criar formulário'}
          </Button>
        </Stack>
      </Stack>

      {previewOpen && (
        <TemplatePreviewDialog
          name={getValues('name')}
          fields={(values ?? []).filter((field) => field.label.trim() && field.key).map(toApiField)}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </Box>
  );
}

interface FieldEditorProps {
  index: number;
  count: number;
  control: Control<TemplateFormValues>;
  register: UseFormRegister<TemplateFormValues>;
  getValues: UseFormGetValues<TemplateFormValues>;
  setValue: UseFormSetValue<TemplateFormValues>;
  errors: FieldErrors<TemplateFormValues>;
  type: TemplateFormValues['fields'][number]['type'];
  keyChanged: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
}

function FieldEditor({
  index,
  count,
  control,
  register,
  getValues,
  setValue,
  errors,
  type,
  keyChanged,
  onMove,
  onRemove,
}: FieldEditorProps) {
  const fieldErrors = errors.fields?.[index];

  // Enquanto a chave não for editada à mão, acompanha o rótulo.
  const syncKeyWithLabel = (label: string) => {
    if (getValues(`fields.${index}.keyLocked`)) return;
    const taken = getValues('fields')
      .filter((_, i) => i !== index)
      .map((field) => field.key);
    setValue(`fields.${index}.key`, uniqueKey(keyFromLabel(label), taken), { shouldValidate: !!fieldErrors?.key });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" color="text.secondary">
            Campo {index + 1}
          </Typography>
          <Stack direction="row">
            <Tooltip title="Mover para cima">
              <span>
                <IconButton size="small" aria-label="Mover para cima" disabled={index === 0} onClick={() => onMove(index - 1)}>
                  <ArrowUpward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Mover para baixo">
              <span>
                <IconButton
                  size="small"
                  aria-label="Mover para baixo"
                  disabled={index === count - 1}
                  onClick={() => onMove(index + 1)}
                >
                  <ArrowDownward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Remover campo">
              <span>
                <IconButton size="small" aria-label="Remover campo" disabled={count === 1} onClick={onRemove}>
                  <DeleteOutlineOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' } }}>
          <TextField
            label="Rótulo"
            placeholder="Ex.: Queixa principal"
            {...muiField(
              register(`fields.${index}.label`, { onChange: (event) => syncKeyWithLabel(event.target.value) }),
              fieldErrors?.label,
            )}
          />
          <Controller
            name={`fields.${index}.type`}
            control={control}
            render={({ field }) => (
              <TextField select label="Tipo" {...field} inputRef={field.ref}>
                {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Box>

        {typeHasOptions(type) && (
          <TextField
            label="Opções"
            placeholder={'Uma opção por linha\nEx.:\nA\nB\nAB\nO'}
            multiline
            minRows={3}
            {...muiField(register(`fields.${index}.optionsText`), fieldErrors?.optionsText)}
            helperText={fieldErrors?.optionsText?.message ?? 'Uma opção por linha (até 50, com até 80 caracteres cada).'}
          />
        )}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
        >
          <Controller
            name={`fields.${index}.key`}
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label="Chave"
                size="small"
                sx={{ maxWidth: { sm: 320 } }}
                {...field}
                inputRef={field.ref}
                onChange={(event) => {
                  setValue(`fields.${index}.keyLocked`, true);
                  field.onChange(event.target.value.toLowerCase());
                }}
                error={!!fieldState.error}
                helperText={
                  fieldState.error?.message ??
                  (keyChanged
                    ? 'Fichas antigas continuam com a chave anterior e aparecerão como campo separado.'
                    : 'Identificador interno, gerado a partir do rótulo.')
                }
                slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: 'monospace' } } }}
              />
            )}
          />
          <Controller
            name={`fields.${index}.required`}
            control={control}
            render={({ field }) => (
              <FormControlLabel
                label="Obrigatório"
                sx={{ pt: { sm: 0.5 } }}
                control={<Switch checked={field.value} onChange={(_, checked) => field.onChange(checked)} />}
              />
            )}
          />
        </Stack>
      </Stack>
    </Paper>
  );
}
