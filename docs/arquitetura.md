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
  layouts/            ShellLayout (menu lateral + topo, recebe a busca em `search`), PatientSearch (busca global de pacientes), AuthSplitLayout (login: painel da marca + formulário), PublicCardLayout (demais telas públicas), navigation.tsx (itens com `shortLabel` quando o nome não cabe no menu recolhido, ~12 caracteres)
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
/login, /esqueci-minha-senha                  RedirectIfAuthenticated (logado → /)
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
- **Lazy loading:** todas as páginas, exceto o login, os layouts e os guards, são carregadas sob demanda pelo helper `page(load, name)`, que gera `lazy: () => import(...).then(m => ({ Component: m[name] }))`. `HydrateFallback` mostra o `FullScreenLoader`. Na navegação entre telas, o `RootLayout` (raiz do roteador) mostra o `NavigationProgress`: uma barra no topo enquanto o código da próxima tela baixa (aparece depois de 200 ms, para não piscar).
- **Erros (`RouteErrorPage`):** `errorElement` na raiz (tela inteira: login, links de email, textos legais) e numa rota sem caminho logo abaixo de cada `ShellLayout` (o erro ocupa só o conteúdo e o menu continua). Erro comum: "Algo deu errado" com Recarregar e Ir para o início (em dev, a mensagem técnica embaixo). Arquivo de tela que não carrega (publicação nova com o app aberto): recarrega sozinho uma vez (`sessionStorage` `btv.chunkReloadAt`, no máximo uma vez a cada 30 s); se continuar faltando, "Nova versão disponível".
- Estado de tela que vale compartilhar por link (aba da ficha, página e busca das listas, data e visão da agenda) fica na **query string** (`useSearchParams`, `useListSearchParams`).

## Sessão

- **Dois tokens (task 21 / decisão 07 da API):**
  - **acesso:** JWT de 15 min, guardado **só em memória** (`src/auth/session.ts`, nada no `sessionStorage`/`localStorage`). Vai como `Authorization: Bearer`. O módulo lê o `exp` do JWT (`expiresWithin`) e expõe `getToken`, `setToken`, `clear(reason)` e `subscribe` (consumidos via `useSyncExternalStore`).
  - **refresh:** cookie `btv_refresh` (`HttpOnly`, `SameSite=Strict`, sem `Max-Age`), posto e lido só pela API. O front nunca o vê; todas as requisições usam `credentials: 'include'`. Vence com 12 h sem uso; a sessão dura no máximo 24 h; some ao fechar o navegador.
- **Carregar a página:** a memória some no reload, o cookie não. O `AuthProvider` começa em `loading` e chama `POST /auth/refresh`; com `200` a sessão volta (e segue o `/auth/me`), com `401` vai para o login.
- **Renovação** (`client.ts`): antes de cada requisição autenticada, se o token vence em menos de 1 min, `refreshSession()` primeiro. Num `401`, se o token já foi trocado enquanto a requisição voava, repete com o atual; senão renova **uma vez** e repete. **Um refresh por vez:** `refreshSession` guarda a promessa em andamento e todas as chamadas simultâneas a reaproveitam (o refresh é rotativo; reenviar um cookie já usado fora da tolerância de 10 s encerra a sessão). As rotas de autenticação (`login`, `refresh`, `logout`, `forgot`/`reset-password`, `accept-invite`) ficam fora desse ciclo.
- **Usuário:** `AuthProvider` busca `GET /auth/me` (chave `['auth','me']`, `staleTime` 30 s, `refetchOnWindowFocus`, sem retry) sempre que há token. Status: `loading` (restaurando a sessão ou lendo o `/auth/me`), `anonymous` (sem token), `authenticated`, `error` (mostra "Tentar novamente" / "Sair"). Permissões e nome vêm **sempre** do `/auth/me`, nunca da resposta do login.
- **Login:** `login(email, senha)` chama `POST /auth/login` (com `host`, ver abaixo; a API devolve o token e põe o cookie), limpa o cache do usuário anterior, grava o token e já busca o `/auth/me`.
- **Sair:** `logout()` chama `POST /auth/logout` (encerra a sessão no servidor: o token passa a dar `401` e o cookie é apagado) e depois `session.clear('logout')`; se a chamada falhar, limpa a sessão local mesmo assim.
- **Troca da própria senha:** a API devolve um token novo; `replaceToken` o grava. A sessão (e o cookie) de quem trocou continua; as outras do usuário caem.
- **401:** só depois de a renovação falhar (refresh `401`: sessão encerrada, vencida, conta desativada, clínica suspensa), `client.ts` chama `session.clear('expired')`, e **só se o token recusado ainda for o atual** (requisições antigas em voo não derrubam uma sessão já renovada). O `RequireAuth` leva ao login, que mostra o aviso de sessão expirada.
- **Mesma origem:** o cookie é `SameSite=Strict`, então a API precisa ficar no mesmo site do front. Em dev, `VITE_API_URL=/api` e o proxy do Vite (`vite.config.ts`) levam `/api` para `http://localhost:3000` em qualquer subdomínio `*.localhost`. Em produção, `api.<domínio base>` serve para os subdomínios; nos **domínios próprios** de clínica, a hospedagem precisa servir a API em `<domínio>/api` e o front usar o caminho relativo (pendente, junto do deploy).
- **400 nunca desloga** (ex.: senha atual incorreta, link inválido).
- **Termos/Política pendentes:** se `/auth/me` traz `pendingLegalDocuments` não vazio, o `RequireAuth` renderiza o `PendingLegalScreen` (modal que não fecha) no lugar do app. O aceite (`POST /auth/me/legal-acceptances`, sempre com as duas versões vigentes) é seguido de um novo `/auth/me`, que libera o app. A API não bloqueia nada: o bloqueio é só do front.
- **Sem token**, todo o cache do React Query é descartado, exceto a marca pública (`'public-branding'`).

