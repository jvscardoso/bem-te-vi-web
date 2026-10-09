# bem-te-vi-web — instruções para o Claude

Frontend React do bem-te-vi (SaaS whitelabel de gestão de clínicas). API em `../bem-te-vi-api` (NestJS, na mesma pasta que este repositório). Responda e escreva documentação em **português**.

## Antes de começar

1. Leia **`docs/status.md`**: o que está pronto, o que falta, bugs e decisões em aberto.
2. Conforme a tarefa:
   - `docs/regras-de-negocio.md`: regras e contrato da API. Vale o código da API se divergir.
   - `docs/arquitetura.md`: como o front é organizado e os padrões.
   - `docs/changes/` (só existe quando há tasks abertas): tasks vindas da API, com o índice `00-indice.md` e a situação de cada uma no front.
   - `docs/proposta-*.md`: propostas do front para a sessão da API, ainda em aberto.
   - `docs/credenciais-de-teste.md`: contas locais para testar no navegador.
3. A documentação é versionada, exceto `docs/credenciais-de-teste.md` (senhas de teste, no `.gitignore`). Nunca coloque senhas ou tokens em outro documento.

## Comandos

```bash
npm run dev          # http://localhost:5173
npm run build        # tsc -b + vite build
npm run lint
npm run typecheck
```

Não há testes automatizados: valide com typecheck, lint e teste no navegador.

API local (na pasta da API): `docker compose --profile app up -d --build`. Sobe a API em http://localhost:3000 e o Mailpit (emails de dev) em http://localhost:8025. Em dev, a clínica vem de `?tenant=<subdomínio>` na URL (`?tenant=` vazio = marca padrão/backoffice).

## Arquitetura em poucas linhas

- `src/api/`: `client.ts` (fetch + Bearer + `ApiError`) e um módulo por recurso com `xxxApi` e `xxxKeys`.
- `src/auth/`: token em `sessionStorage`. `AuthProvider` lê `GET /auth/me` (fonte das permissões). Guards: `RequireAuth`, `RequirePermission`, `ClinicAreaOnly`.
- `src/theme/`: `getBrandingHost()` define a clínica do endereço. `BrandingProvider` busca a marca pública e monta o tema MUI.
- `src/router.tsx`: data router com páginas lazy via `page(load, name)`.
- Estado do servidor em TanStack Query. Filtros, página, aba e data ficam na URL.
- Formulários com React Hook Form (+ Zod nos grandes); `muiField()` e `Controller` para MUI.

## Regras que não podem quebrar

- **Não altere o contrato da API.** Se algo bloquear, escreva uma proposta em `docs/` (ex.: `docs/proposta-<assunto>.md`) para a sessão da API e avise o usuário. Não contorne com hacks.
- **401 desloga e 400 não.** Só o `client.ts` limpa a sessão, e só se o token recusado for o atual. Erros de formulário e de fluxo de senha são 400 e nunca deslogam.
- **Telas e ações são controladas pelas permissões de `/auth/me`** (`can(...)`, `RequirePermission`, `permission` no menu). Nunca use o nome do papel nem as permissões da resposta do login. `appointments:all` define se o usuário vê todas as agendas ou só a própria.
- **`/reset-password` e `/accept-invite` são fixas**: os emails da API apontam para elas. Não renomeie nem mova essas rotas.
- **O host enviado no login (e no "esqueci minha senha") é o mesmo da resolução de marca**: sempre `getBrandingHost()`.
- Nunca reenvie `logoUrl` no PATCH de marca: isso descarta o logo enviado.
- Não implemente tasks de LGPD ou mudanças de API por conta própria: o usuário traz as tasks em `docs/changes/`.

## Convenções de código

- TypeScript estrito; import com alias `@/` (`@/api/...`, `@/lib/...`).
- Nomes em inglês, textos da UI e comentários em português. Comente o "porquê", não o "o quê".
- MUI 9: `slotProps.input` / `htmlInput` / `inputLabel`. Em Radio/Checkbox, ref via `slotProps.input.ref`. Após `reset`/`setValue` em campo não controlado, use `inputLabel.shrink` ou `Controller`.
- Dinheiro em centavos (`moneyToCents`, `centsToMoney`, `formatCents`). Máscaras em `lib/masks.ts`.
- Erros da API: `<ErrorMessages error={...} />`. Sucesso: `useNotify()`. Ações destrutivas: `ConfirmDialog`.
- Regras do React Compiler (lint): nada impuro no render (`Date.now()` em `useState(() => ...)`), `useWatch` em vez de `watch`, hooks fora de arquivos de componente quando o `react-refresh` reclamar.
- Componentes usados só por uma área ficam na pasta da área em `src/pages/`. Os reaproveitáveis vão para `src/components/`.
- Datas: helpers de `lib/dates.ts` e `lib/format.ts` (pt-BR).

## Ao terminar uma mudança

1. `npm run typecheck` e `npm run lint` sem erros.
2. Teste no navegador com a API local (contas em `docs/credenciais-de-teste.md`), inclusive com um usuário sem a permissão envolvida.
3. Atualize `docs/status.md` (data no topo, tela/task, limitações novas).
4. Se a mudança veio de uma task, marque a coluna "Situação no front" em `docs/changes/00-indice.md`. Quando todas estiverem concluídas, o usuário decide se os arquivos saem da pasta (o resumo fica no `status.md`).
5. Se a regra de negócio ou o contrato mudou, ajuste `docs/regras-de-negocio.md`. Se mudou a estrutura ou um padrão, ajuste `docs/arquitetura.md`.
6. **Não faça commit**: o usuário commita. No fim, diga o que mudou e o que ficou pendente.
