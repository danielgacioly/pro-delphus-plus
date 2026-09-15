# Neo — assistente virtual do Pro Delphus+

Data: 2026-09-15
Status: aprovado para virar plano de implementação

## Contexto e objetivo

A Pro Delphus+ quer um assistente de chat interno, batizado **Neo**, pra
responder perguntas simples de quem vende (poucas pessoas, uso esporádico):
que produto serve pra qual área, se um cliente está em atendimento, como
funciona o processo comercial da empresa, comparação de preços entre
produtos/moedas — e, além de responder, **criar e editar orçamentos, pedidos
e clientes** quando a pessoa pedir, sempre com confirmação explícita antes de
gravar qualquer coisa.

Restrição orçamentária: usar a API do Gemini (Google AI Studio) no **free
tier**, sem cartão cadastrado. O usuário já está ciente de que, no free tier,
o Google pode usar prompts/respostas para melhorar os modelos deles — decisão
consciente, aceita para este uso interno de baixo volume.

## Escopo do v1

**Entra:**
- Chat de texto, uma pergunta/resposta por vez (sem streaming).
- Consulta a produtos (por setor, inclusive setores correlatos que o próprio
  modelo infere), preços em todas as moedas/tiers, clientes (busca e
  listagem) e setores.
- Criação e edição de **orçamentos**, com confirmação explícita antes de
  gravar.
