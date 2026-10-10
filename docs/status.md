Atualizado em 10/10/2026.

# Status do front (bem-te-vi-web)

Retrato do que existe no código. Leia antes de começar uma tarefa. Regras de negócio e contrato da API: [`regras-de-negocio.md`](regras-de-negocio.md). Como o código é organizado: [`arquitetura.md`](arquitetura.md).

**Saúde do projeto:** `npm run typecheck` e `npm run lint` passam sem erros. Não há testes automatizados (a verificação até aqui foi manual, no navegador, contra a API local).

## Pronto, tela por tela

### Público

| Tela | Rota | O que faz |
|---|---|---|
| Login | `/login` | Marca da clínica do endereço; envia `host` junto (só usuários daquela clínica entram). Recebe `email` e aviso por `location.state` (vindo de reset, convite ou "esqueci"). Link "Esqueci minha senha" leva o email digitado. |
| Esqueci minha senha | `/esqueci-minha-senha` | `POST /auth/forgot-password` com `host`; sempre a mesma mensagem de sucesso. |
| Redefinir senha | `/reset-password?token=` | Lê o token uma vez e o remove da URL (`history.replaceState`). Em `200`, limpa a sessão local e vai ao login com o email e o aviso. "Link inválido" oferece pedir outro link. |
| Aceitar convite | `/accept-invite?token=` | Mesmo componente da redefinição (`TokenPasswordPage`), com o checkbox de Termos e Política (no `400` de versão desatualizada, recarrega as versões e desmarca o aceite). |
| Termos de Uso / Política de Privacidade | `/termos`, `/privacidade` | Mostram a versão vigente (`GET /public/legal`) e o texto cadastrado para ela em `src/legal/documents.ts`, com a data de vigência. Ainda não há texto oficial: aparece o aviso "texto em elaboração". |

**Cadastro de clínica:** saiu deste app em 10/10/2026 (rota `/cadastro`, `SignupPage`, `tenantsApi.signup` e o link "Cadastre sua clínica" do login). O app é whitelabel: o login entra na clínica do endereço. O cadastro passa para a landing page; ver [`cadastro-de-clinica-na-landing.md`](cadastro-de-clinica-na-landing.md).

### Área da clínica (logado)

