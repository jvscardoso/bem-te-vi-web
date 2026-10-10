# bem-te-vi — Regras de negócio e contrato da API (guia para o frontend)

Documento de referência para desenvolver o frontend do MVP. Descreve **o que o sistema faz, quais regras a API impõe e como cada tela deve conversar com ela**. Fonte da verdade: o código da `bem-te-vi-api` (NestJS + Prisma). Quando este documento e o código divergirem, vale o código.

> **Revisado em 09/10/2026** para refletir as mudanças da API das tasks 01 a 06 (`../bem-te-vi-api/docs/changes/`) e a primeira parte da LGPD (aceite de Termos e Política). As demais mudanças de LGPD (trilha de auditoria, exportação de paciente, encerramento de conta) estão resumidas na seção 17 e detalhadas nas tasks 08 a 11 da API (`../bem-te-vi-api/docs/changes/`). O que foi corrigido aqui está listado em `docs/status.md`.

---

## 1. Visão geral do produto

O bem-te-vi é um **SaaS whitelabel de gestão de clínicas** (consultórios, clínicas, hospitais pequenos). Cada clínica é um **tenant** isolado, com:

- **Marca própria** (nome fantasia, logo, cores) e endereço próprio (subdomínio `clinica.bemtevi.com.br` ou domínio próprio verificado por DNS).
- **Usuários e papéis** com permissões configuráveis (RBAC).
- **Pacientes** com ficha de **anamnese** baseada em formulários configuráveis pela clínica.
- **Agenda** de atendimentos por profissional, sem conflito de horário.
- **Financeiro**: cobranças e pagamentos (sem emissão de nota fiscal no MVP).

Existe ainda um **backoffice da plataforma** (para a equipe do bem-te-vi) que lista e suspende/reativa clínicas — sem acesso a nenhum dado clínico.

### Áreas do frontend

| Área | Quem usa | Autenticação |
|---|---|---|
| Cadastro de clínica (signup) | Dono de clínica nova | Pública |
| Login tematizado | Todos os usuários de uma clínica | Pública |
| App da clínica | Usuários do tenant, conforme permissões | JWT |
| Backoffice da plataforma | Equipe interna (`platform:manage`) | JWT |

---

## 2. Convenções gerais da API

- **Base URL (dev):** `http://localhost:3000`. CORS liberado.
- **Formato:** JSON. Datas/horas em **ISO 8601** (`2026-10-01T14:00:00.000Z`). Campos só-data (`birthDate`, `dueDate`) aceitam `YYYY-MM-DD` e voltam como `YYYY-MM-DDT00:00:00.000Z`.
- **IDs:** UUID v4.
- **Status de sucesso:** `POST` → `201` (exceto `POST /auth/login` e `POST .../domain/verify`, que dão `200`); `GET`/`PATCH`/`DELETE` → `200`. Os `DELETE` não devolvem corpo (recarregue a lista/detalhe).
- **Rotas de negócio aninhadas sob o tenant:** `/tenants/:tenantId/...`. O `tenantId` vem do login (`user.tenantId`). Usar outro `tenantId` na URL → `403`.
- **Validação estrita:** campo desconhecido no body ou na query → `400`. Não envie campos extras (ex.: não mande `id`, `createdAt`, `tenantId` no body).
- **`null` vs ausente em PATCH:** ausente = não mexe; `null` = limpa o campo (onde permitido — ver cada recurso).
- **Dinheiro em centavos** (`amountCents: 15000` = R$ 150,00). O frontend converte para exibir e para enviar.
- **CPF só com dígitos** na resposta. O frontend formata (`123.456.789-01`) para exibir; pode enviar com ou sem pontuação.
- **"Excluir" quase nunca apaga:** paciente = soft delete (restaurável); agendamento e cobrança = cancelamento. Só papéis e formulários de anamnese são apagados de fato.

### 2.1 Paginação

Todas as listagens paginadas usam o mesmo envelope:

```json
{
  "data": [ ... ],
  "meta": { "total": 57, "page": 1, "pageSize": 20, "totalPages": 3 }
}
```

| Listagem | `pageSize` padrão | máximo | Busca `q` |
|---|---|---|---|
| Pacientes / pacientes removidos | 20 | 100 | Sim |
| Usuários | 20 | 100 | Não |
| Papéis | 20 | 100 | Não |
| Agenda | 50 | 200 | Não (filtros) |
| Cobranças | 20 | 100 | Não (filtros) |
| Clínicas (backoffice) | 20 | 100 | Sim |

`page` começa em 1. Página além da última devolve `data: []` com `total` correto. Ordenação é sempre estável (desempate por id), então páginas não repetem nem pulam itens.

**Não paginadas** (retornam array direto): formulários de anamnese, fichas de anamnese de um paciente, pagamentos de uma cobrança.

### 2.2 Erros

Formato padrão do NestJS:

```json
{ "statusCode": 409, "error": "Conflict", "message": "O profissional já possui um agendamento neste horário" }
```

- `message` pode ser **string** ou **array de strings** (erros de validação `400` — mostre todos, ex.: lista de campos inválidos da anamnese). Trate os dois casos.
- As mensagens já vêm em **português** e são exibíveis ao usuário.
- Casos especiais com campos extras estão documentados em cada recurso (ex.: `removedPatientId`).

| Status | Significado | O que o front faz |
|---|---|---|
| `400` | Validação / regra de entrada | Mostrar `message` junto ao formulário |
| `401` | Token ausente, inválido, expirado, usuário desativado ou clínica suspensa | Limpar sessão e ir para o login |
| `403` | Sem permissão ou tentativa de acessar outro tenant / escalar privilégio | Mostrar aviso; não deveria acontecer se a UI respeitar as permissões |
| `404` | Recurso não existe (ou é de outro tenant) | Tela/aviso de "não encontrado" |
| `409` | Conflito de regra de negócio (duplicado, conflito de horário, transição inválida, em uso) | Mostrar `message` |
| `429` | Rate limit | "Muitas tentativas, aguarde um minuto" |

### 2.3 Rate limit

- Global: **100 req/min por IP**.
- `POST /auth/login`, `PATCH /auth/me/password`, `POST /auth/forgot-password`, `POST /auth/reset-password` e `POST /auth/accept-invite`: **5 req/min**.
- `POST /tenants` (signup): **10 req/min**.

Evite polling agressivo e requisições em cascata desnecessárias.

---

## 3. Autenticação e sessão

### 3.1 Login

`POST /auth/login` (público)

```json
{ "email": "fulano@clinica.com", "password": "...", "host": "clinica-demo.bemtevi.com.br" }
```

- `host` (opcional, até 255): o endereço de onde a pessoa está entrando, **o mesmo valor** enviado a `GET /public/branding?host=` (seção 5.4). Se ele aponta para uma clínica, **só usuários dessa clínica entram**; usuário de outra clínica recebe o mesmo `401` "Credenciais inválidas". Se não aponta para nenhuma clínica (domínio principal, endereço desconhecido, clínica suspensa), qualquer usuário ativo entra.

Resposta `200`:

```json
{
  "accessToken": "eyJ...",
  "user": {
    "id": "uuid", "name": "Fulano", "email": "fulano@clinica.com",
    "tenantId": "uuid", "roleId": "uuid",
    "permissions": ["patients:read", "patients:write", "..."]
  }
}
```

- Email é case-insensitive (a API normaliza para minúsculas).
- Qualquer falha (email inexistente, senha errada, usuário desativado/convidado, clínica suspensa) → `401` com a **mesma mensagem genérica** `"Credenciais inválidas"`. Não tente distinguir os casos na UI.
- Enviar o token em toda requisição: `Authorization: Bearer <accessToken>`.

### 3.2 Sessão

