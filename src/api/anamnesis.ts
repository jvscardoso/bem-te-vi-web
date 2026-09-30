import { api } from './client';
import type { AnamnesisField, AnamnesisRecord, AnamnesisTemplate, UUID } from './types';

export interface AnamnesisTemplateInput {
  name: string;
  fields: AnamnesisField[];
}

export type AnswerValue = AnamnesisRecord['answers'][string];

const templatesBase = (tenantId: UUID) => `/tenants/${tenantId}/anamnesis-templates`;
const recordsBase = (tenantId: UUID, patientId: UUID) => `/tenants/${tenantId}/patients/${patientId}/anamnesis-records`;

export const anamnesisKeys = {
  templates: (tenantId: UUID) => ['anamnesis-templates', tenantId] as const,
  template: (tenantId: UUID, id: UUID) => ['anamnesis-templates', tenantId, id] as const,
  records: (tenantId: UUID, patientId: UUID) => ['anamnesis-records', tenantId, patientId] as const,
};

export const anamnesisApi = {
  /** Lista completa (sem paginação), ordenada por nome, já com os campos. */
  templates: (tenantId: UUID) => api.get<AnamnesisTemplate[]>(templatesBase(tenantId)),
  template: (tenantId: UUID, id: UUID) => api.get<AnamnesisTemplate>(`${templatesBase(tenantId)}/${id}`),
  createTemplate: (tenantId: UUID, input: AnamnesisTemplateInput) =>
    api.post<AnamnesisTemplate>(templatesBase(tenantId), input),
  updateTemplate: (tenantId: UUID, id: UUID, input: Partial<AnamnesisTemplateInput>) =>
    api.patch<AnamnesisTemplate>(`${templatesBase(tenantId)}/${id}`, input),
  deleteTemplate: (tenantId: UUID, id: UUID) => api.delete(`${templatesBase(tenantId)}/${id}`),

  /** Fichas do paciente, mais recente primeiro. */
  records: (tenantId: UUID, patientId: UUID) => api.get<AnamnesisRecord[]>(recordsBase(tenantId, patientId)),
  createRecord: (tenantId: UUID, patientId: UUID, templateId: UUID, answers: Record<string, AnswerValue>) =>
    api.post<AnamnesisRecord>(recordsBase(tenantId, patientId), { templateId, answers }),
};

export const FIELD_TYPE_LABELS: Record<AnamnesisField['type'], string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  number: 'Número',
  boolean: 'Sim / Não',
  date: 'Data',
  select: 'Escolha única',
  multiselect: 'Múltipla escolha',
};

export const typeHasOptions = (type: AnamnesisField['type']) => type === 'select' || type === 'multiselect';
