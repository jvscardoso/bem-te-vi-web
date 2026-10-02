import { useState } from 'react';
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
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined';
import Logout from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import { useAuth } from '@/auth/AuthContext';
import { isPlatformUser } from '@/auth/permissions';
import { BrandMark } from '@/components/BrandMark';
import type { NavSection } from './navigation';

const DRAWER_WIDTH = 260;

interface ShellLayoutProps {
  navigation: NavSection[];
  /** Rótulo exibido abaixo da marca (ex.: "Backoffice"). */
  areaLabel?: string;
}

/** Layout autenticado: menu lateral filtrado por permissão + barra superior. */
export function ShellLayout({ navigation, areaLabel }: ShellLayoutProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  // Telas são carregadas sob demanda: indica o download do código da próxima tela.
  const navigating = useNavigation().state !== 'idle';

  const drawerPaperSx = { '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } } as const;
  const drawer = <SideNav navigation={navigation} areaLabel={areaLabel} onNavigate={() => setMobileOpen(false)} />;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
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
          <Box sx={{ flexGrow: 1 }} />
          <UserMenu />
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isDesktop ? (
          <Drawer variant="permanent" open sx={drawerPaperSx}>
            {drawer}
          </Drawer>
        ) : (
          <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} sx={drawerPaperSx}>
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, sm: 3 } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}

function SideNav({
  navigation,
  areaLabel,
  onNavigate,
}: {
  navigation: NavSection[];
  areaLabel?: string;
  onNavigate: () => void;
}) {
  const { can } = useAuth();

  const sections = navigation
    .map((section) => ({ ...section, items: section.items.filter((item) => can(item.permission)) }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      <Toolbar sx={{ flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 0.25 }}>
        <BrandMark />
        {areaLabel && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 6 }}>
            {areaLabel}
          </Typography>
        )}
      </Toolbar>
      <Divider />
      {sections.map((section, index) => (
        <List
          key={section.title ?? index}
          subheader={section.title ? <ListSubheader disableSticky>{section.title}</ListSubheader> : undefined}
          sx={{ px: 1 }}
        >
          {section.items.map((item) => (
            <ListItemButton
              key={item.path}
              component={NavLink}
              to={item.path}
              onClick={onNavigate}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                '&.active': {
                  bgcolor: 'action.selected',
                  color: 'primary.main',
                  '& .MuiListItemIcon-root': { color: 'primary.main' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      ))}
    </>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (!user) return null;

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
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
        <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.main', color: 'secondary.contrastText', fontSize: 15 }}>
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