- JWT expira em **1 dia** (configurável). **Não há refresh token** nem logout no servidor: logout = descartar o token no cliente. Em `401`, redirecione para o login.
- **Estado sempre fresco:** a cada requisição a API relê usuário, status da clínica e permissões do banco. Se um admin desativar o usuário, suspender a clínica ou mudar as permissões do papel, o efeito é imediato (`401`/`403`) mesmo com token válido.
- As `permissions` do login podem ficar desatualizadas. Para recarregar, use:

`GET /auth/me` →

```json
{ "userId": "uuid", "tenantId": "uuid", "roleId": "uuid", "permissions": ["..."],
  "name": "Fulano", "email": "fulano@clinica.com", "role": { "id": "uuid", "name": "Admin" },
  "pendingLegalDocuments": [] }
```

`pendingLegalDocuments`: `("terms" | "privacy")[]`, os documentos cuja versão vigente o usuário ainda não aceitou (seção 17). A API **não** bloqueia as outras rotas por isso; o bloqueio é do front.

Recomendação: chamar `/auth/me` ao abrir o app (com token salvo) e ao voltar o foco para a aba, e usar essa resposta para o cabeçalho (nome, papel) e para montar menus e habilitar ações.

### 3.3 Senha

**Trocar a própria senha** — `PATCH /auth/me/password` (qualquer usuário logado; limite de 5 req/min):

```json
{ "currentPassword": "...", "newPassword": "min8chars" }
```

- Resposta `200`: `{ "accessToken": "..." }`. **Substitua o token salvo por este**: a troca encerra todas as sessões do usuário (em qualquer dispositivo), inclusive a que fez a troca.
- Senha atual errada → `400` "Senha atual incorreta" (é `400` de propósito, não `401`: não deslogue o usuário).
- `newPassword`: 8 a 200 caracteres.

**Redefinir a senha de outro usuário (admin)** — ver seção 6.

**Encerramento de sessões:** após troca ou redefinição, qualquer token anterior daquele usuário recebe `401` com "Sessão encerrada pela troca de senha; faça login novamente".

**Esqueci minha senha** — `POST /auth/forgot-password` (pública, 5 req/min) com `{ "email": "...", "host": "..." }` (`host` = o mesmo do login):

- Resposta **sempre `204`**, exista a conta ou não (a rota não revela emails cadastrados). Mostre sempre a mesma mensagem.
- O link só sai para contas que conseguiriam logar: ativas, de clínica ativa e, se o `host` aponta para uma clínica, dessa clínica.
- O email leva o nome da clínica e um link de **1 hora** para a rota do front **`/reset-password?token=...`** (em dev, também `&tenant=<subdomínio>`). Pedir outro link invalida o anterior.

**Redefinir senha (link do email)** — `POST /auth/reset-password` (pública, 5 req/min) com `{ "token": "...", "password": "min8chars" }`:

- `200 { "email": "..." }`: senha trocada; **todas as sessões** do usuário são encerradas.
- `400 "Link inválido ou expirado"`: token inexistente, já usado (uso único), vencido ou de conta desativada depois do pedido.
- `400` (array): senha fora de 8–200 caracteres.

**Aceitar convite (link do email)** — `POST /auth/accept-invite` (pública, 5 req/min) com `{ "token": "...", "password": "min8chars", "legalAcceptance": { "termsVersion": "1", "privacyVersion": "1" } }`:

- O link de convite vale **7 dias** e aponta para a rota do front **`/accept-invite?token=...`** (em dev, também `&tenant=`). Um reenvio (seção 6) invalida o link anterior.
- `legalAcceptance` é obrigatório: as versões vigentes de `GET /public/legal` (seção 17). Versão diferente da vigente → `400` "Aceite a versão vigente dos Termos de Uso (…) e da Política de Privacidade (…)".
- `200 { "email": "..." }`: conta ativada (`status: active`) com a senha escolhida.
- `400 "Link inválido ou expirado"`: token inexistente, já usado, vencido, substituído por reenvio ou de conta desativada antes do aceite.

> As rotas `/reset-password` e `/accept-invite` do front são montadas pela API nos emails (`FRONTEND_URL`): **não podem mudar** sem mudar a API. Todos esses erros são `400`, de propósito, para não deslogar ninguém.

---

## 4. Permissões (RBAC)

### 4.1 Catálogo

| Chave | Libera |
|---|---|
| `patients:read` | Ver pacientes, fichas de anamnese e **listar/ler formulários de anamnese** |
| `patients:write` | Criar/editar/remover/restaurar pacientes, **ver removidos**, preencher anamnese |
| `appointments:read` | Ver a **própria** agenda (agendamentos em que o usuário é o profissional) |
| `appointments:write` | Criar/editar/cancelar agendamentos da **própria** agenda; ajustar a própria duração padrão de atendimento |
| `appointments:all` | Estende `read`/`write` à agenda de **todos** os profissionais (recepção, dono). Ver seção 10.0 |
| `users:manage` | Listar/criar/editar usuários do tenant |
| `roles:manage` | Listar/criar/editar/apagar papéis |
| `tenant:manage` | Dados da clínica, marca, domínio próprio |
| `anamnesis_templates:manage` | Criar/editar/apagar formulários de anamnese |
| `billing:read` | Ver cobranças, pagamentos e resumo financeiro |
| `billing:write` | Criar/editar/cancelar cobranças e registrar pagamentos |
| `audit:read` | Ver a trilha de auditoria (LGPD, seção 17) |
| `patients:export` | Exportar todos os dados de um paciente (LGPD, seção 17) |
| `platform:manage` | Backoffice da plataforma (nunca concedida a clínicas) |

- Quando uma rota exige mais de uma permissão, **todas** são necessárias.
- Permissões são **por papel**; cada usuário tem exatamente **um papel**.
- O front deve **esconder/desabilitar** telas e botões sem a permissão correspondente, mas a API é quem garante (retorna `403`).

### 4.2 "Administrador" do tenant

É quem está **ativo** e tem papel com **`users:manage` + `roles:manage` + `tenant:manage`** (definido pelas permissões, não pelo nome do papel). No signup, o dono recebe o papel **"Admin"** com todas as permissões do catálogo, exceto `platform:manage`.

### 4.3 Regras de conta (valem para usuários e papéis)

1. **Sem escalada de privilégio (`403`):**
   - Só se concede o que se possui: criar/editar um papel com permissões, ou atribuir a alguém um papel, exige que o ator tenha **todas** as permissões envolvidas.
   - Ninguém altera um usuário ou papel **"acima" de si** (cujo papel tem alguma permissão que o ator não tem) — nem para renomear, desativar ou apagar.
   - Alterar a si mesmo é permitido dentro dessas regras (dá para se rebaixar, não para se promover).
2. **Sempre existe um administrador ativo (`409`):** desativar o último admin, trocar o papel dele ou remover permissões administrativas do papel dele é recusado.

**Na UI:** ao montar o seletor de permissões de um papel ou o seletor de papel de um usuário, desabilite o que envolve permissões que o usuário logado não tem, e trate `403`/`409` exibindo a mensagem.

---

## 5. Clínica (tenant), signup e marca

### 5.1 Signup de clínica

`POST /tenants` (público)

> **Tela na landing page, não no `bem-te-vi-web`** (desde 10/10/2026): o app é whitelabel e o login entra na clínica do endereço. Guia para a landing: [`cadastro-de-clinica-na-landing.md`](cadastro-de-clinica-na-landing.md).

```json
{
  "name": "Clínica Exemplo",
  "subdomain": "clinica-exemplo",
  "customDomain": "agenda.clinicaexemplo.com.br",
  "defaultAppointmentDurationMinutes": 30,
  "minAppointmentDurationMinutes": 15,
  "owner": { "name": "Fulano", "email": "fulano@clinica.com", "password": "min8chars" },
  "legalAcceptance": { "termsVersion": "1", "privacyVersion": "1" }
}
```

