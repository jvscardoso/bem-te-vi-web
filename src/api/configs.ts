import { api } from './client';
import type { ISODateTime, UUID } from './types';

/** Largura de um bloco (em telas largas; no celular todos ocupam a linha toda). */
export type LayoutWidgetWidth = 'full' | 'two-thirds' | 'half' | 'third';

export interface LayoutWidget {
  /** Gerado pelo front, único na lista. */
  id: string;
  /** Tipo do bloco: o catálogo é do front (ex.: `src/pages/home/widgets.tsx`); a API não confere. */
  type: string;
  width: LayoutWidgetWidth;
}

/** O que o front envia ao salvar o layout de uma tela. */
export interface ScreenLayoutInput {
  version: 1;
  widgets: LayoutWidget[];
}

export interface ScreenLayout extends ScreenLayoutInput {
  updatedAt: ISODateTime;
  updatedBy: { id: UUID; name: string } | null;
}

/** Telas com layout configurável. */
export type LayoutScreen = 'home';

/**
 * Configurações de tela da clínica (task 18 da API). Toda a equipe lê, então nada sensível
 * fica aqui. `null` numa tela = nunca configurada: vale o padrão do front.
 */
export interface TenantConfigs {
  layouts: Record<LayoutScreen, ScreenLayout | null>;
}

export const EMPTY_CONFIGS: TenantConfigs = { layouts: { home: null } };

const base = (tenantId: UUID) => `/tenants/${tenantId}/configs`;

export const configsKeys = {
  detail: (tenantId: UUID) => ['configs', tenantId] as const,
};

export const configsApi = {
  get: (tenantId: UUID) => api.get<TenantConfigs>(base(tenantId)),
  saveLayout: (tenantId: UUID, screen: LayoutScreen, layout: ScreenLayoutInput) =>
    api.put<ScreenLayout>(`${base(tenantId)}/layouts/${screen}`, layout),
  /** Volta a tela ao padrão do front. */
  resetLayout: (tenantId: UUID, screen: LayoutScreen) => api.delete(`${base(tenantId)}/layouts/${screen}`),
};
