import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import { Alert, Box, Button, ListItemText, Menu, MenuItem, Paper, Skeleton, Stack, Typography } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { configsApi, configsKeys, EMPTY_CONFIGS, type LayoutWidget, type ScreenLayout, type TenantConfigs } from '@/api/configs';
import { useTenantId } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { useNotify } from '@/components/notifications/NotificationContext';
import { isApiError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { HomeGrid } from '@/pages/home/HomeGrid';
import { DEFAULT_WIDGETS, newWidgetId, sameWidgets } from '@/pages/home/layout';
import { useHomeLayout } from '@/pages/home/useHomeLayout';
import { HOME_WIDGETS } from '@/pages/home/widgets';

/** Configurações › Tela inicial: blocos, ordem e larguras do Início, iguais para toda a equipe. */
export function HomeLayoutTab() {
  const { query, saved, widgets } = useHomeLayout();

  if (query.error) return <ErrorMessages error={query.error} />;
  if (query.isPending) return <Skeleton variant="rounded" height={320} />;
  // A chave reinicia o rascunho com o layout salvo depois de cada gravação.
  return <HomeLayoutEditor key={saved?.updatedAt ?? 'padrao'} saved={saved} savedWidgets={widgets} />;
}

function HomeLayoutEditor({ saved, savedWidgets }: { saved: ScreenLayout | null; savedWidgets: LayoutWidget[] }) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [draft, setDraft] = useState(savedWidgets);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);

  const save = useMutation({
    mutationFn: async (widgets: LayoutWidget[]): Promise<ScreenLayout | null> => {
      // Igual ao padrão: apaga o salvo, para a clínica acompanhar o padrão se ele mudar no futuro.
      if (sameWidgets(widgets, DEFAULT_WIDGETS)) {
        await configsApi.resetLayout(tenantId, 'home');
        return null;
      }
      return configsApi.saveLayout(tenantId, 'home', { version: 1, widgets });
    },
    onSuccess: (layout) => {
      queryClient.setQueryData<TenantConfigs>(configsKeys.detail(tenantId), (old) => ({
        ...(old ?? EMPTY_CONFIGS),
        layouts: { ...(old ?? EMPTY_CONFIGS).layouts, home: layout },
      }));
      notify('Tela inicial atualizada para toda a equipe.');
    },
  });

  // Mudar o rascunho apaga o erro do último "Salvar", que já não vale para o novo conteúdo.
  const change = (next: LayoutWidget[]) => {
    save.reset();
    setDraft(next);
  };

  const dirty = !sameWidgets(draft, savedWidgets);
  const available = Object.entries(HOME_WIDGETS).filter(([type]) => !draft.some((widget) => widget.type === type));

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, justifyContent: 'space-between' }}>
          <Box sx={{ maxWidth: 560 }}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              Tela inicial
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Escolha os blocos do Início, a ordem (arraste ou use as setas) e a largura de cada um. Vale para toda a
              equipe; cada pessoa vê só os blocos que as permissões dela liberam.
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              {saved
                ? `Alterado em ${formatDateTime(saved.updatedAt)}${saved.updatedBy ? ` por ${saved.updatedBy.name}` : ''}.`
                : 'Usando o layout padrão.'}
            </Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Button component={RouterLink} to="/inicio">
              Ver o Início
            </Button>
            <Button
              startIcon={<AddOutlined />}
              disabled={available.length === 0}
              onClick={(event) => setAddAnchor(event.currentTarget)}
            >
              Adicionar bloco
            </Button>
            <Button onClick={() => change(DEFAULT_WIDGETS)} disabled={sameWidgets(draft, DEFAULT_WIDGETS)}>
              Restaurar padrão
            </Button>
            <Button onClick={() => change(savedWidgets)} disabled={!dirty || save.isPending}>
              Descartar alterações
            </Button>
            <Button variant="contained" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate(draft)}>
              Salvar
            </Button>
          </Stack>
        </Stack>
        {save.error && (
          <Box sx={{ mt: 2 }}>
            {isApiError(save.error, 404) ? (
              <Alert severity="warning">
                Salvar a tela inicial ainda não está disponível: a API precisa ser atualizada. As mudanças não foram
                salvas.
              </Alert>
            ) : (
              <ErrorMessages error={save.error} />
            )}
          </Box>
        )}
      </Paper>

      <Menu anchorEl={addAnchor} open={addAnchor !== null} onClose={() => setAddAnchor(null)}>
        {available.map(([type, definition]) => (
          <MenuItem
            key={type}
            onClick={() => {
              setAddAnchor(null);
              change([...draft, { id: newWidgetId(), type, width: definition.defaultWidth }]);
            }}
            sx={{ maxWidth: 360, whiteSpace: 'normal' }}
          >
            <ListItemText primary={definition.title} secondary={definition.description} />
          </MenuItem>
        ))}
      </Menu>

      {draft.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, borderStyle: 'dashed' }}>
          <Typography color="text.secondary">
            Nenhum bloco: o Início vai mostrar só a saudação. Use "Adicionar bloco" para montar a tela.
          </Typography>
        </Paper>
      ) : (
        <HomeGrid widgets={draft} editing onChange={change} />
      )}
    </Stack>
  );
}