| Campo | Regra |
|---|---|
| `name` | obrigatório, até 150 |
| `subdomain` | obrigatório, até 63, só `a-z`, `0-9` e `-`; único (`409` "Este subdomínio já está em uso") |
| `customDomain` | opcional, domínio válido (FQDN), normalizado para minúsculas; único |
| `defaultAppointmentDurationMinutes` | opcional, inteiro 5–1440, padrão **30** |
| `minAppointmentDurationMinutes` | opcional, inteiro 5–1440, padrão **5**; não pode ser maior que a duração padrão (`400`) |
| `owner.name` / `owner.email` / `owner.password` | obrigatórios; senha ≥ 8; email único globalmente (`409`) |
| `legalAcceptance` | **obrigatório** (LGPD): as versões vigentes de `GET /public/legal`; versão diferente → `400` (seção 17) |

Cria numa transação: clínica + papel "Admin" + usuário dono. Resposta: `{ tenant, role: { id, name }, owner }`. **Não devolve token** — em seguida o front deve chamar `POST /auth/login` com as credenciais do dono.

> Email é **único em toda a plataforma**, não por clínica: a mesma pessoa não pode ter conta em duas clínicas com o mesmo email.

### 5.2 Dados da clínica (`tenant:manage`)

- `GET /tenants/:tenantId` → dados da clínica + `branding` (ou `null`) + `closureRequestedAt` (pedido de encerramento, seção 17).
- `PATCH /tenants/:tenantId` → mesmos campos do signup, todos opcionais, **sem** `owner` e **sem** `status`.
  - `minAppointmentDurationMinutes` não pode ficar acima da duração padrão, nem acima da duração própria de algum profissional (`400` com a quantidade de profissionais afetados).
  - A clínica **não pode suspender a si mesma** (status é só pelo backoffice).

### 5.3 Marca (whitelabel)

`PATCH /tenants/:tenantId/branding` (`tenant:manage`)

```json
{ "tradeName": "Clínica Sorriso", "logoUrl": "https://...", "primaryColor": "#1A73E8", "secondaryColor": "#F4B400" }
```

- Envio parcial; `null` limpa.
- Cores **exatamente** `#RRGGBB`. `logoUrl` só **https** (URL externa).

**Upload do logo** — `PUT /tenants/:tenantId/branding/logo` (`tenant:manage`), `multipart/form-data` com o campo `file`:

- **PNG, JPEG ou WebP**, até **1 MB**; o tipo é verificado pelo conteúdo, não pela extensão. **SVG é recusado** (pode conter script).
- `200` com a marca atualizada; `logoUrl` passa a apontar para `GET /public/logos/:id` (pública, serve direto num `<img>`).
- Erros: `400` formato não aceito ou sem arquivo; `413` acima de 1 MB; `403` sem permissão.
- **Cada upload gera uma URL nova** e a anterior passa a dar `404` (a imagem é cacheada para sempre pelo navegador).
- `DELETE /tenants/:tenantId/branding/logo` → `200` com `logoUrl: null`.
- Definir `logoUrl` pelo `PATCH /branding` (URL externa ou `null`) **descarta** o logo enviado. Por isso o front nunca reenvia `logoUrl` ao salvar nome e cores.

### 5.4 Resolver a marca antes do login

`GET /public/branding?host=<window.location.host>` (público)

Resposta: `{ name, tradeName, logoUrl, primaryColor, secondaryColor }` (campos de marca podem ser `null` → usar tema padrão do bem-te-vi). Cache de 60s.

- Resolve por **domínio próprio verificado** ou por **subdomínio** (`<sub>.<APP_BASE_DOMAIN>`). Em dev, sem `APP_BASE_DOMAIN`, um host sem ponto é o próprio subdomínio (ex.: `?host=clinica-exemplo`).
- Porta e maiúsculas são ignoradas.
- `404` = clínica inexistente, suspensa ou domínio não verificado → mostrar login com tema padrão ou página "clínica não encontrada".
- Exibir `tradeName ?? name` como nome da clínica.

### 5.5 Domínio próprio (verificação por DNS)

Um `customDomain` só passa a exibir a marca depois de verificado.

- `GET /tenants/:tenantId/domain` (`tenant:manage`) →
  ```json
  { "domain": "agenda.clinica.com.br", "verified": false, "verifiedAt": null,
    "record": { "type": "TXT", "name": "_bemtevi-challenge.agenda.clinica.com.br", "value": "a1b2..." } }
  ```
  `404` se a clínica não tem domínio próprio configurado.
- `POST /tenants/:tenantId/domain/verify` → consulta o DNS agora; **sempre `200`**, com `verified: false` enquanto não propagou (não é erro — mostre "ainda não encontrado, tente mais tarde").
- Trocar o `customDomain` gera novo desafio e zera a verificação; reenviar o mesmo valor não altera; `null` remove.

**Tela sugerida:** campo de domínio → instruções com nome/valor do TXT (botões de copiar) → botão "Verificar agora" → selo "Verificado".

---

## 6. Usuários (`users:manage`)

Rotas sob `/tenants/:tenantId/users`.

| Ação | Rota |
|---|---|
| Listar (paginado, por nome) | `GET /users?page&pageSize` |
| Detalhe | `GET /users/:id` |
| Criar | `POST /users` |
| Editar | `PATCH /users/:id` |
| Redefinir senha de outro usuário | `PATCH /users/:id/password` |
| Reenviar convite | `POST /users/:id/invite` |
| Ajustar a própria duração | `PATCH /users/me/appointment-settings` (exige só `appointments:write`) |

**Criar:**

```json
{ "name": "Dra. Ana", "email": "ana@clinica.com", "password": "min8chars", "roleId": "uuid", "defaultAppointmentDurationMinutes": 50 }
```

- **`password` é opcional:**
  - **sem senha = convite:** o usuário nasce `invited`, não consegue logar e recebe um email com link de **7 dias** para `/accept-invite` (seção 3.3);
  - **com senha** (8–200): nasce `active` e nenhum email é enviado.

**Reenviar convite:** `POST /users/:id/invite` → `204` (novo email; o link anterior deixa de valer); `409` se o usuário não está `invited`; `403` se ele está "acima" do ator; `404` se não existe nesta clínica.

**Editar:** `name`, `email`, `roleId`, `status`, `defaultAppointmentDurationMinutes` (todos opcionais; **senha não é editável**).

Regras:
- Email único globalmente, gravado em minúsculas (`409` se já existe).
- `roleId` precisa ser um papel deste tenant (`400`).
- `status`: `active` | `invited` | `disabled`. Só `active` consegue logar. **Não existe exclusão de usuário** — desative (`disabled`). `invited` é o convite pendente: sai dele ao aceitar o convite pelo link do email (vira `active`).
- `defaultAppointmentDurationMinutes`: 5–1440 ou `null` (usa o padrão da clínica); não pode ser menor que o mínimo da clínica (`400`).
- Regras de conta da seção 4.3 (escalada de privilégio e último admin).
- A resposta nunca contém senha. Campos: `id, tenantId, roleId, name, email, status, defaultAppointmentDurationMinutes, lastLoginAt, createdAt, updatedAt`.

**Redefinir senha (admin):** `PATCH /users/:id/password` com `{ "password": "min8chars" }` → `204` sem corpo.
- Encerra todas as sessões do usuário-alvo (ele precisa logar de novo com a senha nova).
- Não vale para si mesmo (`400`): a própria senha se troca em `PATCH /auth/me/password`, que exige a senha atual.
- Não vale para usuário "acima" do ator (`403`, seção 4.3).

**Ajuste da própria duração:** `PATCH /users/me/appointment-settings` com `{ "defaultAppointmentDurationMinutes": 50 }` ou `null`. Qualquer profissional com `appointments:write` pode usar (tela "Minhas preferências").

### 6.1 Lista de profissionais (para agendar)