## Marca da clínica (whitelabel)

- `getBrandingHost()` (`src/theme/brandingHost.ts`) decide o endereço uma vez por carregamento (função interna `resolveBrandingHost`):
  - produção: `window.location.host`;
  - dev: subdomínio de `localhost` (`clinica-demo.localhost:5173` → manda só `clinica-demo`, que a API trata como subdomínio). `localhost` puro é a marca padrão (backoffice). Por IP (celular na rede local), um IP não tem subdomínio: vale `?tenant=<subdomínio>` (lembrado na aba em `sessionStorage` `btv.devTenant`; `?tenant=` vazio esquece), o mesmo formato dos links de email da API quando o `FRONTEND_URL` dela é um IP. 
- `BrandingProvider` busca `GET /public/branding?host=` (chave `['public-branding', host]`, `staleTime` 5 min, sem retry em 404), monta o tema MUI com `createAppTheme(cores)`, aplica `CssBaseline` e põe `tradeName ?? name` no `document.title`. `useBranding()` dá `status` (`loading`/`found`/`notFound`/`error`), `displayName` e `logoUrl`. Sem clínica, vale a marca padrão do bem-te-vi.
- **Endereço da plataforma × de clínica** (`isPlatformAddress()`): a marca pública dá `404` nos dois, então o front decide pelo endereço. São da plataforma (marca padrão, backoffice): em dev, `localhost` puro e IP sem `?tenant=`; em produção, o `VITE_APP_BASE_DOMAIN`, os subdomínios `www`, `app`, `admin`, `backoffice` e `plataforma` dele e os hosts de `VITE_PLATFORM_HOSTS` (sem `VITE_APP_BASE_DOMAIN`, todo endereço conta como da plataforma). Num endereço de clínica, o `BrandingProvider` mostra o `FullScreenLoader` até a marca chegar (sem piscar a marca padrão) e, com `404`, a `AddressNotFoundScreen` ("Endereço não encontrado": clínica inexistente, excluída, suspensa ou domínio próprio não verificado) no lugar do app inteiro. Erro de rede segue com a marca padrão.
- **Modo claro/escuro** (`src/theme/colorMode.ts`): `useColorModeState` lê `localStorage` `btv.colorMode` antes do primeiro render (sem piscar) e, sem escolha salva, acompanha `prefers-color-scheme`. O `BrandingProvider` passa o modo para `createAppTheme` e expõe `useColorMode()` (`mode`, `setMode`). Não usamos as variáveis CSS do MUI (`colorSchemes`) porque a pré-visualização de marca usa um `ThemeProvider` aninhado.
  - No escuro, `createAppTheme` clareia as cores da clínica até um contraste mínimo com o fundo (`readableOnDark`).
  - No claro, o inverso (`readableOnLight`): uma cor de clínica clara demais (amarelo, verde-água) escurece até 4,5:1 com o fundo branco (a secundária, até 3:1), para botões contornados, links, abas e ícones ficarem legíveis. As superfícies grandes de marca usam a cor original (`palette.brand`): o menu lateral, o botão preenchido primário (override no `MuiButton`, só quando a cor foi ajustada) e o painel do login.
  - `contrastThreshold: 4.5`: o texto sobre a cor da clínica (preto ou branco) segue o critério AA nos dois modos.
  - Nada de cor fixa clara/escura nos componentes: use `background.*`, `text.*`, `divider`, `action.*` e as cores da paleta. O `CssBaseline enableColorScheme` deixa campos nativos (data, hora) no modo certo.
  - **Status nunca usam `primary`** (a cor da clínica muda de marca para marca e pode coincidir com outra cor de status). Use as cores semânticas (`info`, `success`, `warning`, `error`, `default`) e, quando faltar uma, `purple` (cor extra da paleta, com tom próprio para cada modo, declarada em `createAppTheme.ts`).
