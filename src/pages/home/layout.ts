import type { LayoutWidget, LayoutWidgetWidth, ScreenLayoutInput } from '@/api/configs';
import { HOME_WIDGETS } from './widgets';

export const WIDTH_LABELS: Record<LayoutWidgetWidth, string> = {
  third: '1/3',
  half: '1/2',
  'two-thirds': '2/3',
  full: 'Inteira',
};

/**
 * Colunas ocupadas numa grade de 12. No celular tudo ocupa a linha; em telas médias 1/3 vira
 * metade e 2/3 vira a linha toda, para os blocos não ficarem estreitos demais.
 */
export const WIDTH_SPANS: Record<LayoutWidgetWidth, { xs: number; md: number; lg: number }> = {
  third: { xs: 12, md: 6, lg: 4 },
  half: { xs: 12, md: 6, lg: 6 },
  'two-thirds': { xs: 12, md: 12, lg: 8 },
  full: { xs: 12, md: 12, lg: 12 },
};

/** Layout de quando a clínica nunca configurou (ou depois de "Restaurar padrão"). */
export const DEFAULT_WIDGETS: LayoutWidget[] = [
  { id: 'default-financial-summary', type: 'financial-summary', width: 'full' },
  { id: 'default-today-count', type: 'today-count', width: 'third' },
  { id: 'default-patients', type: 'patients', width: 'third' },
  { id: 'default-overdue-charges', type: 'overdue-charges', width: 'third' },
  { id: 'default-today-agenda', type: 'today-agenda', width: 'two-thirds' },
  { id: 'default-month-calendar', type: 'month-calendar', width: 'third' },
];

/**
 * Deixa um layout salvo utilizável: descarta tipos que o front não conhece mais e repetidos
 * (cada tipo aparece uma vez) e corrige larguras que o tipo não aceita.
 */
export function normalizeWidgets(layout: ScreenLayoutInput | null | undefined): LayoutWidget[] {
  if (!layout) return DEFAULT_WIDGETS;
  const seen = new Set<string>();
  return layout.widgets.flatMap((widget) => {
    const definition = HOME_WIDGETS[widget.type];
    if (!definition || seen.has(widget.type)) return [];
    seen.add(widget.type);
    const width = definition.widths.includes(widget.width) ? widget.width : definition.defaultWidth;
    return [{ ...widget, width }];
  });
}

/** Mesmo conteúdo (tipo e largura, na mesma ordem), ignorando os ids. */
export function sameWidgets(a: LayoutWidget[], b: LayoutWidget[]): boolean {
  return a.length === b.length && a.every((widget, index) => widget.type === b[index].type && widget.width === b[index].width);
}

export function newWidgetId(): string {
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