`GET /tenants/:tenantId/professionals` — exige só **`appointments:read`** (a recepção consegue usar sem `users:manage`).

```json
[
  { "id": "uuid", "name": "Dra. Ana", "defaultAppointmentDurationMinutes": 50, "effectiveAppointmentDurationMinutes": 50 },
  { "id": "uuid", "name": "Dr. Bruno", "defaultAppointmentDurationMinutes": null, "effectiveAppointmentDurationMinutes": 30 }
]
```

- Só usuários **ativos** (os únicos que podem receber agendamentos), por nome. Array simples, sem paginação.
- **Sem `appointments:all`**, a lista traz só o próprio usuário (array com 1 item).
- `effectiveAppointmentDurationMinutes` = duração própria ou, se não houver, a da clínica. Use para prever o fim ao agendar só com o início.
- Campos mínimos de propósito: sem email, status ou papel.

---

## 7. Papéis (`roles:manage`)

Rotas sob `/tenants/:tenantId/roles`: `GET` (paginado), `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id`.

**Catálogo de permissões:** `GET /permissions` (`roles:manage`) → `[{ "id", "key", "description" }]`, ordenado por `key`. Use os `id`s em `permissionIds` e a `description` como rótulo no editor de papéis. As permissões `platform:*` não aparecem para clínicas.

```json
{ "name": "Recepção", "description": "Agenda e cadastro", "permissionIds": ["uuid", "uuid"] }
```

- `name` até 80, **único no tenant** (`409`).
- `permissionIds`: ids do catálogo, sem repetição; id inexistente → `400`. No `PATCH`, enviar `permissionIds` **substitui** a lista inteira.
- Resposta inclui as permissões expandidas:
  ```json
  { "id": "...", "name": "Recepção", "description": "...",
    "permissions": [ { "roleId": "...", "permissionId": "...", "permission": { "id": "...", "key": "patients:read", "description": "Ver pacientes" } } ] }
  ```
- `DELETE` apaga de fato (`200` sem corpo). Papel com usuários vinculados → `409` "Operação bloqueada: o registro está em uso por outros dados".
- Regras de conta da seção 4.3.

---

## 8. Pacientes

Rotas sob `/tenants/:tenantId/patients`.

| Ação | Rota | Permissão |
|---|---|---|
| Listar/buscar | `GET /patients?q&page&pageSize` | `patients:read` |
| Detalhe | `GET /patients/:id` | `patients:read` |
| Criar | `POST /patients` | `patients:write` |
| Editar | `PATCH /patients/:id` | `patients:write` |
| Remover (soft delete) | `DELETE /patients/:id` | `patients:write` |
| Listar removidos | `GET /patients/removed?q&page&pageSize` | `patients:write` |
| Restaurar | `POST /patients/:id/restore` | `patients:write` |
| Preencher anamnese | `POST /patients/:id/anamnesis-records` | `patients:write` |
| Histórico de anamnese | `GET /patients/:id/anamnesis-records` | `patients:read` |
| Exportar todos os dados (LGPD, também de removido) | `GET /patients/:id/export` | `patients:export` |

### 8.1 Campos

| Campo | Regra |
|---|---|
| `fullName` | obrigatório, até 150 |
| `cpf` | opcional; 11 dígitos, com ou sem pontuação; guardado/retornado só com dígitos; `null` limpa |
| `birthDate` | opcional, data (`YYYY-MM-DD`) |
| `phone` | opcional, até 20 (texto livre — o front define máscara) |
| `email` | opcional, email válido |
| `address` | opcional, **objeto JSON livre** (o front define a forma, ex.: `{ cep, logradouro, numero, complemento, bairro, cidade, uf }`) |
| `notes` | opcional, texto livre |

Resposta inclui também `id, tenantId, deletedAt, createdAt, updatedAt`. No `PATCH`, `null` limpa qualquer campo opcional.

### 8.2 CPF único e restauração

- CPF é **único por clínica, inclusive entre pacientes removidos**.
- Conflito com paciente ativo → `409` "Já existe um paciente com este CPF".
- Conflito com paciente **removido** → `409` com campo extra:
  ```json
  { "statusCode": 409, "error": "Conflict",
    "message": "Existe um paciente removido com este CPF; restaure-o em vez de recadastrar",
    "removedPatientId": "uuid" }
  ```
  **UI:** oferecer "Restaurar cadastro existente" → `POST /patients/{removedPatientId}/restore`.
- Restaurar devolve o paciente com dados e anamneses intactos.

### 8.3 Busca `q`

- Separada em palavras; **todas** precisam casar.
- Palavra com letras → busca no nome, qualquer posição/ordem, sem diferenciar maiúsculas e acentos (`joao silva` acha "João da Silva").
- Palavra só com dígitos, `.` e `-` → busca parcial no CPF (`123.456` = `123456`).
- Combina: `maria 1234` = nome com "maria" **e** CPF contendo "1234".
- Até 100 caracteres. Ordem: nome A–Z. Removidos: do mais recentemente removido ao mais antigo.
- Sugestão: busca com debounce (~300ms) — isso também serve de **seletor de paciente** na agenda e no financeiro.

### 8.4 Soft delete

`DELETE` esconde o paciente de todas as leituras (`GET /:id` passa a dar `404`), mas mantém dados, anamneses, agendamentos e cobranças. Paciente removido **não pode** receber novos agendamentos nem cobranças (`400`).

---

## 9. Anamnese

### 9.1 Formulários (templates)

Rotas sob `/tenants/:tenantId/anamnesis-templates`:

| Ação | Permissão |
|---|---|
| `GET /` (lista completa, por nome) e `GET /:id` | `patients:read` |
| `POST /`, `PATCH /:id`, `DELETE /:id` | `anamnesis_templates:manage` |

```json
{
  "name": "Ficha padrão",
  "fields": [
    { "key": "queixa_principal", "label": "Queixa principal", "type": "textarea", "required": true },
    { "key": "idade", "label": "Idade", "type": "number", "required": false },
    { "key": "fumante", "label": "Fumante?", "type": "boolean", "required": false },
    { "key": "inicio_sintomas", "label": "Início dos sintomas", "type": "date", "required": false },
    { "key": "tipo_sanguineo", "label": "Tipo sanguíneo", "type": "select", "required": false, "options": ["A", "B", "AB", "O"] },
    { "key": "alergias", "label": "Alergias", "type": "multiselect", "required": false, "options": ["dipirona", "penicilina"] }
  ]
}
```

Regras:
- `name` até 100, único no tenant (`409`).
- `fields`: 1 a 50 campos; a **ordem do array é a ordem de exibição**.
- `key`: até 60, `^[a-z][a-z0-9_]*$` (snake_case), única no formulário. **Sugestão:** gerar a `key` automaticamente a partir do rótulo (sem acento, minúsculo, `_`), editável.
- `label`: até 150. `required`: booleano obrigatório.
- `type`: `text` | `textarea` | `number` | `boolean` | `date` | `select` | `multiselect`.
- `options`: **obrigatório** (1–50 itens, cada um até 80) para `select`/`multiselect`; **proibido** para os demais.
- `PATCH` com `fields` substitui a lista inteira. Editar é permitido mesmo se já usado (sem versionamento): fichas antigas continuam como foram salvas.
- `DELETE` de formulário já usado em alguma ficha → `409`.

### 9.2 Preencher uma ficha

`POST /tenants/:tenantId/patients/:id/anamnesis-records`

```json
{ "templateId": "uuid", "answers": { "queixa_principal": "Dor de cabeça", "idade": 34, "fumante": false, "inicio_sintomas": "2026-09-20", "tipo_sanguineo": "O", "alergias": ["dipirona"] } }
```

Tipos esperados em `answers`:

