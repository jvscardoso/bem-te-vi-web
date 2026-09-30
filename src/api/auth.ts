import { api } from './client';
import type { ChangePasswordResponse, LoginResponse, Me, PublicBranding } from './types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }, { auth: false }),

  me: () => api.get<Me>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<ChangePasswordResponse>('/auth/me/password', { currentPassword, newPassword }),
};

export const publicApi = {
  branding: (host: string) => api.get<PublicBranding>('/public/branding', { host }, { auth: false }),
};
