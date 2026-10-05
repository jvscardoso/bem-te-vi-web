const DEV_TENANT_KEY = 'btv.devTenant';

let cachedHost: string | null = null;

/**
 * Endereço de onde a pessoa está acessando, usado para resolver a marca da clínica
 * (`GET /public/branding?host=`) e para restringir o login à clínica desse endereço
 * (`POST /auth/login`, campo `host`). Os dois precisam usar exatamente o mesmo valor:
 * se divergissem, a tela mostraria uma marca e o login validaria outra clínica.
 *
 * Calculado uma vez por carregamento da página. Em produção é sempre o host real.
 * Em dev (sem DNS) aceita `?tenant=<subdomínio>` (lembrado na aba; `?tenant=` vazio
 * esquece) ou VITE_DEV_TENANT.
 */
export function getBrandingHost(): string {
  cachedHost ??= resolveBrandingHost();
  return cachedHost;
}

function resolveBrandingHost(): string {
  if (!import.meta.env.DEV) return window.location.host;

  const fromUrl = new URLSearchParams(window.location.search).get('tenant');
  try {
    if (fromUrl) sessionStorage.setItem(DEV_TENANT_KEY, fromUrl);
    else if (fromUrl === '') sessionStorage.removeItem(DEV_TENANT_KEY);
    const remembered = sessionStorage.getItem(DEV_TENANT_KEY);
    if (remembered) return remembered;
  } catch {
    if (fromUrl) return fromUrl;
  }
  return import.meta.env.VITE_DEV_TENANT || window.location.host;
}
