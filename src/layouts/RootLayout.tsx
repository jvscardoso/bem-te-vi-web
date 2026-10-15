import { Outlet } from 'react-router';
import { NavigationProgress } from '@/components/NavigationProgress';

/** Raiz do roteador: tudo o que vale para qualquer tela (por enquanto, a barra de navegação). */
export function RootLayout() {
  return (
    <>
      <NavigationProgress />
      <Outlet />
    </>
  );
}
