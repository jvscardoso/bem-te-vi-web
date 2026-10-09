# Arquitetura do front

Como o `bem-te-vi-web` é organizado e por quê. O que está pronto ou pendente fica no [`status.md`](status.md); regras de negócio e contrato da API, no [`regras-de-negocio.md`](regras-de-negocio.md).

SPA em React 19 + Vite 8 + TypeScript 6, com Material UI 9, TanStack Query 5, React Router 8 (data router), React Hook Form 7 + Zod 4. Fala com a `bem-te-vi-api` (NestJS) por REST/JSON com token Bearer.

## Estrutura de pastas

```
src/
  main.tsx            Providers (QueryClient → Branding → Notificações → Auth) e o RouterProvider
  router.tsx          Árvore de rotas, guards e lazy loading
  api/                Camada HTTP: client.ts + um módulo por recurso + types.ts
  auth/               Sessão (token), AuthProvider (/auth/me), guards e helpers de permissão
  theme/              Marca da clínica: host, BrandingProvider, tema MUI, cache da marca
  legal/              Textos dos Termos de Uso e da Política de Privacidade, por versão
  layouts/            ShellLayout (menu lateral + topo), PublicCardLayout (telas públicas), navigation.tsx
  components/         Componentes reutilizáveis (diálogos, campos, estados vazios, notificações)
  lib/                Funções puras e hooks utilitários (datas, formatos, máscaras, formulários, erros)
  pages/              Telas, uma pasta por área (patients, schedule, billing, settings, users, roles…)
```

| Pasta | Responsabilidade |
|---|---|
| `api/` | Única camada que conhece URLs e formatos da API. Cada módulo exporta um objeto `xxxApi` (funções) e `xxxKeys` (chaves do React Query). `types.ts` espelha os tipos da seção 15 das regras. |
| `auth/` | `session.ts` guarda o token; `AuthProvider` carrega o usuário; `guards.tsx` protege rotas; `permissions.ts` e `privileges.ts` concentram as regras de permissão da UI. |
| `theme/` | Resolve qual clínica está no endereço e monta o tema. |
| `components/` | Peças sem regra de negócio de uma tela específica: `ConfirmDialog`, `ErrorMessages`, `PageHeader`, `SectionCard`, `SearchField`, `ListPagination`, `PasswordField`, `MoneyField`, `PatientPicker`, `StatusScreen`, `EmptyState`, `LegalAcceptanceField` etc. |
| `lib/` | `dates.ts`, `format.ts` (moeda, CPF, datas), `masks.ts` (máscaras de digitação, gerador de senha), `form.ts` (`muiField`), `errors.ts`, `download.ts` (`saveJson`/`saveBlob`), `useDebouncedValue`, `useListSearchParams` (página/busca na URL). |
| `pages/` | Telas. Componentes e helpers usados só por uma área ficam na pasta dela (ex.: `pages/schedule/TimeGrid.tsx`, `pages/roles/permissionGroups.ts`). |

## Roteamento

Definido em `src/router.tsx` com `createBrowserRouter`.

```
/login, /cadastro, /esqueci-minha-senha        RedirectIfAuthenticated (logado → /)
/reset-password, /accept-invite                públicas, sem guard (rotas FIXAS: os emails da API apontam para elas)
/termos, /privacidade                          públicas, sem guard
/                                              RequireAuth
  ├─ index → HomeRedirect                      plataforma → /plataforma; clínica → /inicio
  ├─ ClinicAreaOnly → ShellLayout              usuários da plataforma são mandados para /plataforma
  │    /inicio, /minha-conta, /agenda, /pacientes…, /financeiro…, /anamnese/formularios…,
  │    /usuarios, /papeis, /configuracoes, *  (cada uma com RequirePermission quando aplicável)
  └─ /plataforma → RequirePermission('platform:manage') → ShellLayout (navegação da plataforma)
       clinicas, minha-conta
```

- Permissão de cada rota: ver a tabela do [`status.md`](status.md).
- **Lazy loading:** todas as páginas, exceto o login, os layouts e os guards, são carregadas sob demanda pelo helper `page(load, name)`, que gera `lazy: () => import(...).then(m => ({ Component: m[name] }))`. `HydrateFallback` mostra o `FullScreenLoader`.
- Estado de tela que vale compartilhar por link (aba da ficha, página e busca das listas, data e visão da agenda) fica na **query string** (`useSearchParams`, `useListSearchParams`).

## Sessão

