import { api } from './client';
import type { Tenant, UUID } from './types';

export interface SignupInput {
  name: string;
  subdomain: string;
  customDomain?: string;
  defaultAppointmentDurationMinutes?: number;
  minAppointmentDurationMinutes?: number;
  owner: { name: string; email: string; password: string };
}

export interface SignupResponse {
  tenant: Tenant;
  role: { id: UUID; name: string };
  owner: { id: UUID; name: string; email: string };
}

export const tenantsApi = {
  /** Cadastro público de clínica. Não devolve token: em seguida, faça login. */
  signup: (input: SignupInput) => api.post<SignupResponse>('/tenants', input, { auth: false }),
};
