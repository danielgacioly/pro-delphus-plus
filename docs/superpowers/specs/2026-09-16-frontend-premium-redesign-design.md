# Repaginada de front-end premium — Pro Delphus+

## Contexto

O Pro Delphus+ é o sistema interno de gestão comercial da empresa (catálogo, tabela de
preços multi-moeda, orçamentos, pedidos com geração automática de PDF/Excel e
documentos de exportação, clientes, métricas, um quadro Kanban pessoal e o assistente
de IA Neo). O objetivo é uma repaginada visual completa: o produto precisa parecer
premium — registro Apple/Linear/Stripe-dashboard, slick e clean, mas sem perder
nenhuma regra de negócio hoje expressa na UI — e deixar de "parecer vibe code".

Antes deste spec, alinhamos duas listas de referência (características ruins de site
vibe-coded a evitar; características premium adequadas a este tipo de produto —
ferramenta operacional densa em dados, não landing page) e exploramos o código com
três agentes em paralelo (biblioteca de componentes compartilhados, páginas de
dashboard/Kanban/Neo, formulários transacionais).

**Diagnóstico**: o projeto não sofre de ausência de sistema de design. Já existe uma
fundação deliberada em [index.css](../../../apps/web/src/index.css) — paleta neutra
quente, escala tipográfica com propósito, números tabulares, sombras em camadas,
materiais translúcidos — e páginas como
[PriceTable.tsx](../../../apps/web/src/pages/PriceTable.tsx),
[Products.tsx](../../../apps/web/src/pages/Products.tsx),
[Stats.tsx](../../../apps/web/src/pages/Stats.tsx) e
[HelpModal.tsx](../../../apps/web/src/components/HelpModal.tsx) já materializam bem
esses tokens. O problema real é **inconsistência e fragmentação**: cada tela/modal/
form parece ter nascido isolada, reimplementando do zero peças que já existem em
outro lugar (chevron de select, botão de limpar busca, card interativo, banner de
aviso), cada uma com uma pequena variação de raio, opacidade ou cor. Nenhuma
divergência é grave sozinha; a soma é o que o olho lê como "gerado por prompts
diferentes".

Uma exceção a essa regra geral é a [Home.tsx](../../../apps/web/src/pages/Home.tsx):
ali o problema não é falta de polimento (o código é limpo e usa bem o `ui/`), é a
própria ideia da tela. Ela mostra uma saudação seguida de uma grade uniforme de 9
cards de navegação — e as 9 rotas para as quais eles apontam já estão, sempre
visíveis, na sidebar (comparar `shortcuts`/`adminShortcuts` em Home.tsx:27-70 com
`navItems`/`adminNavItems` em
[Layout.tsx:39-54](../../../apps/web/src/components/Layout.tsx)). É o clichê mais
reconhecível de dashboard gerado por IA: "hero + grid de launcher cards" que duplica
a navegação sem agregar informação nenhuma.

## Decisões já tomadas

- **Ordem de execução**: fundação (tokens + componentes compartilhados) primeiro, em
  bloco fechado, antes de tocar em qualquer página.
- **Mascote do Neo**: mantém. Pode-se revisar peso/protagonismo visual (tamanho,
  posição, quanto espaço ocupa), mas **a animação do NeoMascot e a foto/imagem de
  perfil não podem ser alteradas**.
- **Componentes que faltam** (Combobox, Tabs, Tooltip, Dropdown/Menu): usar uma base
  pronta (Radix UI / Headless UI, ou outra lib madura se fizer mais sentido caso a
  caso), estilizada 100% com os tokens do projeto — não construir do zero.
- **Refactor estrutural**: o refactor de duplicação em `MyDesk.tsx` (980 linhas, duas
  stat-tiles duplicadas) e `OrderDetail.tsx` (duplica lógica de campos de
  `NewOrder.tsx`) entra nesta fase, junto do redesign visual — não fica para depois.
- **Testes**: o projeto não tem framework de teste automatizado hoje (só `tsc -b` e
  `oxlint` como scripts de verificação — ver `apps/web/package.json`). Os planos de
  implementação desta fase usam typecheck + lint + verificação visual manual/via
  browser como critério de "passou", em vez de introduzir um framework de teste novo
  como pré-requisito não solicitado.

## Abordagem — em camadas, nesta ordem

### Camada A — Fundação de tokens (`apps/web/src/index.css`, `apps/web/src/lib/cn.ts`)

- **`lib/cn.ts`**: adotar `clsx` + `tailwind-merge` para resolver conflito de
  classes — pré-requisito para `Card`/`InteractiveCard` (Camada B) pararem de
  duplicar string de classes inteira e passarem a compor por herança.
- **Cor semântica de erro/perigo**: criar uma rampa `--color-danger-*` dedicada,
  separada de `--color-brand-*` (hoje o `danger` do Button é idêntico ao `primary`,
  e o texto de erro de formulário usa a mesma cor do CTA principal).
- **Convenção de border-radius por nível de superfície**: documentar qual raio da
  escala já existente (`--radius-sm..3xl`) corresponde a controles inline vs. cards
  de conteúdo vs. superfícies flutuantes, substituindo as ~4 convenções soltas hoje
  em uso.
- **Convenção de opacidade**: documentar uma escala curta e nomeada (hover sutil,
  hover de destaque, fundo de estado, borda de estado/overlay) para substituir os
  valores ad hoc espalhados (`/4, /6, /8, /10, /12, /15, /25`).

### Camada B — Componentes compartilhados (`apps/web/src/components/ui/*`)

- **`Button.tsx`**: variante `danger` real (usando o novo token), estado `isLoading`
  com `Spinner`, revisar o `h-9.5` arbitrário do tamanho `md`, fazer `IconButton`
  compor `variants.ghost` em vez de reimplementar hover/active.
