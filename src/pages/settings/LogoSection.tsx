import { useEffect, useState, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Avatar, Box, Button, Collapse, Link, Stack, TextField, Typography } from '@mui/material';
import UploadOutlined from '@mui/icons-material/UploadOutlined';
import { tenantKeys, tenantsApi } from '@/api/tenants';
import type { Tenant, TenantBranding } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorMessages } from '@/components/ErrorMessages';
import { SectionCard } from '@/components/SectionCard';
import { useNotify } from '@/components/notifications/NotificationContext';
import { applyBrandingToCache } from '@/theme/brandingCache';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 1024 * 1024;

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/** Logo da clínica: envio de arquivo (principal) ou URL externa https (alternativa). */
export function LogoSection({ tenant }: { tenant: Tenant }) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const currentLogo = tenant.branding?.logoUrl ?? null;
  const name = tenant.branding?.tradeName || tenant.name;

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [useUrl, setUseUrl] = useState(false);
  const [url, setUrl] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Libera a URL temporária da pré-visualização quando ela muda ou a tela fecha.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // Atualiza a tela de configurações e o tema do app (logo no menu e no login) na hora.
  const applySaved = (saved: TenantBranding, message: string) => {
    queryClient.setQueryData(tenantKeys.detail(tenant.id), (old?: Tenant) => (old ? { ...old, branding: saved } : old));
    applyBrandingToCache(queryClient, tenant.name, { logoUrl: saved.logoUrl });
    notify(message);
  };

  const upload = useMutation({
    mutationFn: (selected: File) => tenantsApi.uploadLogo(tenant.id, selected),
    onSuccess: (saved) => applySaved(saved, 'Logo atualizado.'),
  });
  const remove = useMutation({
    mutationFn: () => tenantsApi.deleteLogo(tenant.id),
    onSuccess: (saved) => {
      setConfirmRemove(false);
      applySaved(saved, 'Logo removido.');
    },
  });
  const saveUrl = useMutation({
    // Definir a URL descarta o logo enviado (a API passa a usar o endereço externo).
    mutationFn: (value: string) => tenantsApi.updateBranding(tenant.id, { logoUrl: value }),
    onSuccess: (saved) => applySaved(saved, 'Logo atualizado.'),
  });

  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!selected) return;
    upload.reset();
    // Validação prévia (a API confere de novo pelo conteúdo do arquivo).
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setFile(null);
      setPreview(null);
      setFileError('Use uma imagem PNG, JPEG ou WebP. SVG não é aceito.');
      return;
    }
    if (selected.size > MAX_BYTES) {
      setFile(null);
      setPreview(null);
      setFileError(`A imagem tem ${(selected.size / MAX_BYTES).toFixed(1)} MB; o limite é 1 MB.`);
      return;
    }
    setFileError(null);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const busy = upload.isPending || remove.isPending || saveUrl.isPending;
  const urlValid = isHttpsUrl(url.trim());

  return (
    <SectionCard title="Logo" description="Aparece no login, no menu e nas telas públicas da clínica.">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ alignItems: { sm: 'center' } }}>
        <Avatar
          src={preview ?? currentLogo ?? undefined}
          alt={name}
          variant="rounded"
          sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: 32, fontWeight: 700 }}
        >
          {name.charAt(0).toUpperCase()}
        </Avatar>

        <Stack spacing={1} sx={{ flexGrow: 1 }}>
          {file ? (
            <>
              <Typography variant="body2">
                <strong>{file.name}</strong> · {(file.size / 1024).toFixed(0)} KB · pré-visualização ao lado
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={() => upload.mutate(file)} loading={upload.isPending}>
                  Enviar logo
                </Button>
                <Button
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    upload.reset();
                  }}
                  disabled={busy}
                >
                  Cancelar
                </Button>
              </Stack>
            </>
          ) : (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Button component="label" variant="outlined" startIcon={<UploadOutlined />} disabled={busy}>
                {currentLogo ? 'Trocar imagem' : 'Enviar imagem'}
                <input hidden type="file" accept={ACCEPTED_TYPES.join(',')} onChange={pickFile} />
              </Button>
              {currentLogo && (
                <Button color="error" onClick={() => setConfirmRemove(true)} disabled={busy}>
                  Remover logo
                </Button>
              )}
            </Stack>
          )}
          <Typography variant="caption" color="text.secondary">
            PNG, JPEG ou WebP, até 1 MB. De preferência quadrada.
          </Typography>
        </Stack>
      </Stack>

      {fileError && <Alert severity="error">{fileError}</Alert>}
      <ErrorMessages error={upload.error ?? saveUrl.error} />

      <Box>
        <Link component="button" type="button" variant="body2" onClick={() => setUseUrl((value) => !value)}>
          {useUrl ? 'Fechar' : 'Usar um endereço (URL) em vez de arquivo'}
        </Link>
        <Collapse in={useUrl}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2, alignItems: { sm: 'flex-start' } }}>
            <TextField
              size="small"
              label="Endereço do logo (https)"
              placeholder="https://suaclinica.com.br/logo.png"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              error={url.trim() !== '' && !urlValid}
              helperText={
                url.trim() !== '' && !urlValid
                  ? 'Informe um endereço https válido'
                  : 'Substitui a imagem enviada, se houver.'
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button
              variant="outlined"
              onClick={() => saveUrl.mutate(url.trim())}
              disabled={!urlValid || busy}
              loading={saveUrl.isPending}
            >
              Salvar endereço
            </Button>
          </Stack>
        </Collapse>
      </Box>

      <ConfirmDialog
        open={confirmRemove}
        title="Remover logo?"
        description="A clínica volta a usar a inicial do nome no lugar do logo."
        confirmLabel="Remover"
        confirmColor="error"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate()}
        onClose={() => {
          setConfirmRemove(false);
          remove.reset();
        }}
      />
    </SectionCard>
  );
}
