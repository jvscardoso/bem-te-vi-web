import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate, useNavigation } from 'react-router';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Switch,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import Logout from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { useAuth } from '@/auth/AuthContext';
import { isPlatformUser } from '@/auth/permissions';
import { BrandMark } from '@/components/BrandMark';
import { useColorMode } from '@/theme/colorMode';
import { ClosureBanner } from '@/pages/settings/closure/ClosureBanner';
import type { NavSection } from './navigation';

const DRAWER_WIDTH = 260;
const COLLAPSED_WIDTH = 96;

// Preferência por navegador, como o modo noturno: não precisa ir para a URL nem para a API.
const COLLAPSED_KEY = 'btv.sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // Armazenamento indisponível: vale só nesta sessão.
    }
  };
  return [collapsed, toggle];
}

interface ShellLayoutProps {
  navigation: NavSection[];
  /** Rótulo exibido abaixo da marca (ex.: "Backoffice"). */
  areaLabel?: string;
  /** Busca da barra superior (só a área da clínica tem). */
  search?: ReactNode;
}

/** Layout autenticado: menu lateral filtrado por permissão + barra superior. */
export function ShellLayout({ navigation, areaLabel, search }: ShellLayoutProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedPreference, toggleCollapsed] = useSidebarCollapsed();
  // Telas são carregadas sob demanda: indica o download do código da próxima tela.
  const navigating = useNavigation().state !== 'idle';

  // No celular o menu é temporário e sempre abre completo.
  const collapsed = isDesktop && collapsedPreference;
  const navWidth = collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;
  const widthTransition = theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.shorter,
  });

  const drawerPaperSx = {
    '& .MuiDrawer-paper': { width: navWidth, boxSizing: 'border-box', overflowX: 'hidden', transition: widthTransition },
  } as const;
  const drawer = (
    <SideNav
      navigation={navigation}
      areaLabel={areaLabel}
      collapsed={collapsed}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${navWidth}px)` },
          ml: { md: `${navWidth}px` },
          transition: widthTransition,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        {navigating && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3 }} aria-label="Carregando" />
        )}
        <Toolbar>
          {!isDesktop && (
            <>
              <IconButton edge="start" aria-label="Abrir menu" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
              <BrandMark size={32} />
            </>
          )}
          {/* No desktop a busca ocupa a esquerda da barra; no celular, fica junto do usuário. */}
          {isDesktop && search}
          <Box sx={{ flexGrow: 1 }} />
          {!isDesktop && search}
          <UserMenu />
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        aria-label="Menu principal"
        sx={{ width: { md: navWidth }, flexShrink: { md: 0 }, transition: widthTransition }}
      >
        {isDesktop ? (
          <>
            <Drawer variant="permanent" open sx={drawerPaperSx}>
              {drawer}
            </Drawer>
            {/* Fora do Drawer: o papel corta o que passa da borda (overflowX hidden durante a animação). */}
            <Tooltip title={collapsed ? 'Expandir menu' : 'Recolher menu'} placement="right">
              <IconButton
                size="small"
                aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
                aria-expanded={!collapsed}
                onClick={toggleCollapsed}
                sx={{
                  position: 'fixed',
                  // Centralizado na borda, na altura da marca (meio da Toolbar de 64px).
                  top: 32 - 13,
                  left: navWidth - 13,
                  zIndex: theme.zIndex.drawer + 1,
                  width: 26,
                  height: 26,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  boxShadow: 1,
                  transition: theme.transitions.create('left', {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.shorter,
                  }),
                  '&:hover': { bgcolor: 'background.paper', color: 'primary.main' },
                }}
              >
                {collapsed ? <ChevronRight fontSize="small" /> : <ChevronLeft fontSize="small" />}
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} sx={drawerPaperSx}>
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, sm: 3 } }}>
        <Toolbar />
        <ClosureBanner />
        <Outlet />
      </Box>
    </Box>
  );
}

function SideNav({
  navigation,
  areaLabel,
  collapsed,
  onNavigate,
}: {
  navigation: NavSection[];
  areaLabel?: string;
  /** Recolhido: só o ícone, com o rótulo curto embaixo. */
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const { can } = useAuth();

  const sections = navigation
    .map((section) => ({ ...section, items: section.items.filter((item) => can(item.permission)) }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      <Toolbar
        sx={{
          flexDirection: 'column',
          alignItems: collapsed ? 'center' : 'flex-start',
          justifyContent: 'center',
          gap: 0.25,
        }}
      >
        <BrandMark hideName={collapsed} />
        {areaLabel && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: collapsed ? 0 : 6 }}>
            {areaLabel}
          </Typography>
        )}
      </Toolbar>
      <Divider />
      {sections.map((section, index) => (
        <List
          key={section.title ?? index}
          subheader={
            !section.title ? undefined : collapsed ? (
              // O título da seção não cabe: a divisória mantém a separação dos grupos.
              <Divider sx={{ mx: 1, mb: 1 }} />
            ) : (
              <ListSubheader disableSticky>{section.title}</ListSubheader>
            )
          }
          sx={{ px: collapsed ? 0.75 : 1 }}
        >
          {section.items.map((item) => (
            <Tooltip
              key={item.path}
              // Só quando o rótulo curto esconde parte do nome; nos demais o texto já está visível.
              title={collapsed && item.shortLabel ? item.label : ''}
              placement="right"
            >
              <ListItemButton
                component={NavLink}
                to={item.path}
                onClick={onNavigate}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  ...(collapsed && { flexDirection: 'column', gap: 0.5, px: 0.5, py: 1, textAlign: 'center' }),
                  '&.active': {
                    // No escuro, o cinza de seleção apaga a cor da clínica: usa um fundo tingido com ela.
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.primary.main, 0.14)
                        : theme.palette.action.selected,
                    color: 'primary.main',
                    '& .MuiListItemIcon-root': { color: 'primary.main' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, justifyContent: 'center' }}>{item.icon}</ListItemIcon>
                {collapsed ? (
                  <ListItemText
                    primary={item.shortLabel ?? item.label}
                    sx={{ my: 0 }}
                    slotProps={{ primary: { variant: 'caption', sx: { display: 'block', lineHeight: 1.2 } } }}
                  />
                ) : (
                  <ListItemText primary={item.label} />
                )}
              </ListItemButton>
            </Tooltip>
          ))}
        </List>
      ))}
    </>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const { mode, setMode } = useColorMode();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (!user) return null;

  // Iniciais só de palavras que começam com letra e não são títulos ("Dra.", "(teste)").
  const initials = user.name
    .split(/\s+/)
    .filter((part) => /^\p{L}/u.test(part) && !part.endsWith('.'))
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <>
      <Box
        component="button"
        type="button"
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-label="Menu do usuário"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          border: 0,
          bgcolor: 'transparent',
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
          p: 0.5,
          borderRadius: 2,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {user.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user.role.name}
          </Typography>
        </Box>
        <Avatar
          sx={{ width: 36, height: 36, bgcolor: 'secondary.main', color: 'secondary.contrastText', fontSize: 15 }}
        >
          {initials}
        </Avatar>
      </Box>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {user.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user.email}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            navigate(isPlatformUser(user.permissions) ? '/plataforma/minha-conta' : '/minha-conta');
          }}
        >
          <ListItemIcon>
            <AccountCircleOutlined fontSize="small" />
          </ListItemIcon>
          Minha conta
        </MenuItem>
        {/* Não fecha o menu: dá para ver o tema trocar e voltar atrás. */}
        <MenuItem
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          role="menuitemcheckbox"
          aria-checked={mode === 'dark'}
        >
          <ListItemIcon>
            <DarkModeOutlined fontSize="small" />
          </ListItemIcon>
          <Box component="span" sx={{ flexGrow: 1, mr: 1 }}>
            Modo noturno
          </Box>
          <Switch
            size="small"
            edge="end"
            checked={mode === 'dark'}
            tabIndex={-1}
            slotProps={{ input: { 'aria-hidden': true } }}
            sx={{ pointerEvents: 'none' }}
          />
        </MenuItem>
        <MenuItem onClick={logout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Sair
        </MenuItem>
      </Menu>
    </>
  );
}
