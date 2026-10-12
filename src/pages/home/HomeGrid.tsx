import { useState, type DragEvent } from 'react';
import { Box, IconButton, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Close from '@mui/icons-material/Close';
import DragIndicator from '@mui/icons-material/DragIndicator';
import type { LayoutWidget, LayoutWidgetWidth } from '@/api/configs';
import { useAuth } from '@/auth/AuthContext';
import { WIDTH_LABELS, WIDTH_SPANS } from './layout';
import { HOME_WIDGETS } from './widgets';

interface HomeGridProps {
  widgets: LayoutWidget[];
  /** Modo de edição (Configurações › Tela inicial): barra em cada bloco e prévia inerte. */
  editing?: boolean;
  onChange?: (widgets: LayoutWidget[]) => void;
}

/** Blocos da tela inicial numa grade de 12 colunas, na ordem do layout. */
export function HomeGrid({ widgets, editing = false, onChange = () => {} }: HomeGridProps) {
  const { can } = useAuth();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Fora da edição, cada pessoa só vê os blocos das suas permissões; os outros se reorganizam.
  const visible = editing ? widgets : widgets.filter((widget) => can(HOME_WIDGETS[widget.type].permission));

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...widgets];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const update = (index: number, changes: Partial<LayoutWidget>) =>
    onChange(widgets.map((widget, current) => (current === index ? { ...widget, ...changes } : widget)));
  const remove = (index: number) => onChange(widgets.filter((_, current) => current !== index));

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', alignItems: 'stretch' }}>
      {visible.map((widget, index) => {
        const definition = HOME_WIDGETS[widget.type];
        const span = WIDTH_SPANS[widget.width];
        return (
          <Box
            key={widget.id}
            sx={{
              gridColumn: { xs: `span ${span.xs}`, md: `span ${span.md}`, lg: `span ${span.lg}` },
              minWidth: 0,
              // Os blocos se ajustam à própria largura (container queries), não à da tela.
              containerType: 'inline-size',
            }}
            {...(editing && {
              draggable: true,
              onDragStart: (event: DragEvent) => {
                setDragIndex(index);
                event.dataTransfer.effectAllowed = 'move';
                // Sem dado o Firefox não inicia o arraste.
                event.dataTransfer.setData('text/plain', widget.id);
              },
              onDragOver: (event: DragEvent) => {
                if (dragIndex === null) return;
                event.preventDefault();
                setOverIndex(index);
              },
              onDrop: (event: DragEvent) => {
                event.preventDefault();
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              },
              onDragEnd: () => {
                setDragIndex(null);
                setOverIndex(null);
              },
            })}
          >
            {editing ? (
              <Paper
                variant="outlined"
                sx={{
                  height: '100%',
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  borderColor: overIndex === index && dragIndex !== index ? 'primary.main' : 'divider',
                  opacity: dragIndex === index ? 0.4 : 1,
                  overflow: 'hidden',
                }}
              >
                <Stack
                  direction="row"
                  sx={{ alignItems: 'center', gap: 0.5, px: 1, py: 0.5, bgcolor: 'action.hover', minWidth: 0 }}
                >
                  <DragIndicator fontSize="small" sx={{ color: 'text.secondary', cursor: 'grab' }} aria-hidden />
                  <Typography variant="subtitle2" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                    {definition.title}
                  </Typography>
                  <TextField
                    select
                    size="small"
                    value={widget.width}
                    onChange={(event) => update(index, { width: event.target.value as LayoutWidgetWidth })}
                    fullWidth={false}
                    sx={{ width: 104, flexShrink: 0 }}
                    slotProps={{ htmlInput: { 'aria-label': `Largura de ${definition.title}` } }}
                  >
                    {definition.widths.map((width) => (
                      <MenuItem key={width} value={width}>
                        {WIDTH_LABELS[width]}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Tooltip title="Mover para antes">
                    <span>
                      <IconButton
                        size="small"
                        aria-label={`Mover ${definition.title} para antes`}
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowBack fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Mover para depois">
                    <span>
                      <IconButton
                        size="small"
                        aria-label={`Mover ${definition.title} para depois`}
                        disabled={index === widgets.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowForward fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Remover">
                    <IconButton size="small" aria-label={`Remover ${definition.title}`} onClick={() => remove(index)}>
                      <Close fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                {/* Prévia do conteúdo: inerte (sem clique nem foco) e cortada, para arrumar a tela com facilidade. */}
                <Box
                  inert
                  sx={{
                    position: 'relative',
                    maxHeight: 260,
                    overflow: 'hidden',
                    opacity: 0.6,
                    p: 1,
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 48,
                      background: (theme) => `linear-gradient(transparent, ${theme.palette.background.paper})`,
                    },
                  }}
                >
                  {can(definition.permission) ? (
                    definition.render()
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      Você não tem permissão para ver este bloco. Ele aparece para quem tem.
                    </Typography>
                  )}
                </Box>
              </Paper>
            ) : (
              definition.render()
            )}
          </Box>
        );
      })}
    </Box>
  );
}
