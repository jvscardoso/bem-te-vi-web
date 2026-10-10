const DEV_TENANT_KEY = 'btv.devTenant';
const DEV_SUFFIX = '.localhost';

let cachedHost: string | null = null;

/**
 * Endereço de onde a pessoa está acessando, usado para resolver a marca da clínica
 * (`GET /public/branding?host=`) e para restringir o login à clínica desse endereço
 * (`POST /auth/login`, campo `host`). Os dois precisam usar exatamente o mesmo valor:
 * se divergissem, a tela mostraria uma marca e o login validaria outra clínica.
 *
 * Calculado uma vez por carregamento da página. Em produção é sempre o host real.
 * Em dev, a clínica vem do subdomínio de `localhost` (`clinica-demo.localhost:5173`), como
 * em produção. Em `localhost` puro ainda vale o modo antigo: `?tenant=<subdomínio>`
 * (lembrado na aba; `?tenant=` vazio esquece) ou VITE_DEV_TENANT.
 */
export function getBrandingHost(): string {
  cachedHost ??= resolveBrandingHost();
  return cachedHost;
}

/** Subdomínio de `*.localhost` em dev (`clinica-demo.localhost` → `clinica-demo`), senão null. */
function devSubdomain(): string | null {
  const { hostname } = window.location;
  return hostname.endsWith(DEV_SUFFIX) ? hostname.slice(0, -DEV_SUFFIX.length) || null : null;
}

function resolveBrandingHost(): string {
  if (!import.meta.env.DEV) return window.location.host;

  // Só o subdomínio: a API trata um host sem ponto como subdomínio, então funciona com ou sem
  // APP_BASE_DOMAIN=localhost na API.
  const subdomain = devSubdomain();
  if (subdomain) return subdomain;

  // Modo antigo, mantido enquanto os links de email da API apontarem para ?tenant=
  // (ver docs/proposta-links-de-email-com-subdominio-em-dev.md).
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

/**
 * Endereço de outra clínica em dev, no mesmo modo da página atual: subdomínio de `localhost`
 * (outra origem, então sem a sessão desta aba) ou `?tenant=` em `localhost` puro.
 */
export function devClinicUrl(subdomain: string, path: string): string {
  const { protocol, port } = window.location;
  if (devSubdomain()) return `${protocol}//${subdomain}${DEV_SUFFIX}${port ? `:${port}` : ''}${path}`;
  return `${path}?tenant=${encodeURIComponent(subdomain)}`;
}
