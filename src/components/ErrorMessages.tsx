import { Alert, type AlertProps } from '@mui/material';
import { getErrorMessages } from '@/lib/errors';

interface ErrorMessagesProps extends Omit<AlertProps, 'children'> {
  error: unknown;
}

/** Exibe o erro da API (string ou lista de mensagens de validação). */
export function ErrorMessages({ error, ...props }: ErrorMessagesProps) {
  if (!error) return null;
  const messages = getErrorMessages(error);
  return (
    <Alert severity="error" {...props}>
      {messages.length === 1 ? (
        messages[0]
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