- **Convenção única de "estado selecionado/ativo"**: hoje há três linguagens visuais
  diferentes para a mesma ideia (pílula em `SegmentedControl`, preenchimento sólido
  em `FilterChip`, tom suave em `Badge`).
- **`Alert`/`Banner` com variantes de tom** (erro/aviso/info/sucesso) — maior
  alavancagem da camada: substitui pelo menos 5 banners ad hoc hoje espalhados
  (`ClientDetail`, `NewOrder` duplicateFrom, `OrderDetail` documentos desatualizados,
  etc.). Usar o banner de mismatch de
  [BoxAssignmentFields.tsx](../../../apps/web/src/components/BoxAssignmentFields.tsx)
  (linhas ~58-77) como referência de qualidade.
- **`Combobox`/`Autocomplete` único** (base Radix/Headless UI): substitui o
  autocomplete hand-rolled de produto em `NewQuote.tsx` (~linhas 390-567) e o
  dropdown de busca de `ClientPicker.tsx`.
- **`Spinner`, `Tooltip`, `Toast`, `Tabs` completo (com ARIA/teclado)**: primitivos
  hoje ausentes.
- **Stat tile único**: consolidar as três implementações quase idênticas de
  "shortcut/stat card" (`Home.tsx` `ShortcutCard`, `Stats.tsx` `StatCard`,
  `MyDesk.tsx` tiles ~linhas 533-558) num componente `ui/` único.
- **Limpeza pontual**: `Select`/`BackLink` reimplementam SVG de chevron inline em
  vez de usar `../icons`; `DropZone.tsx` não usa `cn()` e não tem `role`/teclado;
  `ConfirmDeleteModal.tsx` reimplementa Button/Input do zero; shims de re-export
  `Badge.tsx`/`EmptyState.tsx` para `ui/Feedback.tsx` viram um caminho canônico.

### Camada C — Páginas

- **Preservar como referência** (não redesenhar do zero): `PriceTable.tsx`,
  `Products.tsx`, `Stats.tsx`, `HelpModal.tsx`.
- **`Home.tsx`**: substituir a grade de 9 launcher-cards por uma Home que funcione
  como dashboard de verdade — bloco "o que precisa da sua atenção" usando dados já
  calculados pelo sistema, mais no máximo 2-3 atalhos de ação real.
- **`NewProduct.tsx`/`ProductFieldSet.tsx`**: migrar `Field`/`SectionLabel` local
  para `ui/Form`; dar às 4 colunas de preço por moeda/tier um agrupamento visual.
- **`OrderDetail.tsx`** ↔ **`NewOrder.tsx`**: extrair lógica de campos duplicada num
  subcomponente compartilhado (refactor estrutural). Avisos migram para `Alert`.
  `NewOrder` ganha indicação visual explícita de modo nacional vs. internacional.
- **`NewQuote.tsx`**: bloco por item passa a usar `Combobox`/`Tooltip`; distinção
  "preço customizado vs. de tabela" ganha badge/estado visual dedicado.
- **`ClientDetail.tsx`/`Clients.tsx`**: estados migram para `Alert`/`Badge`.
- **`BoxAssignmentFields.tsx`**: manter lógica/alerta; linhas de caixa ganham
  estrutura de tabela/lista.
- **`MyDesk.tsx`**: refactor estrutural — extrair os dois modais e as stat-tiles
  duplicadas para componentes próprios.
- **`Neo.tsx`**: normalizar bolhas de chat/textarea/botão para os primitivos `ui/`.
  `NeoMascot` permanece intocado (animação e imagem de perfil).
- **`Stats.tsx`**: cores de gráfico via tokens de `index.css` em vez de hex
  hardcoded.
- **`Globe.tsx`**: checar peso visual em AuthLayout/ClientDetail antes de decidir.

### Camada D — Acabamento

- Mapear números "importantes" do app e aplicar `AnimatedNumber` sistematicamente.

## Arquivos críticos

- `apps/web/src/index.css`, `apps/web/src/lib/cn.ts` — fundação
- `apps/web/src/components/ui/Button.tsx`, `Card.tsx`, `Controls.tsx`, `Form.tsx`,
  `Feedback.tsx`, `Table.tsx`, `Page.tsx` — biblioteca compartilhada
- `apps/web/src/components/BoxAssignmentFields.tsx` — referência de qualidade
- `apps/web/src/pages/Home.tsx`, `NewQuote.tsx`, `NewOrder.tsx`, `OrderDetail.tsx`,
  `NewProduct.tsx`, `Neo.tsx`, `MyDesk.tsx`, `Stats.tsx` — páginas da Camada C
- `apps/web/src/components/ProductFieldSet.tsx`, `ClientPicker.tsx`,
  `ConfirmDeleteModal.tsx`, `DropZone.tsx` — limpeza pontual

## Verificação

- **Camada A/B**: `npm run build` (tsc -b + vite build) e `npm run lint` (oxlint)
  sem erros; checar visualmente no `npm run dev:web` que nenhum token quebrou;
  checar teclado/foco nos novos `Combobox`/`Tabs`/`Tooltip`.
- **Camada C**: para cada página tocada, percorrer manualmente o fluxo de negócio
  real que ela cobre, confirmando que nenhuma regra de negócio (README.md) mudou de
  comportamento, só de apresentação.
- **Home.tsx**: dados do bloco de "atenção" batem com os mesmos números já mostrados
  em Stats/MyDesk (mesma fonte de dado).
- **Regressão visual geral**: revisar em light mode (único suportado hoje) e em pelo
  menos uma viewport estreita (~400px).
