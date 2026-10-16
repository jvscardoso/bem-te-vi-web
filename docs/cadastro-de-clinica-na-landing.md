# Cadastro de clínica na landing page

Em 10/10/2026 o cadastro de clínica saiu do `bem-te-vi-web`. Este app é whitelabel: cada endereço é de uma clínica, e o login serve para entrar nela, não para criar outra. O cadastro de clientes novos passa a ser da **landing page** do produto.

Este documento reúne o que a landing precisa para fazer o cadastro: contrato da API, regras de validação e o que fazer depois de criar a clínica. A tela antiga (`src/pages/SignupPage.tsx`) continua no histórico do git, se quiser consultar a implementação (commit anterior à remoção).

## Fluxo

1. Ao abrir o formulário, buscar as versões vigentes dos Termos e da Política: `GET /public/legal`.
2. A pessoa preenche os dados da clínica e do dono, e marca o aceite.
3. `POST /tenants` com os dados e as versões aceitas.
4. Em `201`, levar a pessoa ao login da clínica nova: `https://<subdominio>.<domínio base>/login`.

Não há login automático. A landing está em outro endereço, e a sessão do app só nasce no login feito no endereço da clínica (token de acesso em memória e cookie de refresh `SameSite=Strict`), então uma sessão aberta na landing não chegaria lá. A pessoa entra com o email e a senha que acabou de cadastrar.

## Contrato da API

As duas rotas são públicas, sem token. O CORS da API é uma lista fechada: o domínio base da plataforma e os subdomínios dele, domínios próprios de clínica já verificados e as origens de `CORS_EXTRA_ORIGINS`; fora de produção, também `localhost` e `*.localhost`. Se a landing ficar fora do domínio base, a origem dela precisa entrar em `CORS_EXTRA_ORIGINS` no ambiente da API.

### Versões vigentes dos documentos legais

```http
GET /public/legal
```

```json
{ "terms": { "version": "1" }, "privacy": { "version": "1" } }
```

Os **textos** dos documentos não vêm da API. Eles estão no app em `/termos` e `/privacidade` (`src/legal/documents.ts`). A landing pode linkar para essas páginas, mas o endereço precisa ter marca padrão (sem clínica). Se a landing tiver cópias próprias dos textos, elas precisam corresponder às mesmas versões.

### Criar a clínica

```http
POST /tenants
Content-Type: application/json
```

```json
{
  "name": "Clínica São José",
  "subdomain": "clinica-sao-jose",
  "owner": { "name": "Maria Souza", "email": "maria@exemplo.com", "password": "********" },
  "legalAcceptance": { "termsVersion": "1", "privacyVersion": "1" }
}
```

| Campo | Regra |
|---|---|
| `name` | Obrigatório, até 150 caracteres. Vazio ou só espaços: `400` com `code: "required"`. A API grava sem os espaços das pontas. |
| `subdomain` | Obrigatório, até 63 caracteres, formato de rótulo DNS: `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$` (letras minúsculas, números e hífen, **sem hífen no começo nem no fim**). Único na plataforma e fora da lista de reservados (ver Erros). |
| `owner.name` | Obrigatório, até 150 caracteres. Vazio ou só espaços: `400` com `code: "required"`. |
| `owner.email` | Obrigatório, email válido, até 150 caracteres. Único na plataforma inteira (um email = um usuário). |
| `owner.password` | Obrigatório, de 8 a 200 caracteres. |
| `legalAcceptance` | Obrigatório. `termsVersion` e `privacyVersion` precisam ser as vigentes de `GET /public/legal`. |
| `customDomain` | Opcional, domínio válido (`agenda.suaclinica.com.br`), fora do domínio da plataforma. Precisa ser verificado por DNS depois, em Configurações › Domínio. |
| `defaultAppointmentDurationMinutes` | Opcional, inteiro de 5 a 1440. Padrão: 30. |
| `minAppointmentDurationMinutes` | Opcional, inteiro de 5 a 1440. Padrão: 5. Não pode ser maior que a duração padrão. |

**Sugestão:** a landing pode pedir só nome, subdomínio, dono e aceite. Domínio próprio e durações se ajustam depois, nas Configurações da clínica, e no app antigo já ficavam escondidos em "Opções avançadas".

Resposta `201`:

```json
{
  "tenant": { "id": "…", "name": "Clínica São José", "subdomain": "clinica-sao-jose", "...": "..." },
  "role": { "id": "…", "name": "Admin" },
  "owner": { "id": "…", "name": "Maria Souza", "email": "maria@exemplo.com" }
}
```

O dono recebe o papel **Admin**, com todas as permissões da clínica. O aceite dos Termos e da Política fica registrado para ele, então ele não vê o modal de aceite no primeiro login.

### Erros

