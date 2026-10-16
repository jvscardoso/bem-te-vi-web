# Design systems escolhíveis

**Registrado em:** 15/10/2026 · **Situação:** direção decidida; começa depois do lançamento do MVP

## Origem

Ao ver o app, o comentário foi que o front está simples demais e poderia ser mais moderno e bonito. O Claude Design fez três direções para a tela inicial, comparadas com o visual atual. A rodada 1 (só a tela inicial) está no PDF "Front modernização solicitada". A partir disso surgiu a ideia: **o usuário escolhe o design system, do mesmo jeito que a clínica escolhe o layout da tela inicial.**

### As três direções (rodada 1)

| | Resumo | Tema (tokens, aparência dos componentes) | Estrutura (muda componentes e telas) |
|---|---|---|---|
| **Sereno** (1b) | Menu flutuante, cartões sem borda, cor da clínica como superfície | Cartões sem borda com sombra suave, cantos mais redondos, título maior, cor da clínica preenchendo o cartão "Recebido", dia de hoje destacado no calendário | Menu lateral descolado da borda; usuário no pé do menu; busca e ações no cabeçalho da página; barra de progresso em "Atendimentos de hoje"; "Todos / Só os meus" em botões |
| **Preciso** (1c) | Menu escuro tingido com a marca, denso, números em fonte mono | Menu escuro na cor da clínica, densidade maior, números em fonte monoespaçada, rótulos em caixa alta | Trilha ("Clínica Demo / Início") e ações no topo; "Agenda de hoje" em tabela com colunas; usuário no pé do menu |
| **Acolhedor** (1d) | Navegação no topo, faixa de destaque na cor da clínica | Fundo bege quente, botão de destaque amarelo (cor secundária), avatares com iniciais | **Navegação no topo em vez do menu lateral** (Administração num menu suspenso); faixa na cor da clínica com a saudação, as ações e os quatro números; gráfico de rosca em "Atendimentos de hoje" |

### Preferências

- O dono do produto preferiu o **Acolhedor** (moderno e bem diferente).
- A outra pessoa que avaliou preferiu o **Preciso**.
- A análise técnica recomendou o **Sereno** como base, por ser o mais seguro com qualquer cor de clínica.

## Decisão

Oferecer **as três direções como design systems escolhíveis**.

O custo foi discutido e aceito: cada direção muda a estrutura (menu, cabeçalho, blocos da tela inicial), não só o tema, então toda tela nova pode precisar de até três versões. A aposta é que, depois do MVP, as mudanças sejam menores e o custo de manter três versões caiba no ritmo do projeto.

## Como implementar (proposta)

### 1. Separar o que é tema do que é estrutura

- **Tema:** cada design system é um preset em `src/theme/designSystems/` (ex.: `sereno.ts`, `preciso.ts`, `acolhedor.ts`). O preset entra em `createAppTheme` junto com as cores da clínica e o modo claro/escuro. Cobre tipografia, densidade, cantos, sombras, fundos, cores secundárias e a aparência dos componentes do MUI (`components` do tema). As cores continuam sendo da clínica: o preset define o estilo em volta delas.
- **Estrutura:** o preset também declara as variantes estruturais, lidas por um `useDesignSystem()` (contexto ao lado do `BrandingProvider`). Exemplos:
  - `shell: 'sidebar' | 'topbar'`;
  - `sidebar: 'floating' | 'dark'`;
  - `homeHero: boolean`;
  - variantes de bloco (`todayAgenda: 'list' | 'table'`, `todayCount: 'bar' | 'donut'`).

  Os componentes escolhem a variante pelo valor, sem `if` espalhado pelo nome do design system.
- **Regra:** sempre que der, a diferença fica no tema. Variante estrutural só quando o desenho realmente pede outro componente.

### 2. Shell

- `ShellLayout` passa a ter duas formas: **menu lateral** (Sereno e Preciso, com estilos diferentes pelo tema) e **navegação no topo** (Acolhedor).
- O menu no topo precisa de solução para os itens de Administração (menu suspenso) e para o celular (gaveta, como hoje).
- O menu continua vindo de `navigation.ts` e das permissões: as duas formas leem a mesma lista.

### 3. Telas

- **Tela inicial:** os blocos de `src/pages/home/widgets.tsx` ganham as variantes do desenho. O layout da clínica (ordem e largura, em `/configs`) vale para os três.
- **Demais telas** (agenda, lista de pacientes, ficha, formulários, Configurações): ainda **não foram desenhadas**. Antes de implementar, pedir ao Claude Design a rodada 2 com essas telas nas três direções. O que for só tema chega sozinho a elas; o que for estrutura precisa do desenho.

### 4. Quem escolhe e onde fica salvo

- **Proposta:** a clínica escolhe o padrão em Configurações › Aparência (com pré-visualização, como a aba Marca), e cada usuário pode trocar o seu depois (como o modo claro/escuro).
- **Escolha da clínica:** precisa de um pedido à API para guardar a aparência em `/configs` (hoje só existe a chave do layout da tela inicial).
- **Escolha do usuário:** pode começar no navegador (`localStorage`, como o `btv.colorMode`). Para acompanhar a pessoa entre computadores, precisa de outro pedido à API (preferência por usuário).

### 5. Cuidados

- **Contraste:** cada preset tem que funcionar com qualquer cor de clínica, nos modos claro e escuro. A faixa cheia do Acolhedor e o menu escuro do Preciso dependem muito da cor da marca e passam pelo cálculo de contraste de `createAppTheme`.
- **Fontes:** servidas pelo app (`@fontsource`), nunca por CDN (LGPD e CSP, task 20). O Preciso precisa de uma fonte monoespaçada.
- **Testes:** cada tela nova ou alterada é conferida nos três design systems e nos dois modos (seis combinações). Vale incluir isso no "Ao terminar uma mudança" do `CLAUDE.md` quando começar.
- **Celular:** conferir as três direções em tela pequena. O desenho atual é só para desktop.

## Próximos passos (depois do MVP)

1. Rodada 2 no Claude Design: agenda, lista de pacientes, ficha, um formulário e Configurações, nas três direções, inclusive no celular.
2. Pedido à API: aparência da clínica em `/configs`.
3. Implementar a base (presets, contexto, as duas formas de shell) com **um** design system completo e depois os outros dois.
4. Configurações › Aparência com pré-visualização.