- **Token:** JWT da API, guardado em `sessionStorage` na chave `btv.accessToken` (`src/auth/session.ts`). Sobrevive ao reload, não é compartilhado entre abas e some ao fechar o navegador. O módulo expõe `getToken`, `setToken`, `clear(reason)` e `subscribe`, consumidos via `useSyncExternalStore`.
- **Usuário:** `AuthProvider` busca `GET /auth/me` (chave `['auth','me']`, `staleTime` 30 s, `refetchOnWindowFocus`, sem retry) sempre que há token. Status: `anonymous` (sem token), `loading`, `authenticated`, `error` (mostra "Tentar novamente" / "Sair"). Permissões e nome vêm **sempre** do `/auth/me`, nunca da resposta do login.
- **Login:** `login(email, senha)` chama `POST /auth/login` (com `host`, ver abaixo), limpa o cache do usuário anterior, grava o token e já busca o `/auth/me`.
- **Troca da própria senha:** a API devolve um token novo; `replaceToken` o grava.
- **401:** `client.ts` chama `session.clear('expired')` **só se o token recusado ainda for o atual** (requisições antigas em voo, depois de trocar a senha, não derrubam a sessão nova). O `RequireAuth` leva ao login, que mostra o aviso de sessão expirada.
- **400 nunca desloga** (ex.: senha atual incorreta, link inválido).
- **Termos/Política pendentes:** se `/auth/me` traz `pendingLegalDocuments` não vazio, o `RequireAuth` renderiza o `PendingLegalScreen` (modal que não fecha) no lugar do app. O aceite (`POST /auth/me/legal-acceptances`, sempre com as duas versões vigentes) é seguido de um novo `/auth/me`, que libera o app. A API não bloqueia nada: o bloqueio é só do front.
- **Sem token**, todo o cache do React Query é descartado, exceto a marca pública (`'public-branding'`).

## Marca da clínica (whitelabel)

- `getBrandingHost()` (`src/theme/brandingHost.ts`) decide o endereço uma vez por carregamento (função interna `resolveBrandingHost`):
  - produção: `window.location.host`;
  - dev: `?tenant=<subdomínio>` (lembrado na aba em `sessionStorage` `btv.devTenant`; `?tenant=` vazio esquece), senão `VITE_DEV_TENANT`, senão o host.
- `BrandingProvider` busca `GET /public/branding?host=` (chave `['public-branding', host]`, `staleTime` 5 min, sem retry em 404), monta o tema MUI com `createAppTheme(cores)`, aplica `CssBaseline` e põe `tradeName ?? name` no `document.title`. `useBranding()` dá `status` (`loading`/`found`/`notFound`/`error`), `displayName` e `logoUrl`. Sem clínica, vale a marca padrão do bem-te-vi.
- **O mesmo host vai no login e no "esqueci minha senha"**: assim a tela nunca mostra uma clínica enquanto a API valida outra.
- Depois de salvar marca ou logo, `applyBrandingToCache` atualiza o cache local da marca pública, porque a resposta HTTP da API tem `Cache-Control: max-age=60`.

## Termos de Uso e Política de Privacidade

- A versão vigente de cada documento vem da API (`GET /public/legal`); o texto de cada versão fica em `src/legal/documents.ts` (`LEGAL_DOCUMENTS`), com a data de vigência. Sem texto para a versão vigente, as páginas `/termos` e `/privacidade` mostram o aviso de texto em elaboração.
- Publicar um texto novo = cadastrá-lo com a próxima versão **e** pedir à API para subir `LEGAL_TERMS_VERSION` / `LEGAL_PRIVACY_VERSION`.
- Aceite: `LegalAcceptanceField` + `useLegalAcceptance` no cadastro e no convite; `PendingLegalScreen` depois do login. No `400` de versão desatualizada (`isOutdatedLegalVersion`), as versões são recarregadas e o aceite é pedido de novo.

## Camada de chamadas à API

- `src/api/client.ts`: `request<T>(path, options)` e o atalho `api.get/post/patch/put/delete`. Base em `VITE_API_URL` (padrão `http://localhost:3000`). Envia `Authorization: Bearer` (a menos que `auth: false`), serializa JSON e passa `FormData` como está (o navegador põe o boundary do multipart).
- Erros viram `ApiError { status, body, messages }`. `messages` já vem pronto para exibir: 429 e 413 têm textos próprios, valores "N centavos" das mensagens da API viram reais, rede fora e 5xx têm mensagens genéricas.
- Um módulo por recurso: `auth` (+ `publicApi.branding`), `tenants`, `users`, `roles`, `patients`, `anamnesis`, `appointments`, `billing`, `platform`, `legal`.
- **Encerramento de conta:** o estado vem de `GET /tenants/:id/closure` (`useClosureState`, só com `tenant:manage`) e alimenta a aba de Configurações e o `ClosureBanner`, renderizado pelo `ShellLayout` acima do conteúdo. Pedir e cancelar gravam a resposta no cache (`tenantKeys.closure` e `tenantKeys.detail`), então aba e banner mudam juntos.
- **Downloads** (exportações LGPD): a rota exige o token, então nada de `<a href>` para a API. O front busca o JSON com `api.get` (mesmo tratamento de erros e de 401) e gera o arquivo com `saveJson` (`lib/download.ts`). O nome do arquivo é montado no front, porque a API não expõe `Content-Disposition` no CORS. Cada exportação é auditada: reaproveite os dados já baixados (baixar de novo, formato legível) em vez de chamar a API outra vez.
- `lib/errors.ts`: `getErrorMessages(error)` e `isApiError(error, status?)`. Na UI, `<ErrorMessages error={...} />` mostra as mensagens da API.

## Gerenciamento de estado