Formato padrão: `{ statusCode, error, message }`, em que `message` pode ser string ou array de strings. O `400` de validação traz também `errors`, uma entrada por campo errado:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["Email do responsável inválido", "Senha do responsável deve ter pelo menos 8 caracteres"],
  "errors": [
    { "field": "owner.email", "code": "isEmail", "message": "Email do responsável inválido" },
    { "field": "owner.password", "code": "minLength", "message": "Senha do responsável deve ter pelo menos 8 caracteres" }
  ]
}
```

- `message`: as frases, em português e dizendo o campo (uma por campo errado). Dá para mostrar direto.
- `errors[].field`: o caminho no corpo (`name`, `subdomain`, `owner.email`, `legalAcceptance.termsVersion`). Serve para marcar o campo na tela, como o app faz com `applyFieldErrors` (`src/lib/errors.ts`).
- `errors[].code`: a regra (`required`, `isEmail`, `minLength`, `maxLength`, `matches`, `unknownField`…).

Erros de regra de negócio e os `409` não têm `errors`: só `message` em texto. A landing ainda deve validar antes de enviar, com as regras da tabela; o `400` fica como rede de segurança.

| Status | Quando | O que fazer na tela |
|---|---|---|
| `400` "Aceite a versão vigente dos Termos de Uso (…) e da Política de Privacidade (…)" | As versões mudaram com a tela aberta. Nada foi criado. | Buscar `GET /public/legal` de novo, desmarcar o aceite e pedir que a pessoa aceite outra vez. |
| `400` "A duração padrão do atendimento não pode ser menor que a duração mínima" | Durações inconsistentes. | Mostrar no campo de duração. |
| `400` com `errors` | Validação dos campos. | Mostrar cada frase no campo de `errors[].field`, ou as frases de `message` juntas. |
| `409` "Este subdomínio já está em uso" | `subdomain` de outra clínica. | Mostrar no campo de subdomínio. |
| `409` "Este subdomínio não está disponível" | `subdomain` reservado pela plataforma (`www`, `api`, `app`, `admin`, `backoffice`, `plataforma`, `mail`, `smtp`, `status`, `docs`, `blog`, `ajuda`, `suporte`, `static`, `cdn`, `assets` e outros por ambiente, em `RESERVED_SUBDOMAINS`). | Mostrar no campo de subdomínio. Não copie a lista para a landing: ela varia por ambiente. |
| `409` "Este domínio já está em uso" | `customDomain` de outra clínica. | Mostrar no campo de domínio. |
| `409` "Este domínio não está disponível" | `customDomain` é o domínio da plataforma ou um subdomínio dele. | Mostrar no campo de domínio. |
| `409` "Já existe um usuário com o email …" | Email já usado em qualquer clínica. | Mostrar no campo de email, com link para o login ou para "esqueci minha senha". |
| `429` | Mais de **10 cadastros por minuto** do mesmo IP. | "Muitas tentativas, aguarde um minuto." |

## Planos e teste grátis

Toda clínica nasce em **teste grátis** (14 dias, plano Essencial, sem cartão) e contrata depois, dentro do app (Configurações › Assinatura). A tabela de preços da landing vem de `GET /public/plans` (público, formato na seção 12.1 de `regras-de-negocio.md`); não escreva preços na página. O guia completo para o time da landing está em `../bem-te-vi-api/docs/landing/pagina-de-cadastro.md`.

## Comportamentos que valem a pena manter

Eram assim no app e funcionavam bem:

- **Subdomínio sugerido pelo nome:** "Clínica São José" vira `clinica-sao-jose`. Tirar acentos (`normalize('NFD')` e remover as marcas), passar para minúsculas, trocar o que não for `a-z0-9` por `-`, cortar em 63 caracteres e só então tirar os hífens das pontas (cortar depois poderia deixar um hífen no fim, que a API recusa). A sugestão para de acompanhar o nome assim que a pessoa edita o subdomínio.
- **Mostrar o endereço final** enquanto a pessoa digita: `clinica-sao-jose.<domínio base>`.
- **Botão desabilitado** até o aceite ser marcado e as versões terem carregado.
- **Validar no cliente** com as mesmas regras da tabela, para não depender só do `400`.

## Pontos em aberto

> Resolvidos pela task 14 da API (14/10/2026): nome vazio ou só com espaços, mensagens em inglês e subdomínios reservados. Se a landing ficar num subdomínio do domínio base, confira se o nome dela está entre os reservados (ou em `RESERVED_SUBDOMAINS`).

- **Email preenchido no login:** o app preenche o email quando ele vem de outra tela do próprio app (`location.state`). Vindo da landing, isso não funciona. Passar o email na URL não é recomendado, porque ele fica no histórico e nos logs. Se o produto quiser essa comodidade, ou o login automático, o caminho é um token de uso único emitido pela API, o que exige uma proposta para a API.
- **Confirmação de email no cadastro:** a decisão 06 da API (`../bem-te-vi-api/docs/decisoes/06-confirmacao-de-email-no-cadastro.md`) muda o passo 4. Depois do cadastro viria "confirme seu email" em vez do login direto.

## Em desenvolvimento

Sem a tela, crie uma clínica de teste chamando a API direto (as versões vêm de `GET /public/legal`):

```bash
curl -X POST http://localhost:3000/tenants -H 'Content-Type: application/json' -d '{
  "name": "Clínica Teste", "subdomain": "clinica-teste",
  "owner": { "name": "Dono Teste", "email": "dono@clinica-teste.com", "password": "<senha de teste>" },
  "legalAcceptance": { "termsVersion": "1", "privacyVersion": "1" }
}'
```

Depois, entre em `http://clinica-teste.localhost:5173/login`.