| `type` | Valor JSON | Componente sugerido |
|---|---|---|
| `text` | string | input |
| `textarea` | string | textarea |
| `number` | number (não string!) | input numérico |
| `boolean` | `true`/`false` | switch/checkbox |
| `date` | string de data (`YYYY-MM-DD`) | date picker |
| `select` | string, uma das `options` | select/radio |
| `multiselect` | array de strings, todas em `options` | checkboxes/multi-select |

- Campo obrigatório ausente, `null` ou `""` → erro. Campos opcionais podem ser omitidos.
- Chave que não existe no formulário → erro.
- Todos os erros vêm juntos no `400` (`message` é array). Mostre-os junto aos campos.
- A resposta e o histórico trazem `template: { id, name }`, `filledByUserId`, `answers`, `createdAt`.
- **Fichas são imutáveis:** não há edição nem exclusão de ficha — cada preenchimento é um novo registro.

### 9.3 Histórico

`GET /patients/:id/anamnesis-records` → array, mais recente primeiro. Para renderizar os rótulos, busque o template (`GET /anamnesis-templates/:templateId`) e cruze pelas `key`s. Como o template pode ter sido editado depois, **exiba também chaves de `answers` que não existem mais no template** (use a própria `key` como rótulo) e ignore campos novos sem resposta.

---

## 10. Agenda

Rotas sob `/tenants/:tenantId/appointments`: `GET` e `GET /:id` (`appointments:read`); `POST`, `PATCH /:id`, `DELETE /:id` (`appointments:write`).

### 10.0 Escopo: própria agenda × todas

| Permissões | Acesso |
|---|---|
| `appointments:read` / `appointments:write` | Só a **própria agenda** (agendamentos em que o usuário é o profissional) |
| + `appointments:all` | A agenda de **todos** os profissionais |

Para um usuário **sem** `appointments:all`:

| Chamada | Resultado |
|---|---|
| `GET /appointments` (sem `professionalId`) | Só os agendamentos dele (`meta.total` também) |
| `GET /appointments?professionalId=<outro>` | `403` (a mensagem cita `appointments:all`) |
| `GET /appointments?professionalId=<ele mesmo>` | `200`, normal |
| `GET/PATCH/DELETE /appointments/:id` de outro profissional | `404` |
| `POST /appointments` com `professionalId` de outro | `403` |
| `PATCH` mudando `professionalId` para outro | `403` |
| `GET /professionals` | Só ele mesmo (array com 1 item) |

Com `appointments:all`, tudo funciona sem restrição. O papel Admin de clínica nova já nasce com `appointments:all`; na migração, todo papel que tinha `appointments:read` ganhou `appointments:all`.

### 10.1 Modelo

```json
{ "id": "...", "tenantId": "...", "patientId": "...", "professionalId": "...",
  "scheduledAt": "2026-10-01T13:00:00.000Z", "endsAt": "2026-10-01T13:30:00.000Z",
  "status": "scheduled", "notes": null, "createdAt": "...", "updatedAt": "...",
  "patient": { "id": "...", "fullName": "Maria da Silva" },
  "professional": { "id": "...", "name": "Dra. Ana" } }
```

Toda resposta de agendamento (criar, listar, detalhe, editar) traz `patient` e `professional` com o nome, sem precisar de outra chamada.

"Profissional" é **qualquer usuário ativo** do tenant (não há flag de profissional). Para o seletor, use `GET /tenants/:tenantId/professionals` (seção 6.1).

### 10.2 Criar

```json
{ "patientId": "uuid", "professionalId": "uuid", "scheduledAt": "2026-10-01T13:00:00Z", "endsAt": "2026-10-01T13:50:00Z", "notes": "Primeira consulta" }
```

- `endsAt` **opcional**: se omitido, fim = início + duração do profissional (ou, se ele não tiver, a da clínica).
- `endsAt` precisa ser depois de `scheduledAt` e a duração ≥ **mínimo da clínica** (`400`).
- Paciente precisa estar ativo (não removido) e ser do tenant; profissional precisa estar **ativo** e ser do tenant (`400`).
- **Sem sobreposição:** um profissional não pode ter dois agendamentos em `scheduled`, `confirmed` ou `completed` que se sobreponham → `409` "O profissional já possui um agendamento neste horário". Agendamentos que só "encostam" (um termina 10:00, outro começa 10:00) são permitidos. Cancelados e faltas não ocupam horário.
- Status inicial: `scheduled`.

### 10.3 Status e transições

```
scheduled ──► confirmed ──► completed
    │             ├──────► cancelled
    │             └──────► no_show
    ├──────────────────────► completed | cancelled | no_show
```

| De | Para |
|---|---|
| `scheduled` | `confirmed`, `completed`, `cancelled`, `no_show` |
| `confirmed` | `completed`, `cancelled`, `no_show` |
| `completed`, `cancelled`, `no_show` | — (finais) |

- Transição inválida → `409`.
- Em status **final**, só `notes` pode mudar; alterar horário, paciente ou profissional → `409`.
- `DELETE` = mudar para `cancelled` (não apaga). Cancelar um já final (`completed`/`no_show`) → `409`.

Rótulos sugeridos: `scheduled` Agendado · `confirmed` Confirmado · `completed` Realizado · `cancelled` Cancelado · `no_show` Faltou.

### 10.4 Editar / remarcar

`PATCH` aceita `patientId`, `professionalId`, `scheduledAt`, `endsAt`, `notes`, `status` (todos opcionais).

- Mudar **só o início** mantém a duração original (o fim acompanha).
- Mudar horário ou profissional revalida duração mínima e sobreposição.

### 10.5 Listar (visão de calendário)

`GET /appointments?professionalId&patientId&from&to&status&page&pageSize`

- `from`/`to` em ISO 8601, ambos opcionais; `from > to` → `400`.
- A janela é por **sobreposição**: entram agendamentos que terminam **depois** de `from` e começam **até** `to` (inclusive). Um atendimento em andamento no início da janela aparece.
- `status`: um ou vários, `status=scheduled,confirmed` ou `status=scheduled&status=confirmed`. Sem o parâmetro, **todos** (inclusive cancelados e faltas).
  - Para grade de calendário sem cancelados: `status=scheduled,confirmed,completed`.
- Ordem: início mais cedo primeiro. `pageSize` até 200 — para uma semana, uma chamada costuma bastar; confira `meta.totalPages`.
- **Fuso horário:** a API trabalha em UTC. O front converte o dia/semana local para `from`/`to` em ISO com fuso (ex.: `2026-10-01T00:00:00-03:00`) e exibe no fuso local.

---

## 11. Financeiro

Rotas sob `/tenants/:tenantId`. Leitura: `billing:read`. Escrita: `billing:write`.

| Ação | Rota |
|---|---|
| Listar cobranças | `GET /charges?patientId&status&from&to&page&pageSize` |
| Detalhe (com pagamentos) | `GET /charges/:id` |
| Criar cobrança | `POST /charges` |
| Editar cobrança | `PATCH /charges/:id` |
| Cancelar cobrança | `DELETE /charges/:id` |
| Registrar pagamento | `POST /charges/:id/payments` |
| Listar pagamentos | `GET /charges/:id/payments` |
| Resumo | `GET /billing/summary?from&to` |

### 11.1 Cobrança

```json
{ "patientId": "uuid", "appointmentId": "uuid", "description": "Consulta 01/10", "amountCents": 15000, "dueDate": "2026-10-10" }
```

| Campo | Regra |
|---|---|
| `patientId` | obrigatório; paciente ativo do tenant |
| `appointmentId` | opcional; precisa ser um agendamento **do mesmo paciente** (`400`) |
| `description` | obrigatório, até 200 |
| `amountCents` | inteiro 1 a 100.000.000 |
| `dueDate` | data de vencimento |