- **Estado do servidor:** TanStack Query. `QueryClient` em `main.tsx` com `staleTime` 30 s e retry só para falhas de rede/5xx (no máximo 2; 4xx nunca repete). Chaves por recurso (`patientKeys.detail(id)`, etc.); mutações invalidam ou atualizam com `setQueryData`.
- **Sessão:** store externo mínimo em `session.ts`.
- **Contextos:** `AuthContext` (usuário, `can`, login/logout), `BrandingContext` (marca), `NotificationContext` (`useNotify()` para snackbars de sucesso).
- **URL:** filtros, paginação, abas e datas.
- Não há Redux/Zustand: o resto é estado local de componente.
- **Consultas auditadas:** toda leitura de paciente e de fichas de anamnese vira registro na trilha de auditoria da API. Por isso as chaves `['patients', …]` e `['anamnesis-records', …]` não são refeitas ao focar a aba (`queryClient.setQueryDefaults` em `main.tsx`). Em telas novas, não busque o mesmo paciente mais de uma vez e nunca busque pacientes só para exibir nomes na tela de auditoria.

## Controle de acesso na UI

- `can(permissão | permissões[])` (via `useAuth`) exige **todas** as permissões listadas (`hasPermissions`).
- Rotas: `RequirePermission` mostra "Acesso negado" em vez de redirecionar.
- Menu: itens de `layouts/navigation.tsx` têm `permission` e são filtrados.
- Botões e ações: escondidos ou desabilitados com `can(...)`. A API continua sendo quem garante (403); a UI só evita oferecer o que vai falhar.
- `appointments:all`: sem ela, a agenda, o novo agendamento, o painel e a aba de agendamentos do paciente trabalham só com o próprio usuário (sem seletor de profissional).
- Regras de conta (`auth/privileges.ts`): `isRoleAbove` / `missingPermissions` desabilitam papéis e usuários "acima" do ator; `isAdminRole` / `ADMIN_PERMISSIONS` apoiam a regra do último administrador. Detalhes na seção 4.3 das regras.
- Usuário com `platform:manage` só vê o backoffice (`ClinicAreaOnly`, `HomeRedirect`).

## Padrões de componentes e formulários

- **Formulários:** React Hook Form. Formulários grandes usam `zodResolver` com o schema num arquivo ao lado (`patientForm.ts`, `templateForm.ts`); os simples usam as regras do `register`.
- `muiField(register('campo'), errors.campo)` liga o `register` a um `TextField` do MUI (`inputRef`, `error`, `helperText`).
- Campos com máscara ou controlados (CPF, telefone, CEP, dinheiro, cores, seletores) usam `Controller` e as funções de `lib/masks.ts`. Dinheiro trafega em **centavos** (`moneyToCents`, `centsToMoney`, `formatCents`).
- **MUI 9:** props de input via `slotProps` (`input`, `htmlInput`, `inputLabel`). Em Radio/Checkbox, ref por `slotProps.input.ref`. Depois de `reset`/`setValue` em campo não controlado, forçar `slotProps.inputLabel.shrink` (ou usar `Controller`/`key`) para o label não sobrepor o valor.
- **Diálogos de criação/edição** (`XxxDialog.tsx`) recebem o item (ou nada, para criar) e fecham no sucesso com `useNotify()`; ações destrutivas passam por `ConfirmDialog`.
- **Listas:** `PageHeader` + `SearchField` (debounce) + tabela/cards + `ListPagination`, com página e busca na URL. Estados de carregando, vazio (`EmptyState`) e erro (`ErrorMessages`) sempre tratados.
- **Responsivo:** `useMediaQuery` no menu (gaveta temporária no celular), nos diálogos (tela cheia no celular) e na agenda (lista no celular, grade no desktop); layouts com `sx` responsivo (`xs`/`sm`).
- **React Compiler (lint):** nada impuro no render (`Date.now()` vai em `useState(() => Date.now())`), `useWatch` em vez de `watch`, hooks e componentes em arquivos separados quando o `react-refresh` pede.
- Textos da interface em português; código (nomes) em inglês; comentários em português.

## Testes

Não há testes automatizados nem ferramenta de teste instalada. A verificação é `npm run typecheck`, `npm run lint` e teste manual no navegador contra a API local (contas de teste em `docs/credenciais-de-teste.md`).

## Build e deploy

- `npm run build` = `tsc -b && vite build` → `dist/`. Vite 8 (Rolldown) com o grupo `vendor` (react, react-dom, scheduler, react-router, @tanstack) num arquivo estável; o MUI fica na divisão automática por rota.
- Variáveis (`.env.example`): `VITE_API_URL`, `VITE_DEV_TENANT` (só dev) e `VITE_APP_BASE_DOMAIN` (domínio das clínicas, usado no cadastro para mostrar e levar ao endereço novo).
- **Deploy ainda não configurado.** Requisitos: servir `dist/` como SPA (toda rota desconhecida devolve `index.html`, inclusive `/reset-password` e `/accept-invite`), responder em `*.<APP_BASE_DOMAIN>` e nos domínios próprios verificados, e a API com `FRONTEND_URL`/CORS apontando para o front.
