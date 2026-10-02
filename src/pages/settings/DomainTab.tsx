import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopy from '@mui/icons-material/ContentCopy';
import VerifiedOutlined from '@mui/icons-material/VerifiedOutlined';
import { tenantKeys, tenantsApi } from '@/api/tenants';
import type { DomainVerification, Tenant } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorMessages } from '@/components/ErrorMessages';
import { SectionCard } from '@/components/SectionCard';
import { useNotify } from '@/components/notifications/NotificationContext';
import { formatDateTime } from '@/lib/format';
import { muiField } from '@/lib/form';

const FQDN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function DomainTab({ tenant }: { tenant: Tenant }) {
  return (
    <Stack spacing={3}>
      <DomainForm tenant={tenant} />
      {tenant.customDomain && <DomainVerificationCard tenant={tenant} />}
    </Stack>
  );
}

function DomainForm({ tenant }: { tenant: Tenant }) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<{ customDomain: string }>({ defaultValues: { customDomain: tenant.customDomain ?? '' } });

  const save = useMutation({
    mutationFn: (customDomain: string | null) => tenantsApi.update(tenant.id, { customDomain }),
    onSuccess: (saved) => {
      queryClient.setQueryData(tenantKeys.detail(tenant.id), (old?: Tenant) => ({ ...old, ...saved }));
      // Domínio novo = novo desafio DNS.
      void queryClient.invalidateQueries({ queryKey: tenantKeys.domain(tenant.id) });
      setConfirmRemove(false);
      notify(saved.customDomain ? 'Domínio salvo. Configure o DNS para verificá-lo.' : 'Domínio próprio removido.');
    },
  });

  return (
    <SectionCard
      title="Domínio próprio"
      description="Opcional. Permite acessar o sistema por um endereço da clínica (ex.: agenda.suaclinica.com.br). A marca só é aplicada nele depois da verificação por DNS."
    >
      <Stack
        spacing={2}
        component="form"
        onSubmit={handleSubmit(({ customDomain }) => save.mutate(customDomain.trim().toLowerCase() || null))}
        noValidate
      >
        <TextField
          label="Domínio"
          placeholder="agenda.suaclinica.com.br"
          {...muiField(
            register('customDomain', {
              setValueAs: (value: string) => value.trim().toLowerCase(),
              validate: (value) => !value || FQDN.test(value) || 'Informe um domínio válido (sem http:// e sem barras)',
            }),
            errors.customDomain,
          )}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { spellCheck: false } }}
        />
        {isDirty && tenant.customDomain && (
          <Alert severity="warning">Trocar o domínio gera um novo registro DNS e exige verificar de novo.</Alert>
        )}
        {!confirmRemove && <ErrorMessages error={save.error} />}
        <Stack direction="row" spacing={1}>
          <Button type="submit" variant="contained" disabled={!isDirty} loading={save.isPending && !confirmRemove}>
            Salvar domínio
          </Button>
          {tenant.customDomain && (
            <Button color="error" onClick={() => setConfirmRemove(true)} disabled={save.isPending}>
              Remover domínio
            </Button>
          )}
        </Stack>
      </Stack>

      <ConfirmDialog
        open={confirmRemove}
        title="Remover domínio próprio?"
        description={`O endereço ${tenant.customDomain} deixará de abrir o sistema. A clínica continua acessível pelo subdomínio.`}
        confirmLabel="Remover"
        confirmColor="error"
        loading={save.isPending}
        error={save.error}
        onConfirm={() => save.mutate(null)}
        onClose={() => {
          setConfirmRemove(false);
          save.reset();
        }}
      />
    </SectionCard>
  );
}

function DomainVerificationCard({ tenant }: { tenant: Tenant }) {
  const queryClient = useQueryClient();
  const notify = useNotify();

  const query = useQuery({
    queryKey: tenantKeys.domain(tenant.id),
    queryFn: () => tenantsApi.domain(tenant.id),
  });

  const verify = useMutation({
    mutationFn: () => tenantsApi.verifyDomain(tenant.id),
    onSuccess: (result) => {
      queryClient.setQueryData(tenantKeys.domain(tenant.id), result);
      if (result.verified) {
        void queryClient.invalidateQueries({ queryKey: tenantKeys.detail(tenant.id) });
        notify('Domínio verificado!');
      } else {
        // Não é erro: o DNS pode levar de minutos a horas para propagar.
        notify('Registro ainda não encontrado. O DNS pode levar algumas horas para propagar; tente mais tarde.', 'info');
      }
    },
  });

  if (query.error) return <ErrorMessages error={query.error} />;
  if (!query.data) return <Skeleton variant="rounded" height={200} />;

  const domain = query.data;

  return (
    <SectionCard title="Verificação">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography sx={{ fontWeight: 600 }}>{domain.domain}</Typography>
        {domain.verified ? (
          <Chip size="small" color="success" icon={<VerifiedOutlined />} label="Verificado" />
        ) : (
          <Chip size="small" color="warning" variant="outlined" label="Aguardando verificação" />
        )}
      </Stack>

      {domain.verified ? (
        <Typography variant="body2" color="text.secondary">
          Verificado em {formatDateTime(domain.verifiedAt)}. A marca da clínica já é aplicada neste endereço.
        </Typography>
      ) : (
        <>
          <Typography variant="body2">
            No painel do seu provedor de domínio (Registro.br, Cloudflare, GoDaddy…), crie o registro abaixo e depois
            clique em <strong>Verificar agora</strong>.
          </Typography>
          <DnsRecord record={domain.record} />
          <Box>
            <Button variant="contained" onClick={() => verify.mutate()} loading={verify.isPending}>
              Verificar agora
            </Button>
          </Box>
          <ErrorMessages error={verify.error} />
        </>
      )}
    </SectionCard>
  );
}

function DnsRecord({ record }: { record: DomainVerification['record'] }) {
  const notify = useNotify();

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      notify('Copiado.');
    } catch {
      notify('Não foi possível copiar. Selecione o texto e copie manualmente.', 'warning');
    }
  };

  const rows = [
    { label: 'Tipo', value: record.type, copyable: false },
    { label: 'Nome / Host', value: record.name, copyable: true },
    { label: 'Valor', value: record.value, copyable: true },
  ];

  return (
    <Table size="small" sx={{ '& td': { borderColor: 'divider' } }}>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell sx={{ width: 140, color: 'text.secondary', whiteSpace: 'nowrap' }}>{row.label}</TableCell>
            <TableCell sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{row.value}</TableCell>
            <TableCell align="right" sx={{ width: 48 }}>
              {row.copyable && (
                <Tooltip title="Copiar">
                  <IconButton size="small" aria-label={`Copiar ${row.label}`} onClick={() => copy(row.value)}>
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
