import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Snackbar, type AlertColor } from '@mui/material';
import { NotificationContext } from './NotificationContext';

interface Notification {
  key: number;
  message: string;
  severity: AlertColor;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Notification | null>(null);
  const [open, setOpen] = useState(false);

  const notify = useCallback((message: string, severity: AlertColor = 'success') => {
    setCurrent({ key: Date.now(), message, severity });
    setOpen(true);
  }, []);

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={5000}
        onClose={(_, reason) => reason !== 'clickaway' && setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={current?.severity} variant="filled" onClose={() => setOpen(false)} sx={{ width: '100%' }}>
          {current?.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}