- **Menu lateral na cor da clínica** (`navColors` no `ShellLayout`): no claro, fundo `palette.brand` (a cor original) com o texto de contraste do tema; no escuro, a cor original da marca (`palette.brand`, porque `primary.main` vem clareada) escurecida até o texto branco ter contraste AA. Item ativo e hover são faixas translúcidas da cor do texto, então funcionam sobre qualquer marca. O `BrandMark` recebe `avatarColors` para o quadrado sem logo não sumir no fundo.
- **O mesmo host vai no login e no "esqueci minha senha"**: assim a tela nunca mostra uma clínica enquanto a API valida outra.
- Depois de salvar marca ou logo, `applyBrandingToCache` atualiza o cache local da marca pública, porque a resposta HTTP da API tem `Cache-Control: max-age=60`.

## Termos de Uso e Política de Privacidade

- A versão vigente de cada documento vem da API (`GET /public/legal`); o texto de cada versão fica em `src/legal/documents.ts` (`LEGAL_DOCUMENTS`), com a data de vigência. Sem texto para a versão vigente, as páginas `/termos` e `/privacidade` mostram o aviso de texto em elaboração.
- Publicar um texto novo = cadastrá-lo com a próxima versão **e** pedir à API para subir `LEGAL_TERMS_VERSION` / `LEGAL_PRIVACY_VERSION`.
- Aceite: `LegalAcceptanceField` + `useLegalAcceptance` no aceite de convite; `PendingLegalScreen` depois do login. No `400` de versão desatualizada (`isOutdatedLegalVersion`), as versões são recarregadas e o aceite é pedido de novo.

## Camada de chamadas à API