Toda resposta de cobrança (criar, listar, detalhe, editar) inclui `status`, `createdByUserId`, `patient: { id, fullName }` e os campos calculados:
- **`isOverdue`**: pendente e vencida;
- **`paidCents`**: soma dos pagamentos registrados;
- **`balanceCents`**: saldo devedor (`amountCents − paidCents`; `0` se cancelada).

**Status:** `pending` → `paid` | `cancelled`. `paid` e `cancelled` são finais.

- **`paid` nunca é definido manualmente** — só acontece quando os pagamentos somam o valor total. `PATCH` com `status: "paid"` → `409`.
- **"Atrasada" não é status:** é `pending` com vencimento anterior a hoje (`isOverdue: true`). O "hoje" é calculado em **UTC**.
- Editar (`patientId`, `appointmentId`, `description`, `amountCents`, `dueDate`) só em cobrança `pending` **sem nenhum pagamento**. Com qualquer pagamento (mesmo parcial), não dá para editar nem cancelar (`409`).
- `DELETE` = cancelar (não apaga).
- Criação sugerida a partir de um agendamento: "Gerar cobrança" pré-preenche paciente e `appointmentId`.

**Status de exibição sugerido:** `cancelled` Cancelada · `paid` Paga · `pending` + `isOverdue` Atrasada · `pending` com `paidCents > 0` Parcialmente paga · `pending` Pendente.

### 11.2 Filtros da listagem

- `status`: `pending` | `overdue` | `paid` | `cancelled` (um valor só). `pending` e `overdue` são mutuamente exclusivos: `pending` aqui = pendente **ainda não vencida**.
- `from`/`to`: janela por **vencimento**, inclusiva.
- Ordem: vencimento mais próximo primeiro.

### 11.3 Pagamento

```json
{ "amountCents": 5000, "method": "pix", "paidAt": "2026-10-02T15:00:00Z", "notes": "..." }
```

- `method`: `cash` | `pix` | `credit_card` | `debit_card` | `bank_transfer` | `other` (Dinheiro, Pix, Cartão de crédito, Cartão de débito, Transferência, Outro).
- `paidAt` opcional (padrão: agora) — para registrar pagamento recebido antes.
- `notes` até 500.
- **Parcial ou total.** A soma nunca pode passar do valor da cobrança → `400` com o saldo devedor exato em centavos na mensagem.
- Só em cobrança `pending` (`409` caso contrário).
- Ao completar o valor, a cobrança vira `paid` automaticamente. A resposta é o pagamento criado (com `recordedBy: { id, name }`) — **recarregue a cobrança** para ver o novo status e saldo.
- Pagamentos não podem ser editados nem estornados no MVP.
- Pagamentos (no detalhe da cobrança e em `GET /charges/:id/payments`) trazem `recordedBy: { id, name }`.
- Sugestão: pré-preencher o valor do pagamento com `balanceCents`.

### 11.4 Resumo

`GET /billing/summary?from=2026-10-01&to=2026-10-31`

```json
{
  "pending":      { "count": 12, "amountCents": 180000 },
  "overdue":      { "count": 3,  "amountCents": 45000 },
  "cancelled":    { "count": 1,  "amountCents": 15000 },
  "paidInPeriod": { "count": 20, "amountCents": 300000 }
}
```

- `pending`, `overdue` e `cancelled` são o **estado atual** (ignoram o período) e somam o **valor total** das cobranças (não descontam pagamentos parciais).
- `paidInPeriod` soma os **pagamentos** com `paidAt` dentro de `from`/`to`.
- Bom para cards de um dashboard financeiro.

> Nota fiscal (NFS-e) está fora do escopo do MVP.

---

## 12. Backoffice da plataforma (`platform:manage`)

Só para usuários da clínica-plataforma (criados por script, nunca por signup).

- `GET /platform/tenants?q&page&pageSize` → clínicas com `id, name, subdomain, customDomain, status, closureRequestedAt, createdAt, _count: { users, patients }`. Busca `q` em nome (sem acento/maiúsculas), subdomínio e domínio próprio; todas as palavras precisam casar. **Não há filtro por encerramento nem `deletionAvailableAt`** (proposta em `docs/proposta-encerramentos-no-painel-da-plataforma.md`).
- `DELETE /platform/tenants/:id` com `{ "confirmSubdomain": "..." }` → `204`: exclusão definitiva (seção 17).
- `PATCH /platform/tenants/:id/status` com `{ "status": "active" | "suspended" }` → `{ id, name, status }`.
- Suspender tem efeito imediato: usuários da clínica passam a receber `401`, o login falha e a marca pública dá `404`.
- **O backoffice não acessa dados de nenhuma clínica** (pacientes, agenda etc.).

**No front:** se o usuário logado tem `platform:manage`, direcione para o backoffice em vez do app de clínica.

---

## 13. Mapa de telas sugerido para o MVP

| Tela | Rotas principais | Permissão para exibir |
|---|---|---|
| Signup de clínica (**na landing page**, fora deste app) | `GET /public/legal`, `POST /tenants` → login da clínica nova | pública |
| Login tematizado | `GET /public/branding`, `POST /auth/login` | pública |
| Esqueci minha senha | `POST /auth/forgot-password` | pública |
| Redefinir senha (`/reset-password`, link do email) | `POST /auth/reset-password` | pública |
| Aceitar convite (`/accept-invite`, link do email) | `GET /public/legal`, `POST /auth/accept-invite` | pública |
| Termos de Uso e Política de Privacidade (`/termos`, `/privacidade`) | `GET /public/legal` | pública |
| Início / dashboard | `GET /appointments` (hoje), `GET /billing/summary` | por widget |
| Agenda (dia/semana, por profissional) | `GET/POST/PATCH/DELETE /appointments`, `GET /professionals` | `appointments:read` |
| Pacientes (lista + busca) | `GET /patients` | `patients:read` |
| Ficha do paciente (dados, anamneses, agendamentos, cobranças) | `GET /patients/:id`, `/anamnesis-records`, `GET /appointments?patientId=`, `GET /charges?patientId=` | `patients:read` (+ outras por aba) |
| Pacientes removidos | `GET /patients/removed`, `POST /:id/restore` | `patients:write` |
| Exportar dados do paciente (ficha e removidos) | `GET /patients/:id/export` | `patients:export` |
| Formulários de anamnese (construtor) | `/anamnesis-templates` | `anamnesis_templates:manage` |
| Financeiro (lista + detalhe + pagamento) | `/charges`, `/billing/summary` | `billing:read` |
| Usuários | `/users` | `users:manage` |
| Papéis e permissões | `/roles`, `GET /permissions` | `roles:manage` |
| Configurações da clínica (dados, durações, marca, domínio) | `/tenants/:id`, `/branding`, `/domain` | `tenant:manage` |
| Minha conta (trocar senha) | `GET /auth/me`, `PATCH /auth/me/password` | qualquer usuário |
| Minhas preferências (duração padrão) | `PATCH /users/me/appointment-settings` | `appointments:write` |
| Auditoria (`/auditoria`) e aba "Histórico de acessos" da ficha | `GET /audit-logs` | `audit:read` |
| Configurações › Encerrar conta (exportar tudo, pedir e cancelar) + aviso em todas as telas | `/tenants/:id/export`, `/tenants/:id/closure` | `tenant:manage` (+ `patients:export` para exportar) |
| Backoffice: clínicas (com exclusão definitiva) | `/platform/tenants` | `platform:manage` |

---

## 14. Lacunas conhecidas da API (impactam o front)

Pontos em que o front vai esbarrar e que podem exigir ajuste na API ou workaround:

1. **Sem refresh token:** a sessão dura o tempo do JWT (1 dia) e depois exige novo login.
2. **Sem exclusão de usuário** — só desativação.
3. **Listagens sem busca:** usuários, papéis e agenda não têm `q`.
4. **Agenda não filtra por vários profissionais** de uma vez (um `professionalId` ou todos).
5. **Datas "de hoje"** (atraso de cobrança) são calculadas em UTC — perto da meia-noite no Brasil (21h–0h em UTC−3) uma cobrança pode aparecer como atrasada antes do esperado.
6. **Ficha de anamnese traz só `filledByUserId`**, sem o nome. Quem não tem `appointments:all` não consegue resolver o nome de outros usuários pela lista de profissionais.

