import { getBrandingHost } from '@/theme/brandingHost';
import { api } from './client';
import type { ChangePasswordResponse, LoginResponse, Me, PublicBranding } from './types';

export const authApi = {
  /** O `host` restringe o login aos usuários da clínica do endereço (mesmo valor da marca). */
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password, host: getBrandingHost() }, { auth: false }),

  /**
   * Pede o link de recuperação. Sempre 204, exista a conta ou não (a rota não revela
   * emails cadastrados); o link só sai para contas que conseguiriam entrar por este endereço.
   */
  forgotPassword: (email: string) =>
    api.post<void>('/auth/forgot-password', { email, host: getBrandingHost() }, { auth: false }),

  me: () => api.get<Me>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<ChangePasswordResponse>('/auth/me/password', { currentPassword, newPassword }),
};

export const publicApi = {
  branding: (host: string) => api.get<PublicBranding>('/public/branding', { host }, { auth: false }),
};
