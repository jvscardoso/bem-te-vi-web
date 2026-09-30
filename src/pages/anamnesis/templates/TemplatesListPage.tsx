import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import { anamnesisApi, anamnesisKeys } from '@/api/anamnesis';
import type { AnamnesisTemplate } from '@/api/types';
import { useTenantId } from '@/auth/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/notifications/NotificationContext';
import { isApiError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

export function TemplatesListPage() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [toDelete, setToDelete] = useState<AnamnesisTemplate | null>(null);

  const query = useQuery({
    queryKey: anamnesisKeys.templates(tenantId),
    queryFn: () => anamnesisApi.templates(tenantId),
  });

  const remove = useMutation({
    mutationFn: (id: string) => anamnesisApi.deleteTemplate(tenantId, id),
    onSuccess: () => {
      setToDelete(null);
      notify('Formulário excluído.');
      return queryClient.invalidateQueries({ queryKey: anamnesisKeys.templates(tenantId) });
    },
  });

  const newButton = (
    <Button component={RouterLink} to="/anamnese/formularios/novo" variant="contained" startIcon={<AddOutlined />}>
      Novo formulário
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Formulários de anamnese"
        subtitle="Modelos de ficha que a equipe preenche nos pacientes."
        actions={newButton}
      />

      <Paper variant="outlined">
        <Box sx={{ height: 4 }}>{query.isFetching && <LinearProgress />}</Box>
        {query.error ? (
          <Box sx={{ p: 2 }}>
            <ErrorMessages error={query.error} />
          </Box>
        ) : query.data?.length === 0 ? (
          <EmptyState
            title="Nenhum formulário cadastrado"
            description="Crie o primeiro formulário para começar a registrar anamneses."
            action={newButton}
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell align="right">Campos</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Atualizado em</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data?.map((template) => (
                  <TableRow key={template.id} hover>
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`/anamnese/formularios/${template.id}`}
                        underline="hover"
                        sx={{ fontWeight: 500 }}
                      >
                        {template.name}
                      </Link>
                    </TableCell>
                    <TableCell align="right">{template.fields.length}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, whiteSpace: 'nowrap' }}>
                      {formatDateTime(template.updatedAt)}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Excluir">
                        <IconButton aria-label={`Excluir ${template.name}`} onClick={() => setToDelete(template)}>
                          <DeleteOutlineOutlined />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir formulário?"
        description={
          <>
            O formulário <strong>{toDelete?.name}</strong> será apagado definitivamente. Formulários que já foram
            usados em alguma ficha não podem ser excluídos.
          </>
        }
        confirmLabel="Excluir"
        confirmColor="error"
        loading={remove.isPending}
        error={
          isApiError(remove.error, 409)
            ? 'Este formulário já foi usado em fichas de pacientes e não pode ser excluído.'
            : remove.error
        }
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onClose={() => {
          setToDelete(null);
          remove.reset();
        }}
      />
    </>
  );
}
