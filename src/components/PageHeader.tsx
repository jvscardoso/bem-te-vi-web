import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { Box, Breadcrumbs, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import { useGoBack } from '@/lib/useGoBack';
import type { Crumb } from './breadcrumbs';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Telas acima desta, da mais alta para a mais próxima; o título entra sozinho como último item. */
  breadcrumbs?: Crumb[];
  /**
   * Mostra o botão voltar. Ele volta à página anterior do histórico; quando não há (a tela foi
   * aberta direto pela URL ou por um link de email), vai para este caminho.
   */
  backTo?: string;
}

export function PageHeader({ title, subtitle, actions, breadcrumbs, backTo }: PageHeaderProps) {
  const goBack = useGoBack();

  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          aria-label="Você está em"
          maxItems={4}
          itemsBeforeCollapse={1}
          itemsAfterCollapse={2}
          sx={{ mb: 0.5, typography: 'body2', '& .MuiBreadcrumbs-li': { minWidth: 0 } }}
        >
          {breadcrumbs.map((crumb) => (
            <Link key={crumb.to} component={RouterLink} to={crumb.to} underline="hover" color="text.secondary" noWrap>
              {crumb.label}
            </Link>
          ))}
          <Typography variant="body2" color="text.primary" noWrap aria-current="page">
            {title}
          </Typography>
        </Breadcrumbs>
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } }}
      >
        {/* Grade: a seta fica na linha do título, centralizada nela; o subtítulo vai embaixo, alinhado
            ao texto do título (e não à seta). */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: backTo ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
            columnGap: 0.5,
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          {backTo && (
            <Tooltip title="Voltar">
              <IconButton
                aria-label="Voltar"
                onClick={() => goBack(backTo)}
                // Margens negativas: o botão não aumenta a altura da linha nem empurra o título.
                sx={{ ml: -1, my: -1 }}
              >
                <ChevronLeft />
              </IconButton>
            </Tooltip>
          )}
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography color="text.secondary" component="div" sx={{ gridColumn: backTo ? 2 : 1 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Stack direction="row" spacing={1}>{actions}</Stack>}
      </Stack>
    </Box>
  );
}