- `src/api/client.ts`: `request<T>(path, options)` e o atalho `api.get/post/patch/put/delete`. Base em `VITE_API_URL` (pode ser relativa: `/api` em dev, pelo proxy do Vite; padrão `http://localhost:3000`), sempre com `credentials: 'include'`. Envia `Authorization: Bearer` (a menos que `auth: false`), serializa JSON e passa `FormData` como está (o navegador põe o boundary do multipart).
- Erros viram `ApiError { status, body, messages }`. `messages` já vem pronto para exibir: 429 e 413 têm textos próprios, valores "N centavos" das mensagens da API viram reais, rede fora e 5xx têm mensagens genéricas.
- Um módulo por recurso: `auth` (+ `publicApi.branding`), `tenants`, `users`, `roles`, `patients`, `anamnesis`, `appointments`, `billing`, `platform`, `legal`.
- **Encerramento de conta:** o estado vem de `GET /tenants/:id/closure` (`useClosureState`, só com `tenant:manage`) e alimenta a aba de Configurações e o `ClosureBanner`, renderizado pelo `ShellLayout` acima do conteúdo. Pedir e cancelar gravam a resposta no cache (`tenantKeys.closure` e `tenantKeys.detail`), então aba e banner mudam juntos.
- **Downloads** (exportações LGPD): a rota exige o token, então nada de `<a href>` para a API. O front busca o JSON com `api.get` (mesmo tratamento de erros e de 401) e gera o arquivo com `saveJson` (`lib/download.ts`). O nome do arquivo é montado no front, porque a API não expõe `Content-Disposition` no CORS. Cada exportação é auditada: reaproveite os dados já baixados (baixar de novo, formato legível) em vez de chamar a API outra vez.
- `lib/errors.ts`: `getErrorMessages(error)` e `isApiError(error, status?)`. Na UI, `<ErrorMessages error={...} />` mostra as mensagens da API.
- **Erro no campo:** o `400` de validação da API traz `errors: [{ field, code, message }]`. Nos formulários com React Hook Form, o `onError` da mutação chama `applyFieldErrors(error, setError, campos, mapa?)`: cada frase de um campo da tela vai para embaixo dele (o primeiro recebe o foco) e o retorno (o resto, ou o erro inteiro sem `errors`) vai para a área de `ErrorMessages`, guardado num estado (`areaError`). O `mapa` cobre nomes diferentes entre a API e a tela (ex.: `defaultAppointmentDurationMinutes` → `duration` no `UserDialog`). Usado no cadastro de paciente, em Configurações › Dados e no diálogo de usuário.

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
- **Assinatura da clínica** (task 31): `useAuth()` dá `subscription` (do `/auth/me`) e `readOnly` (`access === 'read_only'`).
  - Em só leitura, o `can()` deixa de reconhecer `patients:write`, `appointments:write` e `billing:write` (`withoutWritePermissions` em `auth/permissions.ts`): tudo o que já dependia delas some sozinho. `hasRole()` dá as permissões do papel, sem a assinatura; o `RequirePermission` usa isso para mostrar "Modo só leitura" (e não "Acesso negado") numa tela que só serve para alterar dados.
  - As permissões de administração (`users:manage`, `roles:manage`, `anamnesis_templates:manage`, `tenant:manage`) também abrem telas de consulta, então continuam valendo: cada tela desabilita as próprias ações com `readOnly`. **Ação nova que altera dados numa tela dessas precisa olhar `readOnly`.**
  - `access === 'blocked'`: o `RequireAuth` mostra a `SubscriptionBlockedScreen` no lugar do app (contratar, exportar, sair).
  - `402` com `code` `subscription_*`: o `client.ts` avisa (`onSubscriptionRestricted`) e o `AuthProvider` relê o `/auth/me`; nunca desloga. A mensagem da API aparece na área de erros do formulário.
  - Aviso no topo (`SubscriptionBanner`, no `ShellLayout`) para todo usuário; "Contratar" só com `tenant:manage`. Tela em Configurações › Assinatura (`src/pages/settings/subscription/`).

## Tela inicial configurável

- `src/pages/home/widgets.tsx` é o **catálogo de blocos**: título, descrição, permissão de quem vê, larguras aceitas, largura padrão e o componente. A API (task 18) só guarda a lista `{ id, type, width }` na ordem, dentro das configurações de tela da clínica (`src/api/configs.ts`: `GET /tenants/:id/configs` → `layouts.home`; `PUT`/`DELETE /configs/layouts/:screen`). Tipo novo não precisa de mudança na API; tela configurável nova é uma chave nova em `layouts`.
- `layout.ts`: layout padrão (`DEFAULT_WIDGETS`), larguras em colunas de uma grade de 12 (`WIDTH_SPANS`: no celular tudo ocupa a linha; em telas médias 1/3 vira metade e 2/3 vira a linha) e `normalizeWidgets` (descarta tipo desconhecido ou repetido e corrige largura não aceita).
- `useHomeLayout` lê o layout salvo (ou o padrão). `HomeGrid` desenha os blocos; com `editing`, mostra a barra de cada um (arrastar, largura, mover, remover) e a prévia inerte. Fora da edição, esconde os blocos sem permissão.
- O editor fica em **Configurações › Tela inicial** (`src/pages/settings/HomeLayoutTab.tsx`, aba sem a largura máxima das outras para a prévia mostrar as larguras reais). O Início só exibe.
- Cada bloco é um `Paper` com `height: 100%` (os da mesma linha ficam da mesma altura) e se adapta à **própria largura** com container queries (o item da grade tem `containerType: inline-size`; ex.: `SummaryCards embedded`).
- Salvar igual ao padrão chama o `DELETE` (volta a acompanhar o padrão do front). `layouts.home: null` = nunca configurado. Se a leitura falhar, o Início usa o padrão (o layout é só a arrumação); a aba de Configurações mostra o erro.
- **Bloco novo:** criar o componente em `src/pages/home/`, registrar em `HOME_WIDGETS` e, se fizer sentido, incluir no `DEFAULT_WIDGETS`.

## Padrões de componentes e formulários

