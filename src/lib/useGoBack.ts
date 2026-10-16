import { useLocation, useNavigate } from 'react-router';

/**
 * Volta à página anterior do histórico; sem página anterior no app (tela aberta direto pela URL
 * ou por um link de email), vai para `fallback` no lugar da atual. Usado pelo voltar do
 * `PageHeader` e pelos formulários ao salvar: assim a tela de origem não fica duas vezes no
 * histórico (ficha → editar → salvar → ficha) e o voltar seguinte não cai na mesma tela.
 */
export function useGoBack() {
  const navigate = useNavigate();
  // `default` = primeira entrada desta aba no app: voltar no histórico sairia do sistema.
  const hasHistory = useLocation().key !== 'default';
  return (fallback: string) => {
    if (hasHistory) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
