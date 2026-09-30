# bem-te-vi-web

Frontend do bem-te-vi (SaaS whitelabel de gestão de clínicas). A fonte da verdade das regras de negócio e do contrato da API é o código da `bem-te-vi-api`.

**Stack:** React + Vite + TypeScript · Material UI · TanStack Query · React Router · React Hook Form + Zod.

## Rodando

```bash
npm install
cp .env.example .env.local   # ajuste VITE_API_URL se necessário
npm run dev                  # http://localhost:5173
```

A `bem-te-vi-api` precisa estar rodando (padrão `http://localhost:3000`).

**Marca da clínica em dev:** sem DNS, informe o subdomínio em `?tenant=` (fica lembrado na aba) ou em `VITE_DEV_TENANT`:

```
http://localhost:5173/login?tenant=clinica-demo
```

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck + build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Só o TypeScript |

## Estrutura

```
src/
  api/        cliente HTTP (token, erros, 401), tipos do contrato e chamadas por recurso
  auth/       sessão (token), AuthProvider (/auth/me), permissões e guards de rota
  theme/      tema MUI e marca da clínica (GET /public/branding)
  layouts/    layout autenticado (menu por permissão) e itens de navegação
  components/ componentes compartilhados
  pages/      telas
  lib/        formatação (dinheiro, CPF, datas) e utilitários de erro
```

## Decisões

- **Token em `sessionStorage`**: sobrevive a reload, some ao fechar o navegador e não é compartilhado entre abas.
- **`/auth/me` como fonte de verdade** das permissões: recarregado ao abrir o app e ao voltar o foco da aba.
- **401 em qualquer chamada** descarta a sessão e leva ao login (com aviso de sessão encerrada).
- **Logout limpa o cache** de dados do usuário (mantém só a marca pública).
- O menu e as rotas escondem o que o usuário não pode acessar, mas quem garante é a API (403).