| Tela | Rota | Permissão | O que faz |
|---|---|---|---|
| Início | `/inicio` | — | Painel com widgets por permissão: agenda de hoje (respeita `appointments:all`), cobranças atrasadas, atalhos (novo agendamento, novo paciente, nova cobrança). |
| Agenda | `/agenda` | `appointments:read` | Visões dia (colunas por profissional) e semana em grade de horários, lista no celular; filtro por profissional só com `appointments:all`; criar/editar/cancelar/mudar status; sem `all`, o profissional é sempre o próprio usuário. |
| Pacientes | `/pacientes` | `patients:read` | Lista paginada com busca (debounce) na URL. |
| Ficha do paciente | `/pacientes/:id` | `patients:read` | **Exportar dados (LGPD)** com `patients:export`: confirmação com aviso, baixa o JSON e oferece "Ver em formato legível" (imprimir/salvar PDF) sem nova chamada. Dados + abas Anamneses, Agendamentos (aviso "só a sua agenda" sem `all`) e Cobranças (com `billing:read`) e **Histórico de acessos** (com `audit:read`: lista cronológica com "carregar mais" e os campos alterados de cada edição). Remover com confirmação. |
| Novo/editar paciente | `/pacientes/novo`, `/pacientes/:id/editar` | `patients:write` | Formulário com máscaras (CPF, telefone, CEP), endereço; `409` de CPF de paciente removido oferece restaurar. |
| Pacientes removidos | `/pacientes/removidos` | `patients:write` | Lista, restauração e exportação de dados (com `patients:export`). |
| Preencher anamnese | `/pacientes/:id/anamneses/nova` | `patients:write` | Escolhe o formulário e preenche os campos dinâmicos. |
| Formulários de anamnese | `/anamnese/formularios`, `/novo`, `/:id` | `anamnesis_templates:manage` | Lista, construtor de campos (7 tipos, opções, obrigatório), pré-visualização, exclusão. |
| Financeiro | `/financeiro` | `billing:read` | Resumo (pendente, atrasado, cancelado, pago no período), lista filtrável, nova cobrança (`billing:write`). |
| Detalhe da cobrança | `/financeiro/cobrancas/:id` | `billing:read` | Pagamentos parciais/totais, cancelamento, edição. |
| Usuários | `/usuarios` | `users:manage` | Lista; criar por **convite** (padrão) ou com senha (com gerador); editar papel/status/duração; "Reenviar convite" para `invited`, "Redefinir senha" para os demais; regras de "acima de si" e último admin na UI. |
| Papéis e permissões | `/papeis` | `roles:manage` | CRUD de papéis com permissões agrupadas por área; marcar escrita/`all` marca a leitura; bloqueia o que o ator não tem. |
| Auditoria | `/auditoria` | `audit:read` | Trilha da clínica (LGPD): filtros por usuário (só com `users:manage`, que lista os usuários), ação, paciente (busca) e período; tabela com data, usuário, ação e link para a ficha; diálogo de detalhes (IP, navegador, campos alterados). Filtros na URL, exceto o paciente. |
| Configurações | `/configuracoes` | `tenant:manage` | Abas Dados, Agenda (durações), Marca (nome fantasia, cores com pré-visualização, **upload de logo** ou URL externa), Domínio (registro TXT, verificar agora) e **Encerrar conta** (exportar todos os dados com `patients:export`; pedir o encerramento com senha e confirmação; cancelar durante a carência). Salvar a marca re-tematiza o app na hora. |
| Minha conta | `/minha-conta` | — | Dados do usuário, trocar senha (troca o token), duração padrão própria (`appointments:write`). |
| Não encontrado | `*` | — | 404 dentro do shell. |

### Backoffice da plataforma (`platform:manage`)

| Tela | Rota | O que faz |
|---|---|---|
| Clínicas | `/plataforma/clinicas` | Lista com busca, contadores, suspender/reativar, selo "Encerramento pedido em DD/MM" e **excluir definitivamente** (só para clínica com pedido; confirmação digitando o subdomínio; o `409` da carência aparece com a data). Usuários da plataforma são levados para `/plataforma` e não acessam a área da clínica. |
| Minha conta | `/plataforma/minha-conta` | Igual à da clínica. |

### Transversal

- **Modo noturno:** chave "Modo noturno" no menu do usuário (canto superior direito, junto de Minha conta e Sair). A escolha fica salva no navegador (`localStorage` `btv.colorMode`); sem escolha, segue o tema do sistema. Vale também nas telas públicas. A versão legível da exportação de paciente fica sempre clara, para imprimir.
- **Menu lateral recolhível (desktop):** um chip redondo na borda do menu, na altura da logo, recolhe e expande o menu. Recolhido, cada item mostra o ícone com o rótulo embaixo (rótulo curto `shortLabel` em `navigation.tsx` quando o nome não cabe: "Anamnese", "Papéis", com o nome completo no tooltip), e os títulos de seção viram divisórias. A escolha fica salva no navegador (`localStorage` `btv.sidebarCollapsed`). No celular o menu continua temporário e sempre completo.
- **Busca global de pacientes (topo):** com `patients:read`, só na área da clínica (`src/layouts/PatientSearch.tsx`). A partir de 2 caracteres, com debounce de 400 ms, mostra até 6 pacientes (nome, CPF e telefone) e "Ver todos os N resultados". Escolher um paciente abre a ficha; Enter sem escolher abre `/pacientes?q=`. No desktop fica à esquerda da barra; no celular vira um ícone que abre a busca por cima da barra. Hoje acha por nome e CPF; **telefone depende da task 12 da API**.
- **Aviso de encerramento da conta:** com pedido ativo, um banner em todas as telas da clínica para quem tem `tenant:manage`, com "Exportar dados" e "Cancelar encerramento". Os demais usuários não veem (a API só informa o pedido a quem tem `tenant:manage`).
- **Aceite pendente de Termos/Política (LGPD):** com `pendingLegalDocuments` não vazio em `/auth/me`, o `RequireAuth` mostra um modal que não fecha (`PendingLegalScreen`) no lugar do app, tanto da clínica quanto da plataforma. "Aceitar e continuar" envia as duas versões vigentes a `POST /auth/me/legal-acceptances`; "Sair" desloga. Textos diferentes para os dois documentos pendentes e para versão nova de um só.
- Whitelabel por endereço (subdomínio / domínio próprio; `?tenant=` em dev), tema MUI montado a partir das cores da clínica.
- Sessão com `GET /auth/me` sempre fresco; 401 desloga com aviso "sessão expirada"; 400 nunca desloga.
- Telas e ações escondidas por permissão; acesso direto a rota sem permissão mostra "Acesso negado".
- Divisão por rota (lazy) com chunk `vendor` separado.

