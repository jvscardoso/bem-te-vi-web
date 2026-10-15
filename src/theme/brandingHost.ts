const DEV_TENANT_KEY = 'btv.devTenant';
const DEV_SUFFIX = '.localhost';
// IPv4 ou IPv6 (o navegador mostra o IPv6 entre colchetes).
const IP_HOSTNAME = /^(\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\])$/i;

let cachedHost: string | null = null;

/**
 * Endereço de onde a pessoa está acessando, usado para resolver a marca da clínica
 * (`GET /public/branding?host=`) e para restringir o login à clínica desse endereço
 * (`POST /auth/login`, campo `host`). Os dois precisam usar exatamente o mesmo valor:
 * se divergissem, a tela mostraria uma marca e o login validaria outra clínica.
 *
 * Calculado uma vez por carregamento da página. Em produção é sempre o host real.
 * Em dev, a clínica vem do subdomínio de `localhost` (`clinica-demo.localhost:5173`), como em
 * produção; `localhost` puro é a marca padrão (backoffice). Acessando por IP (celular na rede
 * local), um IP não tem subdomínio: aí vale `?tenant=<subdomínio>`, que é o formato dos links
 * de email da API quando o `FRONTEND_URL` dela é um IP.
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

const isIpAccess = () => IP_HOSTNAME.test(window.location.hostname);

function resolveBrandingHost(): string {
  if (!import.meta.env.DEV) return window.location.host;

  // Só o subdomínio: a API trata um host sem ponto como subdomínio, então funciona com ou sem
  // APP_BASE_DOMAIN=localhost na API.
  const subdomain = devSubdomain();
  if (subdomain) return subdomain;
  if (!isIpAccess()) return window.location.host;

  // Por IP: ?tenant= escolhe a clínica e fica lembrado na aba (a navegação interna tira o
  // parâmetro da URL); ?tenant= vazio volta para a marca padrão.
  const fromUrl = new URLSearchParams(window.location.search).get('tenant');
  try {
    if (fromUrl) sessionStorage.setItem(DEV_TENANT_KEY, fromUrl);
    else if (fromUrl === '') sessionStorage.removeItem(DEV_TENANT_KEY);
    const remembered = sessionStorage.getItem(DEV_TENANT_KEY);
    if (remembered) return remembered;
  } catch {
    if (fromUrl) return fromUrl;
  }
  return window.location.host;
}

// Subdomínios do domínio base que são da própria plataforma (backoffice, site), nunca de clínica:
// a API os reserva, então um 404 da marca neles é esperado. VITE_PLATFORM_HOSTS acrescenta outros.
const PLATFORM_SUBDOMAINS = ['www', 'app', 'admin', 'backoffice', 'plataforma'];

/**
 * O endereço é da plataforma (marca padrão, backoffice) e não de uma clínica? Serve para separar
 * os dois casos em que a marca pública dá 404: endereço da plataforma (normal) e endereço de
 * clínica que não existe ou está suspensa ("Endereço não encontrado").
 */
export function isPlatformAddress(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  if (import.meta.env.DEV) return getBrandingHost() === window.location.host;

  const extra = (import.meta.env.VITE_PLATFORM_HOSTS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (extra.includes(hostname)) return true;

  const baseDomain = import.meta.env.VITE_APP_BASE_DOMAIN?.trim().toLowerCase();
  // Sem o domínio base não dá para saber: melhor a marca padrão do que travar o backoffice.
  if (!baseDomain) return true;
  if (hostname === baseDomain) return true;
  return PLATFORM_SUBDOMAINS.some((subdomain) => hostname === `${subdomain}.${baseDomain}`);
}
