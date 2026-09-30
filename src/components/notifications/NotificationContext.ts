import { createContext, useContext } from 'react';
import type { AlertColor } from '@mui/material';

export type Notify = (message: string, severity?: AlertColor) => void;

export const NotificationContext = createContext<Notify | null>(null);

/** Exibe um aviso rápido (snackbar) no canto da tela. */
export function useNotify(): Notify {
  const notify = useContext(NotificationContext);
  if (!notify) throw new Error('useNotify precisa estar dentro de <NotificationProvider>');
  return notify;
}