- **Formulários:** React Hook Form. Formulários grandes usam `zodResolver` com o schema num arquivo ao lado (`patientForm.ts`, `templateForm.ts`); os simples usam as regras do `register`.
- `muiField(register('campo'), errors.campo)` liga o `register` a um `TextField` do MUI (`inputRef`, `error`, `helperText`).
- Campos com máscara ou controlados (CPF, telefone, CEP, dinheiro, cores, seletores) usam `Controller` e as funções de `lib/masks.ts`. Dinheiro trafega em **centavos** (`moneyToCents`, `centsToMoney`, `formatCents`).
- **MUI 9:** props de input via `slotProps` (`input`, `htmlInput`, `inputLabel`). Em Radio/Checkbox, ref por `slotProps.input.ref`. Depois de `reset`/`setValue` em campo não controlado, forçar `slotProps.inputLabel.shrink` (ou usar `Controller`/`key`) para o label não sobrepor o valor.
- **Diálogos de criação/edição** (`XxxDialog.tsx`) recebem o item (ou nada, para criar) e fecham no sucesso com `useNotify()`; ações destrutivas passam por `ConfirmDialog`.
- **Listas:** `PageHeader` + `SearchField` (debounce) + tabela/cards + `ListPagination`, com página e busca na URL. Estados de carregando, vazio (`EmptyState`) e erro (`ErrorMessages`) sempre tratados.
- **Carregamento:** no primeiro carregamento de uma lista (`query.isPending`), `TableSkeletonRows` dentro do `TableBody`, com o `sx` de cada coluna igual ao do cabeçalho (as escondidas no celular somem também); nas atualizações seguintes, a barra fina (`LinearProgress` com `isFetching`) sobre a lista que já está na tela. Telas de detalhe e blocos usam `Skeleton` no formato do conteúdo. Botão que dispara mutação usa `loading={mutation.isPending}`.
- **Largura:** páginas, abas e formulários ocupam a largura toda da área de conteúdo (sem `maxWidth` no container da página, decidido em 16/10/2026). Limite de largura só em campos isolados (um seletor, a busca de uma lista) e em diálogos.
- **Responsivo:** `useMediaQuery` no menu (gaveta temporária no celular), nos diálogos (tela cheia no celular) e na agenda (lista no celular, grade no desktop); layouts com `sx` responsivo (`xs`/`sm`).
- **React Compiler (lint):** nada impuro no render (`Date.now()` vai em `useState(() => Date.now())`), `useWatch` em vez de `watch`, hooks e componentes em arquivos separados quando o `react-refresh` pede.
- Textos da interface em português; código (nomes) em inglês; comentários em português.
- **Sem HTML cru:** o lint (`no-restricted-syntax` no `eslint.config.js`) proíbe `dangerouslySetInnerHTML`, atribuir `innerHTML`/`outerHTML`, `insertAdjacentHTML` e `document.write`. O React já escapa todo texto; se um dia for preciso renderizar HTML, sanitizar com DOMPurify e liberar a regra só naquele arquivo, com o motivo.
- **Fonte:** Inter variável servida pelo próprio app (`@fontsource-variable/inter`, importada no `main.tsx`; família `"Inter Variable"` no tema). Não use Google Fonts nem outra CDN de fonte: mandaria o IP de cada usuário a terceiros (LGPD) e a CSP teria de liberar o domínio.

## Testes

Não há testes automatizados nem ferramenta de teste instalada. A verificação é `npm run typecheck`, `npm run lint` e teste manual no navegador contra a API local (contas de teste em `docs/credenciais-de-teste.md`).

## Build e deploy

- `npm run build` = `tsc -b && vite build` → `dist/`. Vite 8 (Rolldown) com o grupo `vendor` (react, react-dom, scheduler, react-router, @tanstack) num arquivo estável; o MUI fica na divisão automática por rota.
- A fonte vai no `dist/assets` (um `.woff2` por conjunto de caracteres; o navegador só baixa o que a página usa, normalmente o latino). Com isso, a CSP do deploy pode usar `font-src 'self'` (task 20).
- Variáveis (`.env.example`): `VITE_API_URL` (em dev, `/api`, pelo proxy do Vite), `VITE_APP_BASE_DOMAIN` (domínio das clínicas: endereço mostrado em Configurações e no backoffice, e separação entre endereço de clínica e da plataforma) e `VITE_PLATFORM_HOSTS` (hosts extras da plataforma; ver Marca da clínica).
- **Deploy ainda não configurado.** Requisitos: servir `dist/` como SPA (toda rota desconhecida devolve `index.html`, inclusive `/reset-password` e `/accept-invite`), responder em `*.<APP_BASE_DOMAIN>` e nos domínios próprios verificados, e a API com `FRONTEND_URL`/CORS apontando para o front.