## Tasks da API

Todas as 11 tasks recebidas foram concluídas e conferidas no código em 09/10/2026. Os arquivos saíram de `docs/changes/` do front nessa data; os originais continuam na pasta da API (`../bem-te-vi-api/docs/changes/`). Tasks novas voltam a entrar em `docs/changes/`, com um `00-indice.md`.

**Aberta:** task 12, busca de pacientes também pelo telefone (pedido do front para a API). Ver [`changes/00-indice.md`](changes/00-indice.md).

| # | Task | Situação | Onde está no código |
|---|---|---|---|
| 01 | Enviar o host no login | **Feita** | `src/api/auth.ts` (`login` envia `host: getBrandingHost()`), `src/theme/brandingHost.ts` |
| 02 | Agenda própria × todas (`appointments:all`) | **Feita** | `SchedulePage`, `AppointmentDialog`, `TodayAgenda`, `PatientAppointmentsTab`, `permissionGroups.ts` |
| 03 | Esqueci minha senha | **Feita** | `src/pages/ForgotPasswordPage.tsx`, link no `LoginPage` |
| 04 | Redefinir senha | **Feita** | `src/pages/auth/ResetPasswordPage.tsx` + `TokenPasswordPage.tsx` |
| 05 | Convite de usuário | **Feita** (+ aceite de termos) | `UserDialog.tsx`, `userStatus.ts`, `AcceptInvitePage.tsx` |
| 06 | Upload do logo | **Feita** | `src/pages/settings/LogoSection.tsx`, `tenantsApi.uploadLogo/deleteLogo` |
| 07 | Atualizar `regras-de-negocio.md` | **Feita** em 09/10/2026 (ver "Correções" abaixo), inclusive todos os adendos (08 a 11) | `regras-de-negocio.md` |
| 08 | Trilha de auditoria (`audit:read`) | **Feita** em 09/10/2026. A coluna de paciente mostra "Abrir ficha" em vez do nome (ver limitações) | `src/api/audit.ts`, `src/pages/audit/`, `src/pages/patients/audit/PatientAuditTab.tsx`, `main.tsx` (sem refetch no foco para pacientes) |
| 09 | Aceite de Termos e Política | **Feita** em 09/10/2026. Só faltam os textos oficiais (jurídico) | `src/auth/PendingLegalScreen.tsx`, `guards.tsx`, `src/legal/documents.ts`, `api/legal.ts`, `TokenPasswordPage` (o cadastro saiu do app em 10/10/2026) |
| 10 | Exportar dados do paciente (`patients:export`) | **Feita** em 09/10/2026, com o formato legível opcional | `src/pages/patients/export/`, `patientsApi.export`, `src/lib/download.ts`, `RemovedPatientsPage` |
| 11 | Encerramento de conta da clínica | **Feita** em 09/10/2026, com todos os critérios de aceite testados, inclusive a exclusão definitiva | `src/pages/settings/closure/`, `src/pages/platform/DeleteTenantDialog.tsx`, `TenantsPage`, `ShellLayout` (banner) |

## O que falta