---

## 15. Tipos TypeScript de referência

```ts
export type UUID = string;
export type ISODateTime = string; // "2026-10-01T13:00:00.000Z"
export type ISODate = string;     // "2026-10-01"

export interface Page<T> { data: T[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }
export interface ApiError { statusCode: number; error: string; message: string | string[]; removedPatientId?: UUID }

export type PermissionKey =
  | 'patients:read' | 'patients:write'
  | 'appointments:read' | 'appointments:write'
  | 'users:manage' | 'roles:manage' | 'tenant:manage'
  | 'anamnesis_templates:manage'
  | 'billing:read' | 'billing:write'
  | 'audit:read' | 'patients:export'
  | 'platform:manage';

export interface LoginRequest { email: string; password: string; host?: string }
export interface ForgotPasswordRequest { email: string; host?: string }
export interface TokenPasswordRequest { token: string; password: string }   // reset-password
export interface AcceptInviteRequest extends TokenPasswordRequest { legalAcceptance: LegalAcceptance }
export interface TokenPasswordResponse { email: string }

export type LegalDocument = 'terms' | 'privacy';
export interface LegalAcceptance { termsVersion: string; privacyVersion: string }
export interface PublicLegal { terms: { version: string }; privacy: { version: string } }

export interface LoginResponse {
  accessToken: string;
  user: { id: UUID; name: string; email: string; tenantId: UUID; roleId: UUID; permissions: PermissionKey[] };
}
export interface Me {
  userId: UUID; tenantId: UUID; roleId: UUID; permissions: PermissionKey[];
  name: string; email: string; role: { id: UUID; name: string };
  pendingLegalDocuments: LegalDocument[];
}
export interface ChangePasswordResponse { accessToken: string }

export interface PublicBranding { name: string; tradeName: string | null; logoUrl: string | null; primaryColor: string | null; secondaryColor: string | null }

export interface TenantBranding { id: UUID; tenantId: UUID; tradeName: string | null; logoUrl: string | null; primaryColor: string | null; secondaryColor: string | null; createdAt: ISODateTime; updatedAt: ISODateTime }
export interface Tenant {
  id: UUID; name: string; subdomain: string; customDomain: string | null; customDomainVerifiedAt: ISODateTime | null;
  status: 'active' | 'suspended'; isPlatform: boolean;
  defaultAppointmentDurationMinutes: number; minAppointmentDurationMinutes: number;
  createdAt: ISODateTime; updatedAt: ISODateTime;
  branding?: TenantBranding | null;
}
export interface DomainVerification { domain: string; verified: boolean; verifiedAt: ISODateTime | null; record: { type: 'TXT'; name: string; value: string } }

export type UserStatus = 'active' | 'invited' | 'disabled';
export interface User {
  id: UUID; tenantId: UUID; roleId: UUID; name: string; email: string; status: UserStatus;
  defaultAppointmentDurationMinutes: number | null; lastLoginAt: ISODateTime | null;
  createdAt: ISODateTime; updatedAt: ISODateTime;
}
export interface Professional {
  id: UUID; name: string;
  defaultAppointmentDurationMinutes: number | null; effectiveAppointmentDurationMinutes: number;
}

export interface Permission { id: UUID; key: PermissionKey; description: string | null }
export interface Role {
  id: UUID; tenantId: UUID; name: string; description: string | null;
  permissions: { roleId: UUID; permissionId: UUID; permission: Permission }[];
  createdAt: ISODateTime; updatedAt: ISODateTime;
}

export interface Patient {
  id: UUID; tenantId: UUID; fullName: string; cpf: string | null; birthDate: ISODateTime | null;
  phone: string | null; email: string | null; address: Record<string, unknown> | null; notes: string | null;
  deletedAt: ISODateTime | null; createdAt: ISODateTime; updatedAt: ISODateTime;
}

export type AnamnesisFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'select' | 'multiselect';
export interface AnamnesisField { key: string; label: string; type: AnamnesisFieldType; required: boolean; options?: string[] }
export interface AnamnesisTemplate { id: UUID; tenantId: UUID; name: string; fields: AnamnesisField[]; createdAt: ISODateTime; updatedAt: ISODateTime }
export interface AnamnesisRecord {
  id: UUID; tenantId: UUID; patientId: UUID; templateId: UUID; filledByUserId: UUID;
  answers: Record<string, string | number | boolean | string[]>;
  template: { id: UUID; name: string };
  createdAt: ISODateTime; updatedAt: ISODateTime;
}

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export interface Appointment {
  id: UUID; tenantId: UUID; patientId: UUID; professionalId: UUID;
  scheduledAt: ISODateTime; endsAt: ISODateTime; status: AppointmentStatus; notes: string | null;
  createdAt: ISODateTime; updatedAt: ISODateTime;
  patient: { id: UUID; fullName: string };
  professional: { id: UUID; name: string };
}

export type ChargeStatus = 'pending' | 'paid' | 'cancelled';
export type ChargeStatusFilter = 'pending' | 'overdue' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'pix' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'other';
export interface Payment {
  id: UUID; tenantId: UUID; chargeId: UUID; amountCents: number; method: PaymentMethod;
  paidAt: ISODateTime; notes: string | null; recordedByUserId: UUID; createdAt: ISODateTime;
  recordedBy: { id: UUID; name: string };
}
export interface Charge {
  id: UUID; tenantId: UUID; patientId: UUID; appointmentId: UUID | null; description: string;
  amountCents: number; dueDate: ISODateTime; status: ChargeStatus;
  isOverdue: boolean; paidCents: number; balanceCents: number;
  patient: { id: UUID; fullName: string };
  createdByUserId: UUID; createdAt: ISODateTime; updatedAt: ISODateTime;
}
export interface ChargeDetail extends Charge { payments: Payment[] }
export interface BillingSummary {
  pending: { count: number; amountCents: number };
  overdue: { count: number; amountCents: number };
  cancelled: { count: number; amountCents: number };
  paidInPeriod: { count: number; amountCents: number };
}

export interface PatientExport {
  format: 'bem-te-vi.patient-export'; version: number; exportedAt: ISODateTime;
  clinic: { name: string };
  patient: Omit<Patient, 'tenantId'>;
  clinicalRecords: { id: UUID; createdAt: ISODateTime; form: { id: UUID; name: string }; filledBy: { id: UUID; name: string } | null;
    answers: { key: string; label: string | null; type: AnamnesisFieldType | null; value: unknown }[] }[];
  appointments: { id: UUID; scheduledAt: ISODateTime; endsAt: ISODateTime; status: AppointmentStatus; notes: string | null;
    professional: { id: UUID; name: string } }[];
  charges: { id: UUID; description: string; amountCents: number; dueDate: ISODateTime; status: ChargeStatus; appointmentId: UUID | null;
    payments: { id: UUID; amountCents: number; method: PaymentMethod; paidAt: ISODateTime; notes: string | null }[] }[];
}

export interface ClosureState { closureRequestedAt: ISODateTime | null; deletionAvailableAt: ISODateTime | null; graceDays: number }
// Tenant e PlatformTenant ganham `closureRequestedAt: ISODateTime | null`.

export type AuditAction =
  | 'patient.list' | 'patient.list_removed' | 'patient.view' | 'patient.create' | 'patient.update'
  | 'patient.delete' | 'patient.restore' | 'clinical_record.list' | 'clinical_record.create'
  | 'patient.export' | 'tenant.export' | 'tenant.closure_requested' | 'tenant.closure_cancelled';
export interface AuditLogEntry {
  id: UUID; action: AuditAction; patientId: UUID | null; actorUserId: UUID;
  actor: { id: UUID; name: string | null };            // name null = usuário apagado
  entityType: string | null; entityId: UUID | null;
  details: Record<string, unknown> | null;               // ver tabela da seção 17
  ip: string | null; userAgent: string | null; createdAt: ISODateTime;
}

export interface PlatformTenant {
  id: UUID; name: string; subdomain: string; customDomain: string | null;
  status: 'active' | 'suspended'; createdAt: ISODateTime; _count: { users: number; patients: number };
}
```

