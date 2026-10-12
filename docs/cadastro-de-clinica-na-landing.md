# Cadastro de clínica na landing page

Em 10/10/2026 o cadastro de clínica saiu do `bem-te-vi-web`. Este app é whitelabel: cada endereço é de uma clínica, e o login serve para entrar nela, não para criar outra. O cadastro de clientes novos passa a ser da **landing page** do produto.

Este documento reúne o que a landing precisa para fazer o cadastro: contrato da API, regras de validação e o que fazer depois de criar a clínica. A tela antiga (`src/pages/SignupPage.tsx`) continua no histórico do git, se quiser consultar a implementação (commit anterior à remoção).

## Fluxo

1. Ao abrir o formulário, buscar as versões vigentes dos Termos e da Política: `GET /public/legal`.
2. A pessoa preenche os dados da clínica e do dono, e marca o aceite.
3. `POST /tenants` com os dados e as versões aceitas.
4. Em `201`, levar a pessoa ao login da clínica nova: `https://<subdominio>.<domínio base>/login`.

Não há login automático. A landing está em outro domínio, e o app guarda a sessão no `sessionStorage` do domínio da clínica, então um token obtido na landing não chegaria lá. A pessoa entra com o email e a senha que acabou de cadastrar.

## Contrato da API

As duas rotas são públicas, sem token. A API tem CORS aberto (`app.enableCors()`), então a landing pode chamá-la de outro domínio.

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
| `name` | Obrigatório, até 150 caracteres. **A API aceita texto vazio**: a landing precisa exigir um nome (o app antigo fazia `trim` e exigia ao menos 1 caractere). |
| `subdomain` | Obrigatório, até 63 caracteres, só `a-z`, `0-9` e `-` (minúsculo). Único na plataforma. |
| `owner.name` | Obrigatório, até 150 caracteres. Mesma observação: exija um nome não vazio na landing. |
| `owner.email` | Obrigatório, email válido, até 150 caracteres. Único na plataforma inteira (um email = um usuário). |
| `owner.password` | Obrigatório, mínimo de 8 caracteres. O app antigo também limitava a 200. |
| `legalAcceptance` | Obrigatório. `termsVersion` e `privacyVersion` precisam ser as vigentes de `GET /public/legal`. |
| `customDomain` | Opcional, domínio válido (`agenda.suaclinica.com.br`). Precisa ser verificado por DNS depois, em Configurações › Domínio. |
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

Formato padrão: `{ statusCode, error, message }`, em que `message` pode ser string ou array de strings. Os erros de validação vêm em array e **misturam idiomas**: os personalizados vêm em português ("subdomain deve conter apenas letras minúsculas, números e hífen") e os padrão do class-validator, em inglês ("owner.email must be an email"). Por isso a landing deve validar antes de enviar e tratar o `400` de validação como rede de segurança.

| Status | Quando | O que fazer na tela |
|---|---|---|
| `400` "Aceite a versão vigente dos Termos de Uso (…) e da Política de Privacidade (…)" | As versões mudaram com a tela aberta. Nada foi criado. | Buscar `GET /public/legal` de novo, desmarcar o aceite e pedir que a pessoa aceite outra vez. |
| `400` "A duração padrão do atendimento não pode ser menor que a duração mínima" | Durações inconsistentes. | Mostrar no campo de duração. |
| `400` (array) | Validação dos campos. | Mostrar as mensagens. |
| `409` "Este subdomínio já está em uso" | `subdomain` repetido. | Mostrar no campo de subdomínio. |
| `409` "Este domínio já está em uso" | `customDomain` repetido. | Mostrar no campo de domínio. |
| `409` "Já existe um usuário com o email …" | Email já usado em qualquer clínica. | Mostrar no campo de email, com link para o login ou para "esqueci minha senha". |
| `429` | Mais de **10 cadastros por minuto** do mesmo IP. | "Muitas tentativas, aguarde um minuto." |

## Comportamentos que valem a pena manter

Eram assim no app e funcionavam bem:

- **Subdomínio sugerido pelo nome:** "Clínica São José" vira `clinica-sao-jose`. Tirar acentos (`normalize('NFD')` e remover as marcas), passar para minúsculas, trocar o que não for `a-z0-9` por `-`, tirar hífens das pontas e cortar em 63 caracteres. A sugestão para de acompanhar o nome assim que a pessoa edita o subdomínio.
- **Mostrar o endereço final** enquanto a pessoa digita: `clinica-sao-jose.<domínio base>`.
- **Botão desabilitado** até o aceite ser marcado e as versões terem carregado.
- **Validar no cliente** com as mesmas regras da tabela, para não depender só do `400`.

## Pontos em aberto

> Os itens de validação (nome vazio, mensagens em inglês, subdomínios reservados) foram propostos à API em `../bem-te-vi-api/docs/changes/14-validacao-do-cadastro-de-clinica.md`. Até lá, a landing precisa validar por conta própria.

- **Subdomínios reservados:** a API não bloqueia nomes como `www`, `api`, `app` ou `admin`. Se a landing ou a API usarem algum deles, é preciso reservá-los na API antes de abrir o cadastro.
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