1. **LGPD:** todas as tasks entregues (08 a 11). Pendências: textos oficiais (abaixo) e as duas propostas à API de LGPD.
2. Textos oficiais dos Termos de Uso e da Política de Privacidade (cadastrar por versão em `src/legal/documents.ts`, TODO no arquivo). Ao trocar um texto, a API precisa subir `LEGAL_TERMS_VERSION` / `LEGAL_PRIVACY_VERSION`.
3. Landing page do produto: **fora deste repositório** (decidido em 10/10/2026). Ela faz o cadastro de clínicas; o contrato e as regras estão em [`cadastro-de-clinica-na-landing.md`](cadastro-de-clinica-na-landing.md).
4. Testes automatizados (nenhum existe).
5. Build/deploy de produção: não há configuração de hospedagem nem de fallback de SPA (ver [`arquitetura.md`](arquitetura.md#build-e-deploy)).
6. **Busca por telefone:** task 12 aguardando a API (o front só precisa trocar os textos de ajuda depois).

## Limitações e bugs conhecidos

- **Nome do paciente na auditoria:** a API devolve só `patientId`, e buscar o nome geraria um `patient.view` por linha. A tela mostra "Abrir ficha" (ou o nome, quando filtrada por paciente). Proposta para a API em [`proposta-nome-do-paciente-na-auditoria.md`](proposta-nome-do-paciente-na-auditoria.md).
- **Painel da plataforma sem filtro de encerramento:** a lista não filtra nem ordena por pedido e não traz a data de liberação. O botão "Excluir definitivamente" aparece para toda clínica com pedido, e a carência é conferida pela API (`409` com a data). Proposta em [`proposta-encerramentos-no-painel-da-plataforma.md`](proposta-encerramentos-no-painel-da-plataforma.md).
- **Usuários da plataforma também passam pelo aceite de Termos/Política**, porque a API informa a pendência para eles. Ver decisões em aberto.
- **Nome do arquivo de exportação** é montado pelo front (`paciente-<id>.json`): a API não expõe `Content-Disposition` no CORS (`app.enableCors()` sem `exposedHeaders`). Se um dia a API quiser definir o nome, precisa expor o header.
- **Impressão do formato legível** não foi testada pela automação (abre a janela de impressão do sistema). As regras de `@media print` em `PatientExportView` escondem o app e soltam o diálogo para imprimir todas as páginas; vale conferir manualmente.
- **Exportar paciente removido** fica na tela de removidos, que exige `patients:write`. Quem tem só `patients:export` não chega lá (os admins têm as duas).
- **Filtro por usuário na auditoria** só aparece para quem também tem `users:manage` (a lista de usuários exige essa permissão). Lista os primeiros 100 usuários.
- **Telas de paciente geram registros na trilha:** cada abertura de ficha, lista ou aba de anamneses é um registro. Para não poluir, as consultas de pacientes e de fichas não são refeitas ao voltar o foco para a aba (`setQueryDefaults` em `main.tsx`). Depois de salvar uma edição, a ficha é relida, e isso conta como nova visualização. O painel inicial também consulta a lista de pacientes (para o total) e gera um "Pesquisou pacientes" a cada abertura. A busca global do topo gera um "Pesquisou pacientes" por termo buscado (mínimo de 2 caracteres e 400 ms sem digitar, para não registrar letra por letra).
- **Nome de quem preencheu a anamnese:** a API devolve só `filledByUserId`. O front resolve o nome pela lista de profissionais; sem `appointments:all` essa lista só tem o próprio usuário, então o nome de outros não aparece. Sugestão para a API: devolver `filledBy { id, name }`.
- **Aceite pendente no meio da sessão:** o `/auth/me` é relido ao abrir o app e ao voltar o foco para a aba (`staleTime` 30 s). Se a API publicar uma versão nova, quem já está com o app aberto só vê o modal na próxima releitura, não na hora.
- **Mensagem do 400 de versão desatualizada** continua visível no convite depois que o aceite é desmarcado; some no próximo envio.
- **Cache HTTP da marca pública (60 s):** o front contorna atualizando o cache local (`applyBrandingToCache`) depois de salvar; em outra aba ou dispositivo a marca nova pode levar até 1 min.
- **Datas "de hoje" em UTC na API:** perto da meia-noite, uma cobrança pode aparecer como atrasada antes da hora (seção 14 das regras).
- **Sem refresh token:** a sessão dura 1 dia e então pede novo login.
- **Rate limit de 5/min** no login e fluxos de senha: testes manuais repetidos esbarram em "Muitas tentativas".
- **Labels do MUI em campos não controlados:** após `setValue`/`reset`, o label pode sobrepor o valor. Padrão adotado: `slotProps.inputLabel.shrink`, `key` de remontagem ou `Controller`.

## Decisões de produto em aberto

- Banner de encerramento de conta para usuários sem `tenant:manage`: aviso simples ou nada (task 11).
- Textos legais oficiais (dependem de orientação jurídica).
- Proposta à API: nome do paciente nos registros da auditoria.
- Proposta à API: filtro e data de liberação dos encerramentos no painel da plataforma.
- Proposta à API: validação do cadastro de clínica antes de abri-lo na landing (nome vazio, mensagens em português, subdomínios reservados, limite de senha). Ver [`proposta-validacao-do-cadastro-de-clinica.md`](proposta-validacao-do-cadastro-de-clinica.md).
- Aviso de encerramento para usuários sem `tenant:manage`: hoje não aparece nada, porque a API não informa. Se o produto quiser avisar toda a equipe, a API precisa expor o pedido (ex.: em `/auth/me`).
- A equipe da plataforma deve aceitar os mesmos Termos/Política das clínicas? Hoje aceita, porque a API informa a pendência.
- Escopo do médico sobre pacientes e evolução clínica: há propostas em `../bem-te-vi-api/docs/decisoes/` ainda sem reflexo no front.

## Correções no `regras-de-negocio.md` (09/10/2026)

O documento estava de 30/09/2026, antes das tasks 01–06 e da LGPD. Corrigido conferindo o código da API:

- **Cabeçalho:** nota de revisão apontando para este status e para as tasks de LGPD da API.
- **2.3 Rate limit:** 5/min também em `forgot-password`, `reset-password` e `accept-invite`.
- **3.1 Login:** campo `host` e a regra "só usuários da clínica do endereço".
- **3.2 Sessão:** `pendingLegalDocuments` na resposta de `GET /auth/me`.
- **3.3 Senha:** o parágrafo "Fora do MVP: esqueci minha senha e convite" foi trocado pelos fluxos de recuperação e convite, com as rotas fixas `/reset-password` e `/accept-invite`.
- **4.1 Catálogo:** `appointments:read/write` passam a ser "própria agenda"; novas `appointments:all`, `audit:read` e `patients:export`.
- **5.1 Signup:** `legalAcceptance` obrigatório.
- **5.3 Marca:** "não há upload" trocado pelo upload/remoção de logo e pela regra de que o `PATCH logoUrl` descarta o upload.
- **6 Usuários:** senha opcional (convite), `POST /users/:id/invite`, `invited` com fluxo de aceite.
- **6.1 Profissionais:** sem `appointments:all`, só o próprio usuário.
- **10 Agenda:** nova seção 10.0 com o escopo e a tabela de respostas.
- **13 Mapa de telas:** esqueci minha senha, redefinir senha, aceitar convite, termos/privacidade.
- **14 Lacunas:** removidos "sem esqueci minha senha/convite" e "sem upload de logo"; incluída a falta do nome de quem preencheu a anamnese.
- **15 Tipos:** `PermissionKey` atualizado; novos `LoginRequest`, `ForgotPasswordRequest`, `TokenPasswordRequest`, `AcceptInviteRequest`, `TokenPasswordResponse`, `LegalDocument`, `LegalAcceptance`, `PublicLegal`; `Me.pendingLegalDocuments`.
- **16 Ambiente:** comando Docker com `--profile app`, Mailpit e `FRONTEND_URL`.
- **17 LGPD (nova):** resumo de termos, auditoria, exportação e encerramento, apontando para as tasks da API.