---

## 16. Ambiente de desenvolvimento

1. Na `bem-te-vi-api`: `docker compose --profile app up -d --build` sobe banco, API (`http://localhost:3000`) e **Mailpit** (`http://localhost:8025`, caixa de email falsa onde chegam os emails de recuperação de senha e convite). Alternativa sem container da API: `docker compose up -d` (só banco e Mailpit), `npm install`, `npx prisma migrate dev`, `npx prisma db seed`, `npm run start:dev`.
   - Os links dos emails apontam para `FRONTEND_URL` (padrão `http://localhost:5173`) com `?tenant=<subdomínio>`. Se o front rodar em outra porta, ajuste `FRONTEND_URL` no `.env` da API e rebuilde o container.
2. Criar uma clínica de teste via `POST /tenants` (exemplo em [`cadastro-de-clinica-na-landing.md`](cadastro-de-clinica-na-landing.md#em-desenvolvimento)) e logar com o dono.
3. Para o backoffice: `PLATFORM_ADMIN_EMAIL=... PLATFORM_ADMIN_PASSWORD=... npm run bootstrap:platform`.
4. Em dev (sem `APP_BASE_DOMAIN`), resolver a marca com `GET /public/branding?host=<subdomain>`; o front pode ler o subdomínio de uma variável de ambiente ou de `?tenant=` enquanto não houver DNS.
5. Coleção Postman com todas as rotas e exemplos em `docs/api/bem-te-vi.postman_collection.json` (no repositório da API).

---

## 17. LGPD

Resumo; o contrato completo está nas tasks 08 a 11 da API (`../bem-te-vi-api/docs/changes/`) e na seção "LGPD" do `docs/regras-de-negocio.md` da API.

**Termos de Uso e Política de Privacidade**
- `GET /public/legal` (público) → `{ "terms": { "version": "1" }, "privacy": { "version": "1" } }`. Os **textos vivem no front**; a API só guarda a versão vigente (`LEGAL_TERMS_VERSION` / `LEGAL_PRIVACY_VERSION`). Mudou um texto no front → a API precisa subir a versão.
- Aceite **obrigatório** no signup (`legalAcceptance`, seção 5.1) e no aceite de convite (seção 3.3), gravado com versão, data, IP e navegador.
- Versão nova publicada → todo mundo passa a ter aceite pendente (`pendingLegalDocuments` em `GET /auth/me`). O aceite é `POST /auth/me/legal-acceptances` com `{ termsVersion, privacyVersion }`, que devolve `{ pendingLegalDocuments }`. Quem bloqueia o uso até o aceite é o front.

**Trilha de auditoria** — `GET /tenants/:tenantId/audit-logs?patientId&actorUserId&action&from&to&page&pageSize` (`audit:read`)
- Registrada **automaticamente** pela API (o front não registra nada): leituras e alterações de paciente e ficha clínica, exportações e encerramento, com usuário, data, IP e navegador. Imutável; o conteúdo clínico nunca entra.
- Paginada (padrão 20, máximo 100), do mais recente para o mais antigo. `from`/`to` em ISO 8601, inclusivos.
- `audit:read` vem no Admin de clínica nova; nas clínicas existentes, só os papéis de administrador receberam.
- **Abrir telas de paciente gera registros** (`patient.view`, `patient.list`, `clinical_record.list`). Evite buscas duplicadas ou desnecessárias desses endpoints.
- A resposta traz `patientId`, mas **não o nome do paciente** (há proposta em `docs/proposta-nome-do-paciente-na-auditoria.md`).

| `action` | Rótulo | `details` |
|---|---|---|
| `patient.view` | Visualizou o cadastro | — |
| `patient.list` / `patient.list_removed` | Pesquisou pacientes (removidos) | `{ q, page, pageSize, total }` (`q` pode ser `null`) |
| `patient.create` / `patient.delete` / `patient.restore` | Cadastrou / Removeu / Restaurou o paciente | — |
| `patient.update` | Alterou o cadastro | `{ changes: { campo: { from, to } } }`, só o que mudou; `address` vem como objeto inteiro |
| `clinical_record.create` | Registrou ficha de anamnese | `entityId` = id da ficha |
| `clinical_record.list` | Consultou as fichas de anamnese | `{ count }` |
| `patient.export` / `tenant.export` | Exportou os dados do paciente / da clínica | — |
| `tenant.closure_requested` / `tenant.closure_cancelled` | Pediu / cancelou o encerramento | — |

**Exportar dados do paciente** — `GET /tenants/:tenantId/patients/:id/export` (`patients:export`)
- JSON com tudo o que a clínica guarda sobre o paciente (direito de acesso e portabilidade do titular), **inclusive de paciente removido**: `{ format: "bem-te-vi.patient-export", version, exportedAt, clinic: { name }, patient, clinicalRecords, appointments, charges }`.
- As fichas saem com o **rótulo** de cada campo, na ordem do formulário; respostas a campos retirados depois vêm no fim com `label: null` e `type: null`.
- A API manda `Content-Disposition: attachment; filename="paciente-<id>.json"`, mas **não expõe esse header no CORS**: o front monta o nome sozinho. Como exige o token, o download é por `fetch` autenticado + `Blob`, nunca por `<a href>`.
- Cada chamada gera `patient.export` na trilha, com `details: { clinicalRecords, appointments, charges }` (quantidades). Erros: `403`, `404`.
- `patients:export` vem no Admin de clínica nova; nas existentes, só os papéis de administrador receberam.

**Saída da clínica** (em três passos: exportar, pedir, a plataforma excluir)
- `GET /tenants/:id/export` (`tenant:manage` **e** `patients:export`): todos os dados da clínica num JSON (`format: "bem-te-vi.clinic-export"`, `clinic`, `logo` em base64, `users` sem segredos, `roles`, `patients`, `anamnesisTemplates`, `anamnesisRecords`, `appointments`, `charges`, `auditLogs`, `legalAcceptances`). Pode levar alguns segundos. Nome sugerido `clinica-<subdominio>-<AAAA-MM-DD>.json` (o front monta, porque o `Content-Disposition` não é exposto no CORS). Gera `tenant.export` na trilha.
- `GET /tenants/:id/closure` (`tenant:manage`) → `{ closureRequestedAt, deletionAvailableAt, graceDays }` (datas `null` sem pedido).
- `POST /tenants/:id/closure` com `{ "password": "..." }` → mesmo formato. `400` "Senha incorreta" (**não desloga**), `409` se já foi pedido. Envia email de confirmação a quem pediu (e à plataforma, se `PLATFORM_CONTACT_EMAIL` estiver configurado).
- `DELETE /tenants/:id/closure` → cancela durante a carência; `409` se não há pedido.
- Carência padrão de **30 dias** (`TENANT_DELETION_GRACE_DAYS`), durante a qual a clínica funciona normalmente.
- Só quem tem `tenant:manage` consegue saber do pedido: `/auth/me` não informa, então os demais usuários não veem aviso.
- `DELETE /platform/tenants/:id` (`platform:manage`) com `{ "confirmSubdomain": "..." }` → `204`. `409` se a clínica não pediu ou se ainda está na carência (a mensagem traz a data em ISO), `400` se o subdomínio não confere, `404` se não existe. **Sem volta**: sobra só um registro da exclusão.
