import { useForm } from 'react-hook-form';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import type { AnamnesisField } from '@/api/types';
import { AnamnesisFieldInput } from '../AnamnesisFieldInput';
import { emptyAnswers, type FormAnswers } from '../answers';

interface TemplatePreviewDialogProps {
  name: string;
  fields: AnamnesisField[];
  onClose: () => void;
}

/** Mostra o formulário como a equipe o verá ao preencher (sem salvar nada). */
export function TemplatePreviewDialog({ name, fields, onClose }: TemplatePreviewDialogProps) {
  const { control, handleSubmit } = useForm<{ answers: FormAnswers }>({
    defaultValues: { answers: emptyAnswers(fields) },
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>{name.trim() || 'Pré-visualização'}</DialogTitle>
      <DialogContent dividers>
        {fields.length === 0 ? (
          <Alert severity="info">Adicione campos com rótulo para ver a pré-visualização.</Alert>
        ) : (
          <Stack
            spacing={2.5}
            component="form"
            id="template-preview"
            onSubmit={handleSubmit(() => undefined)}
            noValidate
          >
            {fields.map((field) => (
              <AnamnesisFieldInput key={field.key} field={field} control={control} />
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {fields.length > 0 && (
          <Button type="submit" form="template-preview">
            Testar validação
          </Button>
        )}
        <Button variant="contained" onClick={onClose}>
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