- Criação e edição de **pedidos**, com confirmação explícita, usando como
  padrão os dados do cliente vinculado ao orçamento (ver seção "Pedidos:
  limites conhecidos").
- Edição de **clientes**, com confirmação explícita.
- Item novo no menu lateral (`/neo`), disponível pra qualquer usuário logado
  aprovado — sem restrição de papel.

**Fica de fora do v1** (não impede o resto, mas é decisão consciente):
- Histórico de conversa persistido — é só client-side, some ao sair da
  página.
- Streaming de resposta.
- Criação de **clientes novos** via Neo (só edição de existentes — criar do
  zero envolve mais campos de endereço/documento que vale ficar na tela
  normal por enquanto).
- Qualquer tipo de retry automático ou fila se a API do Gemini estourar o
  limite do free tier — a pessoa tenta de novo depois.

## Arquitetura

```
Browser (Neo.tsx)
  │  POST /api/neo/chat { message, history }
  ▼
API (neo.routes.ts)
  │  monta system prompt (persona + texto do processo comercial) + tools
  │  chama Gemini (generateContent, com function calling)
  │
  ├─ Gemini pede tool de LEITURA (buscar_produtos, listar_clientes,
  │  buscar_cliente, listar_setores)
  │  → API roda a consulta no Postgres via Prisma, devolve resultado pro
  │    Gemini, que continua e formula a resposta final.
  │
  └─ Gemini pede tool de ESCRITA (propor_orcamento, propor_edicao_orcamento,
     propor_pedido, propor_edicao_pedido, propor_edicao_cliente)
     → API calcula o preview (reaproveitando a mesma lógica de
       resolveQuoteData/etc. usada nas rotas normais), NÃO grava nada,
       guarda o preview em memória com um id curto, e devolve pro front
       tanto o texto do Neo quanto um `pendingAction` estruturado.

Frontend renderiza pendingAction como um cartão com botões "Confirmar" /
"Cancelar" dentro da conversa.

Confirmar  →  POST /api/neo/actions/:id/confirm
              → executa a gravação de verdade, chamando a MESMA função
                compartilhada que a rota HTTP normal (POST/PATCH
                /api/quotes, /api/orders, /api/clients) já usa — mesma
                numeração, mesma geração de PDF/XLSX, mesmas regras.
              → devolve o recurso criado/editado no mesmo formato (DTO)
                que as telas normais já consomem.

Cancelar / expirar (15 min) → descarta o preview, nada acontece.
```

O modelo nunca escreve no banco diretamente — toda escrita passa pelo mesmo
código que a interface normal usa, só que disparada por um clique real do
usuário, não por texto livre interpretado pela IA.

## Backend

### Dependências e configuração novas
- Pacote `@google/genai` (SDK oficial do Gemini).
- `GEMINI_API_KEY` nova variável obrigatória em `env.ts` (mesma validação
  "obrigatório, falha no boot se faltar" que as outras chaves), em
  `apps/api/.env`, `.env.example`, `.env.prod`, `.env.prod.example` e
  `docker-compose.prod.yml`.
- Modelo: `gemini-2.5-flash`.
- `apps/api/src/lib/neoKnowledge.ts` — string exportada com o texto do
  processo comercial (o usuário fornece o conteúdo; fica isolado nesse
  arquivo pra editar sem mexer em mais nada).

### Refactor necessário (sem mudar comportamento das rotas existentes)
Extrair de `quotes.routes.ts`, `orders.routes.ts` e `clients.routes.ts` as
partes de criação/edição que hoje vivem só dentro do handler HTTP, para
funções chamáveis também pelo endpoint de confirmação do Neo:
- Orçamento: a lógica de `resolveQuoteData` já é compartilhada; falta extrair
  o bloco de reserva de número + `prisma.quote.create` (rota POST) e o bloco
  de update em transação (rota PATCH) para funções próprias
  (`createQuoteRecord`, `updateQuoteRecord`).
- Pedido: mesma extração para o handler `ordersRouter.post('/')` (reserva de
  `orderNumber`, criação, geração de documentos via `buildAndWriteDocuments`)
  e para o(s) handler(s) PATCH relevante(s).
- Cliente: extrair o corpo do `clientsRouter.patch('/:id')` numa função
  `updateClientRecord`.

Cada rota HTTP existente passa a chamar essas funções extraídas — o
comportamento observável não muda, é reuso, não reescrita.

### Rota do Neo
`apps/api/src/routes/neo.routes.ts`, montada em `/api/neo`, atrás do mesmo
`requireAuth` das outras rotas.

- `POST /api/neo/chat` — body `{ message: string, history: {role, parts}[] }`.
  Roda o loop de function calling do Gemini (até resolver em texto final ou
  bater um teto de iterações, ex. 5, pra nunca loopar infinito). Responde
  `{ reply: string, pendingAction?: {...} }`.
- `POST /api/neo/actions/:id/confirm` — executa a ação pendente (chama a
  função extraída correspondente), devolve o recurso criado/editado.
- `POST /api/neo/actions/:id/cancel` — descarta.

Ações pendentes ficam num `Map` em memória no processo da API (id →
`{ kind, payload, userId, expiresAt }`), TTL 15 min, só o usuário que gerou
pode confirmar. Reinício da API derruba pendências em aberto — aceitável pro
volume esperado; a pessoa só pede de novo.

### Ferramentas (tools) do Gemini

**Leitura (sem confirmação):**
- `buscar_produtos({ setores?: string[], texto?: string })` — produtos
  ativos, filtra por setor(es) e/ou nome/descrição; devolve nome, SKU,
  setores, tipo e todos os preços (BRL, USD, USD distribuidor, EUR). O
  próprio modelo decide quais setores são "correlatos" a partir da lista que
  `listar_setores` devolve — não há relação de setor-correlato no banco.
- `listar_clientes({ filtro?: string, setor?: string, emAtendimento?: boolean })`
  — busca ampla (nome, instituição, setor de interesse, status `inService`).
- `buscar_cliente({ nome: string })` — lookup pontual.
- `listar_setores()` — nomes de todos os setores.

**Escrita (sempre via preview + confirmação):**
- `propor_orcamento({ clienteId? | clienteNome, itens: [{produtoId, quantidade}], moeda?, tier?, exportScope?, observacoes? })`
  — roda `resolveQuoteData` pra calcular preços/total reais, guarda o
  preview, devolve resumo.
- `propor_edicao_orcamento({ orcamentoId, ...mudanças })` — idem, em cima de
  um orçamento existente.
- `propor_pedido({ orcamentoId, ...campos opcionais })` — ver limites
  abaixo.
- `propor_edicao_pedido({ pedidoId, ...mudanças })`.
- `propor_edicao_cliente({ clienteId, ...mudanças })`.

### Pedidos: limites conhecidos
`Order` tem bem mais campos obrigatórios/operacionais que `Quote` (peso,
número de caixas, divisão por caixa, Incoterms, forma de pagamento, AWB).
Muitos desses só um humano decide de verdade (quantas caixas físicas, qual
transportadora). Pra não inventar dado logístico:
- `billToText`, `shipToText` e `orderedByEmail` são preenchidos
  automaticamente a partir do cadastro do cliente vinculado ao orçamento
  (`Client.billToText`, `Client.shipToText`, `Client.email`) quando existir.
  Sem cliente vinculado com esses dados, o Neo pergunta antes de propor.
- Os demais campos (peso, caixas, Incoterms, forma de pagamento) usam os
  mesmos defaults que a tela normal aceitaria em branco (ex.
  `packageCount: 1`, `prepaymentBy: WIRE_TRANSFER` pra internacional /
  `PIX` pra nacional) e ficam editáveis depois na tela de Pedidos, igual um
  pedido criado manualmente com campos opcionais em branco.
- O cartão de confirmação deixa isso explícito ("vou criar com 1 caixa,
  pagamento por transferência — quer ajustar antes?").

## Frontend

- `apps/web/src/pages/Neo.tsx` — chat: lista de mensagens, campo de texto,
  estado de carregando, erro amigável em falha. Cartão de confirmação
  (`pendingAction`) com resumo legível da ação e botões Confirmar/Cancelar.
- Novo ícone (`IconBot` ou similar) em `components/icons.tsx`, seguindo o
  padrão SVG existente.
- Item novo em `navItems` (`Layout.tsx`), rota `/neo` dentro do
  `<ProtectedRoute />` sem restrição de papel, registrada em `App.tsx`.
- Nível visual: seguir a skill `frontend-design` na hora de construir —
  mesma paleta (`ink-900`/`brand-600`), mesmas sombras suaves e restrição
  visual do resto do produto, nada de "cara de IA genérica".

## Segurança e privacidade

- Toda rota do Neo atrás de `requireAuth` — mesma autenticação do resto do
  app.
- Escrita nunca acontece sem confirmação explícita via clique (não texto
  livre) — ver "Arquitetura".
- Free tier do Gemini: usuário ciente de que dado passa pelas condições do
  plano gratuito (ver "Contexto e objetivo").
- Ações pendentes só podem ser confirmadas por quem as gerou (checagem de
  `userId` no confirm).

## Erros e limites

- Falha na API do Gemini (limite do free tier, rede) → resposta de erro
  tratada, front mostra "Neo não conseguiu responder agora, tenta de novo em
  instantes". Sem retry automático.
- Loop de function calling tem teto de iterações (evita loop infinito se o
  modelo insistir em chamar tools sem nunca concluir).
- Confirmação de ação expirada ou de outro usuário → erro claro, sem
  executar nada.

## Testes

Sem suíte automatizada no projeto hoje (confirmado — não existe nenhum
`*.test.ts` no repo), então o padrão é teste manual, local primeiro:
1. Subir API + web localmente.
2. Perguntas de leitura: produto por setor (incluindo pergunta que exige
   inferir setor correlato), status de cliente (`inService`), pergunta sobre
   processo comercial, comparação de preço entre produtos/moedas.
3. Fluxo de escrita: pedir um orçamento, conferir o cartão de preview,
   confirmar, conferir que o orçamento aparece certinho na tela de
   Orçamentos (número, PDF, itens, total) — comparar com um criado
   manualmente. Repetir pra edição de orçamento, criação/edição de pedido e
   edição de cliente.
4. Testar cancelar um preview e confirmar que nada foi gravado.
5. Só depois de validado localmente, deploy pro servidor (nova
   `GEMINI_API_KEY` no `.env.prod`, redeploy).

## Processo de implementação

Trabalho feito numa branch nova (pedido explícito do usuário), não direto em
`main`.
