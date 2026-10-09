# bem-te-vi-web

Frontend do **bem-te-vi**, SaaS whitelabel de gestão de clínicas. Cada clínica acessa pelo próprio endereço (subdomínio ou domínio próprio) e vê o app com o seu nome, logo e cores. Cobre agenda, pacientes, anamnese, financeiro, usuários e papéis, configurações da clínica e o backoffice da plataforma.

O backend é a [`bem-te-vi-api`](../bem-te-vi-api) (NestJS + Prisma). A fonte da verdade das regras e do contrato é o código dela.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/status.md`](docs/status.md) | **Comece por aqui.** O que está pronto, tela por tela; situação das tasks da API; o que falta; bugs e decisões em aberto |
| [`docs/arquitetura.md`](docs/arquitetura.md) | Pastas, rotas, sessão, marca da clínica, camada de API, estado, permissões, padrões de formulário, build |
| [`regras-de-negocio.md`](regras-de-negocio.md) | Regras de negócio e contrato da API, do ponto de vista do front |
| [`docs/changes/`](docs/changes/00-indice.md) | Tasks vindas da API (mudanças que o front precisa acompanhar) |
| [`CLAUDE.md`](CLAUDE.md) | Instruções curtas para sessões de desenvolvimento com o Claude Code |

> `docs/` e `regras-de-negocio.md` são documentos internos e estão no `.gitignore`: existem só na máquina de quem desenvolve.

## Stack

| Pacote | Versão |
|---|---|
| React / React DOM | 19.3 |
| TypeScript | 6.0 |
| Vite (Rolldown) + `@vitejs/plugin-react` | 8.3 / 6.1 |
| Material UI + ícones (`@mui/material`, `@mui/icons-material`) | 9.4 |
| Emotion | 11.14 |
| TanStack Query | 5.104 |
| React Router (data router) | 8.4 |
| React Hook Form + `@hookform/resolvers` | 7.89 / 5.9 |
| Zod | 4.6 |
| ESLint (+ `react-hooks` 7, `react-refresh`, `typescript-eslint`) | 10.11 |

Node 24 e npm.

## Como rodar

### 1. API (em Docker)

Na pasta da `bem-te-vi-api`:

```bash
docker compose --profile app up -d --build
```

Sobe o banco, a **API em http://localhost:3000** e o **Mailpit em http://localhost:8025**, uma caixa de email falsa onde chegam os emails de "esqueci minha senha" e de convite de usuário. Nada sai para a internet. Os links desses emails apontam para `http://localhost:5173` (variável `FRONTEND_URL` da API).

### 2. Front

```bash
npm install
cp .env.example .env.local   # ajuste se necessário
npm run dev                  # http://localhost:5173
```

| Variável | Uso |
|---|---|
| `VITE_API_URL` | URL da API (padrão `http://localhost:3000`) |
| `VITE_DEV_TENANT` | Subdomínio da clínica usado em dev quando a URL não traz `?tenant=` |
| `VITE_APP_BASE_DOMAIN` | Domínio base das clínicas em produção (ex.: `bemtevi.com.br`), usado no cadastro |

### 3. Escolher a clínica em dev

Sem DNS, a clínica vem de `?tenant=<subdomínio>`:

```
http://localhost:5173/login?tenant=clinica-demo
```

O valor fica lembrado na aba. `?tenant=` vazio volta para a marca padrão do bem-te-vi, que é por onde entram os usuários do backoffice. O login só aceita usuários da clínica do endereço.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (porta 5173) |
| `npm run build` | Typecheck (`tsc -b`) + build de produção em `dist/` |
| `npm run preview` | Serve o build localmente |
| `npm run lint` | ESLint |
| `npm run typecheck` | Só o TypeScript |

Não há testes automatizados.

## Estrutura de pastas

```
src/
  main.tsx       Providers e RouterProvider
  router.tsx     Rotas, guards e lazy loading
  api/           Cliente HTTP e um módulo por recurso da API
  auth/          Sessão, /auth/me, guards e permissões
  theme/         Marca da clínica (host, tema MUI)
  layouts/       Shell (menu + topo) e layout das telas públicas
  components/    Componentes reutilizáveis
  lib/           Datas, formatos, máscaras, helpers de formulário
  pages/         Telas, uma pasta por área
```

Detalhes em [`docs/arquitetura.md`](docs/arquitetura.md).
