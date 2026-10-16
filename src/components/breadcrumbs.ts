/** Item da trilha de navegação do `PageHeader`. */
export interface Crumb {
  label: string;
  to: string;
}

/** "Início" da trilha: `/` leva à tela inicial certa (clínica ou backoffice). */
export const HOME_CRUMB: Crumb = { label: 'Início', to: '/' };
