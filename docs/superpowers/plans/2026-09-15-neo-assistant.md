# Neo Virtual Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship "Neo", a Gemini-backed chat assistant inside Pro Delphus+ that answers questions about products/sectors/clients and can create or edit quotes, orders and clients — but only after the user clicks an explicit "Confirmar" on a preview card, never from free-text.

**Architecture:** New `POST /api/neo/chat` endpoint runs a Gemini function-calling loop against read tools (products/clients/sectors) and "propose" tools (quote/order/client writes). Propose tools compute a real preview using the *same* business logic the existing quote/order/client routes already use (extracted into shared functions, not duplicated) but never touch the database. A separate `POST /api/neo/actions/:id/confirm` endpoint executes the actual write, deterministically, with no LLM involved. Frontend is a new `/neo` page with a chat UI and a confirmation-card component.

**Tech Stack:** Express + Prisma (existing), `@google/genai` (new), React + react-router + axios (existing), Tailwind (existing). No test framework exists in this repo — verification is manual (curl + browser), matching the project's existing convention.

**Spec:** `docs/superpowers/specs/2026-09-15-neo-assistant-design.md`

## Global Constraints

- Neo never writes to the database directly from a tool call — every write goes through a preview (`propor_*` tool) + a separate, explicit `POST /api/neo/actions/:id/confirm` triggered by a real button click, never by parsing free text like "sim".
- Any field missing for a write action must be *asked for* in conversation, never silently assumed — except automatic lookups from existing records (e.g. client's `billToText`/`shipToText`/`email`) and existing system defaults the user explicitly authorizes.
- All extracted business-logic functions (`createQuoteRecord`, `updateQuoteRecord`, `createOrderRecord`, `updateOrderRecord`, `updateClientRecord`) must produce byte-for-byte the same behavior the existing HTTP routes already have — this is a pure extraction, not a rewrite. Existing routes must keep working exactly as before.
- `GEMINI_API_KEY` is a required env var (same "fail fast at boot if missing" pattern as `JWT_ACCESS_SECRET` etc. in `apps/api/src/lib/env.ts`), not silently optional.
- Model: `gemini-2.5-flash`.
- Every Neo route sits behind `requireAuth` (`apps/api/src/middleware/auth.ts`) — any approved logged-in user (no role restriction).
- No new test framework — verify manually with `curl` (backend) and the browser (frontend), per the spec's Testes section.
- Frontend visual bar: same design language as the rest of the app (`ink-900`/`brand-600` tokens, soft shadows, restrained "Apple-level" polish) — apply the `frontend-design` skill when building `Neo.tsx`.
- Work happens on a new git branch, not directly on `main` (explicit user request).

---

## Task 1: Branch, dependency and env var

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/lib/env.ts`
- Modify: `apps/api/.env`, `apps/api/.env.example`, `.env.prod.example`
- Modify: `docker-compose.prod.yml`

**Interfaces:**
- Produces: `env.GEMINI_API_KEY: string` (validated, non-empty), available to every later backend task.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feature/neo-assistant
```

- [ ] **Step 2: Install the Gemini SDK**

```bash
npm install @google/genai --workspace=apps/api
```

- [ ] **Step 3: Add `GEMINI_API_KEY` to the env schema**

In `apps/api/src/lib/env.ts`, add to `envSchema` (after `ADMIN_SEED_PASSWORD`):

```ts
  // Google AI Studio free-tier key — https://aistudio.google.com/apikey.
  // Sem default: sem chave, o Neo não tem como funcionar, e é melhor a API
  // recusar subir do que o endpoint falhar silenciosamente na primeira
  // pergunta.
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY é obrigatório — gere uma chave grátis em https://aistudio.google.com/apikey'),
```

- [ ] **Step 4: Get a free API key and add it locally**

Go to https://aistudio.google.com/apikey, create a key (no billing required), and add it to `apps/api/.env`:

```
GEMINI_API_KEY=<key from AI Studio>
```

Add the same line (empty value) to `apps/api/.env.example`:
```
GEMINI_API_KEY=
```

- [ ] **Step 5: Add the var to prod config**

In `.env.prod.example`, add near `ADMIN_SEED_PASSWORD`:
```
# Chave gratuita do Google AI Studio (https://aistudio.google.com/apikey) —
# usada pelo Neo, o assistente virtual.
GEMINI_API_KEY=
```

In `docker-compose.prod.yml`, in the `api` service `environment` block, add after `ADMIN_SEED_PASSWORD: ${ADMIN_SEED_PASSWORD}`:
```yaml
      GEMINI_API_KEY: ${GEMINI_API_KEY}
```

- [ ] **Step 6: Verify the API still boots**

```bash
npm run dev --workspace=apps/api
```
Expected: starts normally (`Pro Delphus+ API rodando em http://localhost:4000`), no validation error. If it fails with a `GEMINI_API_KEY` message, the key wasn't added to `apps/api/.env` correctly.

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/src/lib/env.ts apps/api/.env.example .env.prod.example docker-compose.prod.yml
git commit -m "feat(neo): add GEMINI_API_KEY config and @google/genai dependency"
```

(Don't commit `apps/api/.env` or `.env.prod` — both are gitignored real secrets.)

---

## Task 2: Extract `createQuoteRecord` / `updateQuoteRecord`

**Files:**
- Modify: `apps/api/src/routes/quotes.routes.ts`

**Interfaces:**
- Consumes: `resolveQuoteData(data, requesterId)`, `generateQuoteFiles(quoteNumber, data, resolved)`, `reservationBackoff(attempt)`, `isQuoteNumberConflict(err)` — all already defined in this file.
- Produces: `export async function createQuoteRecord(data: CreateQuoteInput, requesterId: string): Promise<QuoteWithInclude>` and `export async function updateQuoteRecord(existingId: string, data: CreateQuoteInput, requesterId: string): Promise<QuoteWithInclude>` (where `QuoteWithInclude` is whatever `prisma.quote.create({..., include})` already returns — no new type needed, just reuse the inferred return type). Also `export async function completedOrdersFor(quoteId: string): Promise<{ orderNumber: number }[]>`. Later tasks (7, 9) import these three from `../routes/quotes.routes.js`.

- [ ] **Step 1: Add the extracted functions**

In `apps/api/src/routes/quotes.routes.ts`, right after the `isQuoteNumberConflict` function (before `quotesRouter.post(...)`), add:

```ts
export async function completedOrdersFor(quoteId: string) {
  return prisma.order.findMany({
    where: { quoteId, status: 'COMPLETED' },
    select: { orderNumber: true },
    orderBy: { orderNumber: 'asc' },
  })
}

export async function createQuoteRecord(data: CreateQuoteInput, requesterId: string) {
  const resolved = await resolveQuoteData(data, requesterId)
  const { language, currency, priceTier, lineItems, subtotal, total, notes } = resolved

  let quote: Awaited<ReturnType<typeof prisma.quote.create>> | undefined
  let quoteNumber = ''
  for (let attempt = 0; attempt < 12; attempt++) {
    if (attempt > 0) await reservationBackoff(attempt)
    const now = new Date()
    const datePrefix = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const todayCount = await prisma.quote.count({ where: { quoteNumber: { startsWith: `${datePrefix}-` } } })
    quoteNumber = `${datePrefix}-${String(todayCount + 1).padStart(2, '0')}`
    try {
      quote = await prisma.quote.create({
        data: {
          quoteNumber,
          language,
          currency,
          exportScope: data.exportScope,
          priceTier,
          clientPrefix: data.clientPrefix,
          clientName: data.clientName,
          clientId: data.clientId ?? null,
          notes,
          freight: data.freight ?? null,
          discount: data.discount,
          subtotal,
          total,
          createdById: requesterId,
          items: {
            create: lineItems.map((i) => ({
              sku: i.sku,
              productId: i.productId,
              title: i.titleOverride,
              quantity: i.quantity,
              listPrice: i.listPrice,
              unitPrice: i.unitPrice,
              lineTotal: i.lineTotal,
              description: i.description,
            })),
          },
        },
        include,
      })
      break
    } catch (err) {
      if (isQuoteNumberConflict(err)) continue
      throw err
    }
  }
  if (!quote) throw new HttpError(409, 'Não foi possível reservar um número de orçamento. Tente novamente.')

  const { pdfUrl, xlsxUrl } = await generateQuoteFiles(quoteNumber, data, resolved)
  return prisma.quote.update({ where: { id: quote.id }, data: { pdfUrl, xlsxUrl }, include })
}

export async function updateQuoteRecord(existingId: string, data: CreateQuoteInput, requesterId: string) {
  const existing = await prisma.quote.findUnique({ where: { id: existingId } })
  if (!existing) throw new HttpError(404, 'Orçamento não encontrado')

  const resolved = await resolveQuoteData(data, requesterId)
  const { pdfUrl, xlsxUrl } = await generateQuoteFiles(existing.quoteNumber, data, resolved)
  const { language, currency, priceTier, lineItems, subtotal, total, notes } = resolved

  return prisma.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({ where: { quoteId: existing.id } })
    const updated = await tx.quote.update({
      where: { id: existing.id },
      data: {
        language,
        currency,
        exportScope: data.exportScope,
        priceTier,
        clientPrefix: data.clientPrefix,
        clientName: data.clientName,
        clientId: data.clientId ?? null,
        notes,
        freight: data.freight ?? null,
        discount: data.discount,
        subtotal,
        total,
        pdfUrl,
        xlsxUrl,
        items: {
          create: lineItems.map((i) => ({
            sku: i.sku,
            productId: i.productId,
            title: i.titleOverride,
            quantity: i.quantity,
            listPrice: i.listPrice,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
            description: i.description,
          })),
        },
      },
      include,
    })
    await tx.$executeRaw`UPDATE quotes SET "updatedAt" = now() WHERE id = ${existing.id}`
    return updated
  })
}
```

Also add `export` in front of `type CreateQuoteInput = z.infer<typeof createQuoteSchema>` so later tasks can import the type, and `export` in front of `const createQuoteSchema = z.object({...})` so Task 8 can reuse it for input validation.

- [ ] **Step 2: Rewrite the existing routes to call the extracted functions**

Replace the body of `quotesRouter.post('/', ...)` (everything between `asyncHandler(async (req, res) => {` and its closing `})`) with:

```ts
    const data = createQuoteSchema.parse(req.body)
    const updated = await createQuoteRecord(data, req.user!.id)
    res.status(201).json({ quote: toQuoteDTO(updated) })
```

Replace the body of `quotesRouter.patch('/:id', ...)` with:

```ts
    const data = createQuoteSchema.parse(req.body)

    if (!data.confirmCompletedOrders) {
      const completedOrders = await completedOrdersFor(req.params.id)
      if (completedOrders.length > 0) {
        throw new HttpError(
          409,
          'Este orçamento já tem pedido concluído vinculado. Editar vai mudar os valores desse pedido.',
          { completedOrderNumbers: completedOrders.map((o) => o.orderNumber) },
        )
      }
    }

    const quote = await updateQuoteRecord(req.params.id, data, req.user!.id)
    res.json({ quote: toQuoteDTO(quote) })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc -p tsconfig.json --noEmit
```
Expected: no errors. (If `include` isn't accessible where the extracted functions live, move the functions below the `const include = {...}` declaration — it's already defined near the top of the file, so this should just work.)

- [ ] **Step 4: Manually verify the existing quote flow still works**

With the API running (`npm run dev --workspace=apps/api`) and the web app running (`npm run dev --workspace=apps/web`), log in and create a quote normally through the UI (Orçamentos → Novo), then edit it. Confirm both still produce a PDF/XLSX and save correctly, exactly like before this change (this is a pure refactor — nothing about the UI-visible behavior should differ).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/quotes.routes.ts
git commit -m "refactor(quotes): extract createQuoteRecord/updateQuoteRecord for reuse by Neo"
```

---

## Task 3: Extract `createOrderRecord` / `updateOrderRecord`

**Files:**
- Modify: `apps/api/src/routes/orders.routes.ts`

**Interfaces:**
- Consumes: `orderFieldsSchema`, `fetchExchangeRate`, `nextOrderNumber`, `reservationBackoff`, `isOrderNumberConflict`, `assertPrepaymentAllowed`, `assertBoxAssignmentsFit`, `formatPackageCountLabel`, `buildAndWriteDocuments`, `quoteInclude`, `include` — all already defined/imported in this file.
- Produces: `export async function createOrderRecord(data: OrderFieldsInput, requesterId: string)` and `export async function updateOrderRecord(existingId: string, data: Omit<OrderFieldsInput, 'quoteId'>, requesterId: string)` where `OrderFieldsInput = z.infer<typeof orderFieldsSchema>`. Both return the same shape `prisma.order.update({..., include})` already returns. Task 8/9 import these from `../routes/orders.routes.js`.

- [ ] **Step 1: Export the input type**

Find `const orderFieldsSchema = z.object({...})` and add `export` in front of it. Right after its closing `})`, add:
```ts
export type OrderFieldsInput = z.infer<typeof orderFieldsSchema>
```

- [ ] **Step 2: Add `createOrderRecord`**

Right before `ordersRouter.post('/', ...)`, add:

```ts
export async function createOrderRecord(data: OrderFieldsInput, requesterId: string) {
  const quote = await prisma.quote.findUnique({ where: { id: data.quoteId }, include: quoteInclude })
  if (!quote) throw new HttpError(404, 'Orçamento não encontrado')
  if (quote.items.length === 0) throw new HttpError(400, 'Este orçamento não possui itens')

  const isNational = quote.exportScope === 'NATIONAL'
  const exchangeRate = isNational
    ? null
    : (data.exchangeRate ??
      (await fetchExchangeRate(quote.currency as 'USD' | 'EUR').catch(() => {
        throw new HttpError(400, 'Não foi possível obter o câmbio automaticamente. Informe o valor manualmente.')
      })))
  const packageCount = data.packageCount ?? 1
  const prepaymentBy = data.prepaymentBy ?? 'WIRE_TRANSFER'
  assertPrepaymentAllowed(prepaymentBy, isNational)
  assertBoxAssignmentsFit(data.boxAssignments, packageCount)

  let order: Awaited<ReturnType<typeof prisma.order.create>> | undefined
  let orderNumber = 0
  for (let attempt = 0; attempt < 12; attempt++) {
    if (attempt > 0) await reservationBackoff(attempt)
    orderNumber = await nextOrderNumber()
    try {
      order = await prisma.order.create({
        data: {
          orderNumber,
          quoteId: data.quoteId,
          purchaseOrder: data.purchaseOrder ?? null,
          orderedByEmail: data.orderedByEmail,
          shipDate: data.shipDate ?? null,
          billToText: data.billToText,
          shipToText: data.shipToText,
          shipToNote: data.shipToNote ?? null,
          numberOfPackages: formatPackageCountLabel(packageCount),
          netWeightKg: data.netWeightKg ?? null,
          grossWeightKg: data.grossWeightKg ?? null,
          awbNumber: data.awbNumber ?? null,
          incoterms: data.incoterms ?? null,
          shippingMethod: data.shippingMethod ?? null,
          itemWeightsKg: data.itemWeightsKg,
          packageCount,
          boxAssignments: data.boxAssignments ?? undefined,
          prepaymentBy,
          paypalFee: data.paypalFee ?? null,
          nfNumber: data.nfNumber ?? null,
          nfDate: data.nfDate ?? null,
          exchangeRate,
          createdById: requesterId,
        },
        include,
      })
      break
    } catch (err) {
      if (isOrderNumberConflict(err)) continue
      throw err
    }
  }
  if (!order) throw new HttpError(409, 'Não foi possível reservar um número de pedido. Tente novamente.')

  const orderForDocs = {
    orderNumber,
    purchaseOrder: data.purchaseOrder ?? null,
    orderedByEmail: data.orderedByEmail,
    invoiceDate: order.invoiceDate,
    billToText: data.billToText,
    shipToText: data.shipToText,
    netWeightKg: data.netWeightKg ?? null,
    grossWeightKg: data.grossWeightKg ?? null,
    awbNumber: data.awbNumber ?? null,
    incoterms: data.incoterms ?? null,
    shippingMethod: data.shippingMethod ?? null,
    prepaymentBy,
    paypalFee: data.paypalFee ?? null,
    nfNumber: data.nfNumber ?? null,
    nfDate: data.nfDate ?? null,
    exchangeRate,
    itemWeightsKg: data.itemWeightsKg ?? null,
    packageCount,
    boxAssignments: data.boxAssignments ?? null,
  }

  const docUrls = await buildAndWriteDocuments(orderForDocs, quote)
  return prisma.order.update({ where: { id: order.id }, data: docUrls, include })
}
```

- [ ] **Step 3: Add `updateOrderRecord`**

Right before the `ordersRouter.patch('/:id', ...)` handler that does the full field edit (the one with the big `merged` object — **not** the `/:id/status` one), add:

```ts
export async function updateOrderRecord(existingId: string, data: Omit<OrderFieldsInput, 'quoteId'>, _requesterId: string) {
  const existing = await prisma.order.findUnique({ where: { id: existingId }, include: { quote: { include: quoteInclude } } })
  if (!existing) throw new HttpError(404, 'Pedido não encontrado')

  const merged = {
    orderNumber: existing.orderNumber,
    purchaseOrder: data.purchaseOrder !== undefined ? data.purchaseOrder || null : existing.purchaseOrder,
    orderedByEmail: data.orderedByEmail ?? existing.orderedByEmail,
    invoiceDate: existing.invoiceDate,
    billToText: data.billToText ?? existing.billToText,
    shipToText: data.shipToText ?? existing.shipToText,
    netWeightKg: data.netWeightKg !== undefined ? data.netWeightKg : existing.netWeightKg !== null ? Number(existing.netWeightKg) : null,
    grossWeightKg:
      data.grossWeightKg !== undefined ? data.grossWeightKg : existing.grossWeightKg !== null ? Number(existing.grossWeightKg) : null,
    awbNumber: data.awbNumber !== undefined ? data.awbNumber || null : existing.awbNumber,
    incoterms: data.incoterms !== undefined ? data.incoterms || null : existing.incoterms,
    shippingMethod: data.shippingMethod !== undefined ? data.shippingMethod || null : existing.shippingMethod,
    prepaymentBy: data.prepaymentBy ?? existing.prepaymentBy,
    paypalFee: data.paypalFee !== undefined ? data.paypalFee : existing.paypalFee !== null ? Number(existing.paypalFee) : null,
    nfNumber: data.nfNumber !== undefined ? data.nfNumber || null : existing.nfNumber,
    nfDate: data.nfDate !== undefined ? (data.nfDate ?? null) : existing.nfDate,
    exchangeRate:
      existing.quote.exportScope === 'NATIONAL'
        ? null
        : (data.exchangeRate ?? (existing.exchangeRate !== null ? Number(existing.exchangeRate) : 1)),
    itemWeightsKg: data.itemWeightsKg ?? ((existing.itemWeightsKg as (number | null)[] | null) ?? null),
    packageCount: data.packageCount ?? existing.packageCount,
    boxAssignments: data.boxAssignments ?? ((existing.boxAssignments as BoxAssignments | null) ?? null),
  }

  assertPrepaymentAllowed(merged.prepaymentBy, existing.quote.exportScope === 'NATIONAL')
  assertBoxAssignmentsFit(merged.boxAssignments, merged.packageCount)

  const docUrls = await buildAndWriteDocuments(merged, existing.quote)

  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      purchaseOrder: merged.purchaseOrder,
      orderedByEmail: merged.orderedByEmail,
      shipDate: data.shipDate !== undefined ? (data.shipDate ?? null) : existing.shipDate,
      billToText: merged.billToText,
      shipToText: merged.shipToText,
      itemWeightsKg: merged.itemWeightsKg ?? undefined,
      packageCount: merged.packageCount,
      boxAssignments: merged.boxAssignments ?? undefined,
      shipToNote: data.shipToNote !== undefined ? data.shipToNote || null : existing.shipToNote,
      numberOfPackages: formatPackageCountLabel(merged.packageCount),
      netWeightKg: merged.netWeightKg,
      grossWeightKg: merged.grossWeightKg,
      awbNumber: merged.awbNumber,
      incoterms: merged.incoterms,
      shippingMethod: merged.shippingMethod,
      prepaymentBy: merged.prepaymentBy,
      paypalFee: merged.paypalFee,
      nfNumber: merged.nfNumber,
      nfDate: merged.nfDate,
      exchangeRate: merged.exchangeRate,
      ...docUrls,
    },
    include,
  })
  await prisma.$executeRaw`UPDATE orders SET "documentsGeneratedAt" = now() WHERE id = ${order.id}`
  return order
}
```

Note the `BoxAssignments` type is already imported in this file (used by `assertBoxAssignmentsFit`) — reuse it, don't redeclare.

- [ ] **Step 4: Rewrite the existing routes to call the extracted functions**

Replace the body of `ordersRouter.post('/', ...)` with:
```ts
    const data = orderFieldsSchema.parse(req.body)
    const updated = await createOrderRecord(data, req.user!.id)
    res.status(201).json({ order: await toOrderDTOFresh(updated) })
```

Replace the body of the full-edit `ordersRouter.patch('/:id', ...)` with:
```ts
    const data = orderFieldsSchema.omit({ quoteId: true }).partial().parse(req.body)
    const order = await updateOrderRecord(req.params.id, data, req.user!.id)
    res.json({ order: await toOrderDTOFresh(order) })
```

Leave `ordersRouter.patch('/:id/status', ...)` untouched — it's a separate, simpler endpoint not part of this extraction.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc -p tsconfig.json --noEmit
```
Expected: no errors.

- [ ] **Step 6: Manually verify the existing order flow still works**

Create an order from an existing quote through the UI (Pedidos → Novo), then edit it (e.g. change `packageCount`). Confirm documents regenerate and the order screen shows the same data as before this refactor.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/orders.routes.ts
git commit -m "refactor(orders): extract createOrderRecord/updateOrderRecord for reuse by Neo"
```

---

## Task 4: Extract `updateClientRecord`

**Files:**
- Modify: `apps/api/src/routes/clients.routes.ts`

**Interfaces:**
- Consumes: `clientBodySchema`, `normalize`, `loadAggregates` — already defined in this file.
- Produces: `export async function updateClientRecord(id: string, data: Partial<z.infer<typeof clientBodySchema>>)` returning `{ client, aggregate }` where `client` is the raw Prisma `Client` row and `aggregate` is the `ClientAggregate | undefined` for that client. Task 8/9 import this from `../routes/clients.routes.js`.

- [ ] **Step 1: Export the schema and add the extracted function**

Add `export` in front of `const clientBodySchema = z.object({...})`.

Right before `clientsRouter.patch('/:id', ...)`, add:

```ts
export async function updateClientRecord(id: string, data: Partial<z.infer<typeof clientBodySchema>>) {
  const normalized = normalize(clientBodySchema.partial().parse(data))
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'Cliente não encontrado')

  const client = await prisma.client.update({ where: { id }, data: normalized })
  const aggregates = await loadAggregates()
  return { client, aggregate: aggregates.get(client.id) }
}
```

- [ ] **Step 2: Rewrite the existing route to call the extracted function**

Replace the body of `clientsRouter.patch('/:id', ...)` with:
```ts
    const { client, aggregate } = await updateClientRecord(req.params.id, req.body)
    res.json({ client: toClientDTO(client, aggregate) })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc -p tsconfig.json --noEmit
```
Expected: no errors.

- [ ] **Step 4: Manually verify**

Edit an existing client through the UI (toggle "em atendimento" or change a field) and confirm it saves exactly as before.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/clients.routes.ts
git commit -m "refactor(clients): extract updateClientRecord for reuse by Neo"
```

---

## Task 5: Pending-actions store

**Files:**
- Create: `apps/api/src/lib/neoPendingActions.ts`

**Interfaces:**
- Produces:
  - `type PendingActionKind = 'orcamento_criar' | 'orcamento_editar' | 'pedido_criar' | 'pedido_editar' | 'cliente_editar'`
  - `interface PendingAction { id: string; kind: PendingActionKind; summary: string; payload: unknown; userId: string; createdAt: number }`
  - `function createPendingAction(kind: PendingActionKind, summary: string, payload: unknown, userId: string): PendingAction`
  - `function getPendingAction(id: string, userId: string): PendingAction | undefined` (returns `undefined` if missing, expired, or owned by a different user)
  - `function discardPendingAction(id: string): void`
  - `function toPublicPendingAction(action: PendingAction): { id: string; kind: PendingActionKind; summary: string; payload: unknown }` (strips `userId`/`createdAt` before sending to the frontend)

Later tasks (8, 9) import all of the above from `../lib/neoPendingActions.js`.

- [ ] **Step 1: Write the module**

```ts
import { randomUUID } from 'node:crypto'

export type PendingActionKind = 'orcamento_criar' | 'orcamento_editar' | 'pedido_criar' | 'pedido_editar' | 'cliente_editar'

export interface PendingAction {
  id: string
  kind: PendingActionKind
  summary: string
  payload: unknown
  userId: string
  createdAt: number
}

const TTL_MS = 15 * 60 * 1000

const store = new Map<string, PendingAction>()

function isExpired(action: PendingAction) {
  return Date.now() - action.createdAt > TTL_MS
}

export function createPendingAction(kind: PendingActionKind, summary: string, payload: unknown, userId: string): PendingAction {
  const action: PendingAction = { id: randomUUID(), kind, summary, payload, userId, createdAt: Date.now() }
  store.set(action.id, action)
  return action
}

export function getPendingAction(id: string, userId: string): PendingAction | undefined {
  const action = store.get(id)
  if (!action) return undefined
  if (action.userId !== userId || isExpired(action)) {
    store.delete(action.id)
    return undefined
  }
  return action
}

export function discardPendingAction(id: string): void {
  store.delete(id)
}

export function toPublicPendingAction(action: PendingAction) {
  return { id: action.id, kind: action.kind, summary: action.summary, payload: action.payload }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/api && npx tsc -p tsconfig.json --noEmit
```
Expected: no errors (this file has no external deps beyond `node:crypto`, so this mainly catches typos).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/neoPendingActions.ts
git commit -m "feat(neo): add in-memory pending-action store"
```

---

## Task 6: Neo knowledge + system prompt

**Files:**
- Create: `apps/api/src/lib/neoKnowledge.ts`

**Interfaces:**
- Produces: `export const NEO_SALES_PROCESS: string` and `export function buildNeoSystemInstruction(): string`. Task 9 imports `buildNeoSystemInstruction` from `../lib/neoKnowledge.js`.

- [ ] **Step 1: Write the module with a placeholder sales-process text**

```ts
/**
 * Texto do processo comercial da Pro Delphus+, usado pelo Neo pra responder
 * perguntas do tipo "como se faz a venda". Editar aqui não exige mexer em
 * mais nada do código do Neo.
 *
 * PLACEHOLDER: o Daniel ainda vai mandar o texto real — substituir antes de
 * considerar o Neo pronto pra uso real, não só pra teste técnico.
 */
export const NEO_SALES_PROCESS = `
(texto do processo comercial ainda não fornecido — pedir ao Daniel antes de
usar o Neo com o time de vendas de verdade)
`.trim()

export function buildNeoSystemInstruction(): string {
  return `
Você é o Neo, o assistente virtual interno da Pro Delphus+ (empresa que vende
simuladores cirúrgicos). Você conversa em português com vendedores e
administradores já autenticados no sistema.

O que você pode fazer:
- Responder sobre produtos, setores/áreas médicas, clientes e o processo
  comercial da empresa, usando as ferramentas disponíveis para buscar dados
  reais — nunca invente nome de produto, preço, cliente ou setor.
- Quando perguntarem por produtos de uma área médica, considere também áreas
  correlatas (ex.: cardiologia e cirurgia cardiovascular), usando seu próprio
  conhecimento médico para decidir quais setores da lista real (ferramenta
  listar_setores) são parecidos.
- Propor criação ou edição de orçamentos, pedidos e clientes.

Processo comercial da empresa (use para responder "como se faz a venda" e
perguntas parecidas):
${NEO_SALES_PROCESS}

Regra inegociável sobre ações que gravam dado (orçamento, pedido, cliente):
1. Você NUNCA grava nada diretamente. Só pode chamar as ferramentas
   "propor_*", que apenas montam uma prévia — quem grava de verdade é um
   clique do usuário num botão de confirmação, fora do seu controle.
2. Antes de chamar qualquer ferramenta "propor_*", você precisa ter todas as
   informações necessárias. Se faltar algo, PERGUNTE — nunca assuma um valor
   sozinho. A única exceção é dado que já existe de verdade no cadastro do
   cliente (endereço de cobrança/entrega, e-mail) — isso não é "assumir", é
   buscar dado real.
3. Só é aceitável deixar um campo em branco ou usar um valor padrão do
   sistema quando a PRÓPRIA PESSOA disser explicitamente que pode (ex. "pode
   usar o padrão", "deixa em branco", "não sei, usa o de sempre"). Isso vale
   especialmente para pedido, que tem bem mais campos que orçamento (peso,
   número de caixas, Incoterms, forma de pagamento).
4. Depois de chamar uma ferramenta "propor_*", explique em texto simples o
   que vai acontecer e diga que a pessoa precisa confirmar no cartão que vai
   aparecer — não pergunte "confirma?" esperando um "sim" em texto, o
   cartão com botão é quem resolve isso.

Seja direto e conciso nas respostas — é um chat de trabalho, não um ensaio.
`.trim()
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/api && npx tsc -p tsconfig.json --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/neoKnowledge.ts
git commit -m "feat(neo): add system prompt and sales-process placeholder"
```

Flag to the human reviewer: `NEO_SALES_PROCESS` is a placeholder — the plan cannot proceed past this point with real sales-process content because the user hasn't provided it yet. Implementation continues with the placeholder; swapping in the real text later is a one-file change.

---

## Task 7: Neo read tools

**Files:**
- Create: `apps/api/src/lib/neoTools.ts`

**Interfaces:**
- Consumes: `prisma` (`../lib/prisma.js`), `toClientDTO` (`../lib/dto.js`).
- Produces:
  - `export async function buscarProdutos(args: { setores?: string[]; texto?: string }): Promise<unknown[]>`
  - `export async function listarClientes(args: { filtro?: string; setor?: string; emAtendimento?: boolean }): Promise<unknown[]>`
  - `export async function buscarCliente(args: { nome: string }): Promise<unknown[]>`
  - `export async function listarSetores(): Promise<{ name: string; namePt: string | null }[]>`

Task 8 adds more exports to this same file. Task 9 imports all of them.

- [ ] **Step 1: Write the read tools**

```ts
import { prisma } from './prisma.js'
import { toClientDTO } from './dto.js'

function productSummary(p: {
  id: string
  sku: string
  name: string
  kind: string
  sectors: string[]
  priceBRL: unknown
  priceUSD: unknown
  priceUSDDistributor: unknown
  priceEUR: unknown
}) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    kind: p.kind,
    sectors: p.sectors,
    priceBRL: p.priceBRL?.toString() ?? null,
    priceUSD: p.priceUSD?.toString() ?? null,
    priceUSDDistributor: p.priceUSDDistributor?.toString() ?? null,
    priceEUR: p.priceEUR?.toString() ?? null,
  }
}

export async function buscarProdutos(args: { setores?: string[]; texto?: string }) {
  const { setores, texto } = args
  const products = await prisma.product.findMany({
    where: {
      active: true,
      AND: [
        setores && setores.length > 0 ? { sectors: { hasSome: setores } } : {},
        texto
          ? {
              OR: [
                { name: { contains: texto, mode: 'insensitive' } },
                { description: { contains: texto, mode: 'insensitive' } },
                { descriptionPt: { contains: texto, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    },
    take: 15,
    orderBy: { name: 'asc' },
  })
  return products.map(productSummary)
}

export async function listarClientes(args: { filtro?: string; setor?: string; emAtendimento?: boolean }) {
  const { filtro, setor, emAtendimento } = args
  const clients = await prisma.client.findMany({
    where: {
      active: true,
      AND: [
        filtro
          ? { OR: [{ name: { contains: filtro, mode: 'insensitive' } }, { institution: { contains: filtro, mode: 'insensitive' } }] }
          : {},
        setor ? { sectors: { has: setor } } : {},
        emAtendimento !== undefined ? { inService: emAtendimento } : {},
      ],
    },
    take: 20,
    orderBy: { name: 'asc' },
  })
  return clients.map((c) => toClientDTO(c))
}

export async function buscarCliente(args: { nome: string }) {
  const clients = await prisma.client.findMany({
    where: { name: { contains: args.nome, mode: 'insensitive' } },
    take: 5,
    orderBy: { name: 'asc' },
  })
  return clients.map((c) => toClientDTO(c))
}

export async function listarSetores() {
  return prisma.sector.findMany({ select: { name: true, namePt: true }, orderBy: { name: 'asc' } })
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/api && npx tsc -p tsconfig.json --noEmit
```
Expected: no errors. If `toClientDTO(c)` complains about a missing second argument, check its signature in `apps/api/src/lib/dto.ts` — it should accept an optional aggregate (`toClientDTO(client, aggregate?)`); omitting it must be valid since read tools don't need quote/order aggregates.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/neoTools.ts
git commit -m "feat(neo): add read tools (produtos, clientes, setores)"
```

---

## Task 8: Neo write/propose tools

**Files:**
- Modify: `apps/api/src/lib/neoTools.ts`

**Interfaces:**
- Consumes: `createQuoteSchema`, `CreateQuoteInput` (`../routes/quotes.routes.js`), `orderFieldsSchema`, `OrderFieldsInput` (`../routes/orders.routes.js`), `clientBodySchema` (`../routes/clients.routes.js`), `resolveQuoteData` — **not exported yet**, see Step 1 — `createPendingAction` (`./neoPendingActions.js`), `prisma` (already imported in this file from Task 7), `HttpError` (`../middleware/errorHandler.js`, new import).
- Produces:
  - `export async function proporOrcamento(args: CreateQuoteInput, userId: string): Promise<{ pendingAction: ReturnType<typeof createPendingAction>; summaryForModel: string }>`
  - `export async function proporEdicaoOrcamento(args: { orcamentoId: string } & CreateQuoteInput, userId: string): Promise<...>` (same return shape)
  - `export async function proporPedido(args: Partial<OrderFieldsInput> & { quoteId: string }, userId: string): Promise<...>` (same return shape) — `billToText`/`shipToText`/`orderedByEmail` are optional here specifically because they get auto-filled from the linked client when omitted (see Step 2).
  - `export async function proporEdicaoPedido(args: { pedidoId: string } & Omit<OrderFieldsInput, 'quoteId'>, userId: string): Promise<...>` (same return shape)
  - `export async function proporEdicaoCliente(args: { clienteId: string } & Record<string, unknown>, userId: string): Promise<...>` (same return shape)

Task 9 imports all five from `./neoTools.js` and calls the `createQuoteRecord`/etc. counterparts (Tasks 2–4) only on confirm, never here.

- [ ] **Step 1: Export `resolveQuoteData` from `quotes.routes.ts`**

In `apps/api/src/routes/quotes.routes.ts`, add `export` in front of `async function resolveQuoteData(...)`. This is read-only (computes prices/totals, touches no write) — safe to reuse for previews.

- [ ] **Step 2: Add the propose tools to `neoTools.ts`**

Add these imports at the top of `apps/api/src/lib/neoTools.ts`:
```ts
import { createQuoteSchema, resolveQuoteData, type CreateQuoteInput } from '../routes/quotes.routes.js'
import { orderFieldsSchema, type OrderFieldsInput } from '../routes/orders.routes.js'
import { createPendingAction } from './neoPendingActions.js'
import { HttpError } from '../middleware/errorHandler.js'
```

Then append:

```ts
function money(currency: string, value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value)
}

export async function proporOrcamento(args: CreateQuoteInput, userId: string) {
  const data = createQuoteSchema.parse(args)
  const resolved = await resolveQuoteData(data, userId)
  const summary = `Orçamento novo para ${data.clientName}, ${resolved.lineItems.length} item(ns), total ${money(resolved.currency, resolved.total)}.`
  const pendingAction = createPendingAction('orcamento_criar', summary, data, userId)
  return { pendingAction, summaryForModel: summary }
}

export async function proporEdicaoOrcamento(args: { orcamentoId: string } & CreateQuoteInput, userId: string) {
  const { orcamentoId, ...rest } = args
  const data = createQuoteSchema.parse(rest)
  const resolved = await resolveQuoteData(data, userId)
  const summary = `Edição do orçamento — ${resolved.lineItems.length} item(ns), novo total ${money(resolved.currency, resolved.total)}.`
  const pendingAction = createPendingAction('orcamento_editar', summary, { orcamentoId, data }, userId)
  return { pendingAction, summaryForModel: summary }
}

export async function proporPedido(args: Partial<OrderFieldsInput> & { quoteId: string }, userId: string) {
  // billToText/shipToText/orderedByEmail vêm do cadastro do cliente vinculado
  // ao orçamento quando existirem — isso é dado real, não "chute" (ver
  // regra em neoKnowledge.ts). Sem cliente vinculado ou sem esses campos
  // preenchidos no cadastro, `orderFieldsSchema.parse` abaixo falha por
  // campo obrigatório ausente, e o Neo (instruído pelo system prompt) deve
  // perguntar antes de tentar de novo.
  const quote = await prisma.quote.findUnique({ where: { id: args.quoteId }, include: { client: true } })
  if (!quote) throw new HttpError(404, 'Orçamento não encontrado')

  const merged = {
    ...args,
    billToText: args.billToText ?? quote.client?.billToText ?? undefined,
    shipToText: args.shipToText ?? quote.client?.shipToText ?? undefined,
    orderedByEmail: args.orderedByEmail ?? quote.client?.email ?? undefined,
  }
  const data = orderFieldsSchema.parse(merged)
  const summary = `Pedido novo a partir do orçamento ${quote.quoteNumber}, ${data.packageCount ?? 1} caixa(s), pagamento ${data.prepaymentBy ?? 'transferência bancária (padrão)'}.`
  const pendingAction = createPendingAction('pedido_criar', summary, data, userId)
  return { pendingAction, summaryForModel: summary }
}

export async function proporEdicaoPedido(args: { pedidoId: string } & Omit<OrderFieldsInput, 'quoteId'>, userId: string) {
  const { pedidoId, ...rest } = args
  const data = orderFieldsSchema.omit({ quoteId: true }).partial().parse(rest)
  const summary = `Edição do pedido — campos alterados: ${Object.keys(data).join(', ') || '(nenhum)'}.`
  const pendingAction = createPendingAction('pedido_editar', summary, { pedidoId, data }, userId)
  return { pendingAction, summaryForModel: summary }
}

export async function proporEdicaoCliente(args: { clienteId: string } & Record<string, unknown>, userId: string) {
  const { clienteId, ...rest } = args
  const summary = `Edição do cliente — campos alterados: ${Object.keys(rest).join(', ') || '(nenhum)'}.`
  const pendingAction = createPendingAction('cliente_editar', summary, { clienteId, data: rest }, userId)
  return { pendingAction, summaryForModel: summary }
}
```

Note: `proporEdicaoCliente` intentionally doesn't validate with `clientBodySchema` here — full validation happens in `updateClientRecord` (Task 4) when the write is actually confirmed. This keeps the preview forgiving (a client might only mention one field) while the real write still can't save invalid data.

- [ ] **Step 3: Verify it compiles**

```bash
cd apps/api && npx tsc -p tsconfig.json --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/neoTools.ts apps/api/src/routes/quotes.routes.ts
git commit -m "feat(neo): add propose tools for quote/order/client writes"
```

---

## Task 9: Neo chat endpoint (Gemini function-calling loop)

**Files:**
- Create: `apps/api/src/routes/neo.routes.ts`

**Interfaces:**
- Consumes: everything exported by Tasks 5–8, plus `env.GEMINI_API_KEY` (Task 1), `requireAuth` (`../middleware/auth.js`), `asyncHandler`/`HttpError` (`../middleware/errorHandler.js`).
- Produces: `export const neoRouter: Router` with `POST /` (chat). Task 10 adds `/actions/:id/confirm` and `/actions/:id/cancel` to this same router, and mounts it in `index.ts`.

- [ ] **Step 1: Write the tool declarations and dispatcher**

```ts
import { Router } from 'express'
import { GoogleGenAI, Type, type Content, type FunctionDeclaration } from '@google/genai'
import { env } from '../lib/env.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { buildNeoSystemInstruction } from '../lib/neoKnowledge.js'
import { toPublicPendingAction } from '../lib/neoPendingActions.js'
import {
  buscarProdutos,
  listarClientes,
  buscarCliente,
  listarSetores,
  proporOrcamento,
  proporEdicaoOrcamento,
  proporPedido,
  proporEdicaoPedido,
  proporEdicaoCliente,
} from '../lib/neoTools.js'

export const neoRouter = Router()
neoRouter.use(requireAuth)

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
const MODEL = 'gemini-2.5-flash'
const MAX_TOOL_ITERATIONS = 5

const readTools: FunctionDeclaration[] = [
  {
    name: 'buscar_produtos',
    description: 'Busca produtos ativos do catálogo por setor(es) e/ou texto livre. Devolve nome, SKU, tipo, setores e todos os preços.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        setores: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Nomes de setor, pode incluir vários (inclusive correlatos)' },
        texto: { type: Type.STRING, description: 'Texto livre pra buscar no nome/descrição do produto' },
      },
    },
  },
  {
    name: 'listar_clientes',
    description: 'Lista clientes ativos, com filtros opcionais por texto, setor de interesse ou status "em atendimento".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filtro: { type: Type.STRING, description: 'Texto livre pra buscar no nome/instituição do cliente' },
        setor: { type: Type.STRING, description: 'Setor de interesse do cliente' },
        emAtendimento: { type: Type.BOOLEAN, description: 'true para só clientes marcados como em atendimento' },
      },
    },
  },
  {
    name: 'buscar_cliente',
    description: 'Busca um cliente específico pelo nome.',
    parameters: { type: Type.OBJECT, properties: { nome: { type: Type.STRING } }, required: ['nome'] },
  },
  {
    name: 'listar_setores',
    description: 'Lista todos os setores/áreas médicas do catálogo.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
]

const itemSchema = {
  type: Type.OBJECT,
  properties: {
    productId: { type: Type.STRING },
    quantity: { type: Type.NUMBER },
  },
  required: ['productId', 'quantity'],
}

const quoteFieldsProps = {
  clientName: { type: Type.STRING },
  clientId: { type: Type.STRING, description: 'Id do cliente cadastrado, se houver' },
  items: { type: Type.ARRAY, items: itemSchema },
  currency: { type: Type.STRING, description: 'BRL, USD ou EUR' },
  priceTier: { type: Type.STRING, description: 'FINAL ou DISTRIBUTOR' },
  exportScope: { type: Type.STRING, description: 'NATIONAL ou INTERNATIONAL' },
  notes: { type: Type.STRING },
}

const writeTools: FunctionDeclaration[] = [
  {
    name: 'propor_orcamento',
    description: 'Monta uma prévia de orçamento novo — NÃO grava nada. Só chame depois de ter cliente e itens confirmados na conversa.',
    parameters: { type: Type.OBJECT, properties: { ...quoteFieldsProps }, required: ['clientName', 'items'] },
  },
  {
    name: 'propor_edicao_orcamento',
    description: 'Monta uma prévia de edição de um orçamento existente — NÃO grava nada.',
    parameters: { type: Type.OBJECT, properties: { orcamentoId: { type: Type.STRING }, ...quoteFieldsProps }, required: ['orcamentoId', 'clientName', 'items'] },
  },
  {
    name: 'propor_pedido',
    description:
      'Monta uma prévia de pedido novo a partir de um orçamento — NÃO grava nada. orderedByEmail/billToText/shipToText são opcionais aqui porque são preenchidos automaticamente a partir do cliente vinculado ao orçamento quando existirem; só informe se o cliente não tiver esses dados ou a pessoa pedir outro valor.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        quoteId: { type: Type.STRING },
        orderedByEmail: { type: Type.STRING },
        billToText: { type: Type.STRING },
        shipToText: { type: Type.STRING },
        packageCount: { type: Type.NUMBER },
        prepaymentBy: { type: Type.STRING, description: 'PAYPAL, WIRE_TRANSFER ou PIX' },
        incoterms: { type: Type.STRING },
        netWeightKg: { type: Type.NUMBER },
        grossWeightKg: { type: Type.NUMBER },
      },
      required: ['quoteId'],
    },
  },
  {
    name: 'propor_edicao_pedido',
    description: 'Monta uma prévia de edição de um pedido existente — NÃO grava nada.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pedidoId: { type: Type.STRING },
        packageCount: { type: Type.NUMBER },
        prepaymentBy: { type: Type.STRING },
        incoterms: { type: Type.STRING },
        netWeightKg: { type: Type.NUMBER },
        grossWeightKg: { type: Type.NUMBER },
      },
      required: ['pedidoId'],
    },
  },
  {
    name: 'propor_edicao_cliente',
    description: 'Monta uma prévia de edição de um cliente existente — NÃO grava nada.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        clienteId: { type: Type.STRING },
        name: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        inService: { type: Type.BOOLEAN },
        notes: { type: Type.STRING },
      },
      required: ['clienteId'],
    },
  },
]

// `args` chega como JSON dinâmico vindo do Gemini — sem tipo estático real.
// Cada `proporX`/`buscarX` já valida com Zod por dentro (ver Tasks 7/8), então
// o `as any` aqui só destrava o TypeScript; dado ruim ainda é pego na
// validação, não silenciosamente aceito.
async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<{ result: unknown; pendingAction?: Awaited<ReturnType<typeof proporOrcamento>>['pendingAction'] }> {
  switch (name) {
    case 'buscar_produtos':
      return { result: await buscarProdutos(args as any) }
    case 'listar_clientes':
      return { result: await listarClientes(args as any) }
    case 'buscar_cliente':
      return { result: await buscarCliente(args as any) }
    case 'listar_setores':
      return { result: await listarSetores() }
    case 'propor_orcamento': {
      const { pendingAction, summaryForModel } = await proporOrcamento(args as any, userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_edicao_orcamento': {
      const { pendingAction, summaryForModel } = await proporEdicaoOrcamento(args as any, userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_pedido': {
      const { pendingAction, summaryForModel } = await proporPedido(args as any, userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_edicao_pedido': {
      const { pendingAction, summaryForModel } = await proporEdicaoPedido(args as any, userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_edicao_cliente': {
      const { pendingAction, summaryForModel } = await proporEdicaoCliente(args as any, userId)
      return { result: summaryForModel, pendingAction }
    }
    default:
      throw new HttpError(500, `Ferramenta desconhecida: ${name}`)
  }
}
```

- [ ] **Step 2: Write the `POST /` chat handler**

Append to the same file:

```ts
const chatBodySchema_history = { role: '', parts: '' } // (documentation only, real validation below)

neoRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const message = String(req.body?.message ?? '').trim()
    if (!message) throw new HttpError(400, 'Mensagem vazia')
    const historyIn = Array.isArray(req.body?.history) ? req.body.history : []

    const contents: Content[] = [
      ...historyIn.map((h: { role: string; text: string }) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: message }] },
    ]

    let pendingAction: ReturnType<typeof toPublicPendingAction> | undefined

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: buildNeoSystemInstruction(),
          tools: [{ functionDeclarations: [...readTools, ...writeTools] }],
        },
      })

      const calls = response.functionCalls ?? []
      if (calls.length === 0) {
        res.json({ reply: response.text ?? '', pendingAction })
        return
      }

      contents.push({ role: 'model', parts: calls.map((c) => ({ functionCall: c })) })

      const responseParts = []
      for (const call of calls) {
        const { result, pendingAction: newPending } = await dispatchTool(call.name!, call.args ?? {}, req.user!.id)
        if (newPending) pendingAction = toPublicPendingAction(newPending)
        responseParts.push({ functionResponse: { name: call.name!, response: { result } } })
      }
      contents.push({ role: 'user', parts: responseParts })
    }

    throw new HttpError(500, 'O Neo não conseguiu concluir a resposta (muitas chamadas de ferramenta em sequência).')
  }),
)
```

Remove the unused `chatBodySchema_history` placeholder line — it was only there to note that `history` items are `{ role, text }`; delete it before moving on (it isn't referenced anywhere and would otherwise sit as dead code).

- [ ] **Step 3: Verify it compiles**

```bash
cd apps/api && npx tsc -p tsconfig.json --noEmit
```
Expected: no errors. If `@google/genai`'s exported types differ slightly from `FunctionDeclaration`/`Content` (SDK versions do shift these names), check `node_modules/@google/genai/dist/*.d.ts` for the current type names and adjust the imports — the runtime shape (`functionDeclarations`, `functionCalls`, `functionCall`, `functionResponse`) is stable across recent versions even when exported type names move.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/neo.routes.ts
git commit -m "feat(neo): add POST /api/neo chat endpoint with Gemini function calling"
```

---

## Task 10: Confirm/cancel endpoints + mount router

**Files:**
- Modify: `apps/api/src/routes/neo.routes.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `createQuoteRecord`/`updateQuoteRecord` (Task 2), `createOrderRecord`/`updateOrderRecord` (Task 3), `updateClientRecord` (Task 4), `getPendingAction`/`discardPendingAction` (Task 5), `toQuoteDTO`/`toOrderDTOFresh`/`toClientDTO` (`../lib/dto.js`, `toOrderDTOFresh` from `../routes/orders.routes.js` — check its export; it's currently a local `async function toOrderDTOFresh` in that file, so add `export` in front of it too).

- [ ] **Step 1: Export `toOrderDTOFresh`**

In `apps/api/src/routes/orders.routes.ts`, add `export` in front of `async function toOrderDTOFresh(order: RawOrder)`.

- [ ] **Step 2: Add confirm/cancel routes**

Append to `apps/api/src/routes/neo.routes.ts`:

```ts
import { getPendingAction, discardPendingAction } from '../lib/neoPendingActions.js'
import { toQuoteDTO, toClientDTO } from '../lib/dto.js'
import { createQuoteRecord, updateQuoteRecord } from './quotes.routes.js'
import { createOrderRecord, updateOrderRecord, toOrderDTOFresh } from './orders.routes.js'
import { updateClientRecord } from './clients.routes.js'

neoRouter.post(
  '/actions/:id/confirm',
  asyncHandler(async (req, res) => {
    const action = getPendingAction(req.params.id, req.user!.id)
    if (!action) throw new HttpError(404, 'Essa ação expirou ou não existe mais. Peça pro Neo montar de novo.')

    switch (action.kind) {
      case 'orcamento_criar': {
        const quote = await createQuoteRecord(action.payload as never, req.user!.id)
        discardPendingAction(action.id)
        res.json({ resource: 'quote', quote: toQuoteDTO(quote) })
        return
      }
      case 'orcamento_editar': {
        const { orcamentoId, data } = action.payload as { orcamentoId: string; data: unknown }
        const quote = await updateQuoteRecord(orcamentoId, data as never, req.user!.id)
        discardPendingAction(action.id)
        res.json({ resource: 'quote', quote: toQuoteDTO(quote) })
        return
      }
      case 'pedido_criar': {
        const order = await createOrderRecord(action.payload as never, req.user!.id)
        discardPendingAction(action.id)
        res.json({ resource: 'order', order: await toOrderDTOFresh(order) })
        return
      }
      case 'pedido_editar': {
        const { pedidoId, data } = action.payload as { pedidoId: string; data: unknown }
        const order = await updateOrderRecord(pedidoId, data as never, req.user!.id)
        discardPendingAction(action.id)
        res.json({ resource: 'order', order: await toOrderDTOFresh(order) })
        return
      }
      case 'cliente_editar': {
        const { clienteId, data } = action.payload as { clienteId: string; data: unknown }
        const { client, aggregate } = await updateClientRecord(clienteId, data as never)
        discardPendingAction(action.id)
        res.json({ resource: 'client', client: toClientDTO(client, aggregate) })
        return
      }
    }
  }),
)

neoRouter.post(
  '/actions/:id/cancel',
  asyncHandler(async (req, res) => {
    const action = getPendingAction(req.params.id, req.user!.id)
    if (action) discardPendingAction(action.id)
    res.status(204).send()
  }),
)
```

- [ ] **Step 3: Mount the router**

In `apps/api/src/index.ts`, add the import next to the other route imports:
```ts
import { neoRouter } from './routes/neo.routes.js'
```
And mount it next to the other `app.use('/api/...', ...)` lines:
```ts
app.use('/api/neo', neoRouter)
```

- [ ] **Step 4: Verify it compiles and boots**

```bash
cd apps/api && npx tsc -p tsconfig.json --noEmit
npm run dev --workspace=apps/api
```
Expected: no type errors, API boots normally.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/neo.routes.ts apps/api/src/routes/orders.routes.ts apps/api/src/index.ts
git commit -m "feat(neo): add confirm/cancel endpoints and mount /api/neo"
```

---

## Task 11: Manual backend verification

**Files:** none (verification only)

- [ ] **Step 1: Log in and grab a token**

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"daniel.acioly@prodelphus.com.br","password":"dev-admin-local-2026"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
echo "$TOKEN"
```
Expected: a non-empty JWT string.

- [ ] **Step 2: Ask a read-only question**

```bash
curl -s -X POST http://localhost:4000/api/neo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"quais setores existem no catálogo?","history":[]}' | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)), null, 2)'
```
Expected: `{ "reply": "...", "pendingAction": undefined }` where `reply` lists real sector names from the database (check them against `Setores` in the app).

- [ ] **Step 3: Ask a product-by-sector question**

```bash
curl -s -X POST http://localhost:4000/api/neo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"quais produtos vocês têm pra cardiologia?","history":[]}'
```
Expected: `reply` mentions real product names/SKUs that exist in the catalog for that sector (or a related one). If it hallucinates a product name that doesn't exist, that's a bug — go back to Task 9 Step 1/2 and check the tool is actually being invoked (add a `console.log` around `dispatchTool` temporarily to confirm).

- [ ] **Step 4: Trigger a quote proposal**

Pick a real `clientName` and `productId` from your local data first (`curl http://localhost:4000/api/products -H "Authorization: Bearer $TOKEN"` to find one), then:
```bash
curl -s -X POST http://localhost:4000/api/neo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"monta um orçamento pro cliente Teste com 1 unidade do produto <SKU ou nome real>","history":[]}'
```
Expected: response includes a `pendingAction` object with `kind: "orcamento_criar"` and a `summary` with a real computed total — and confirm via `psql`/Prisma Studio that **no** row was created in `quotes` yet.

- [ ] **Step 5: Confirm the action**

Take the `pendingAction.id` from the previous response:
```bash
curl -s -X POST http://localhost:4000/api/neo/actions/<id>/confirm \
  -H "Authorization: Bearer $TOKEN"
```
Expected: `{ "resource": "quote", "quote": {...} }` with a real `quoteNumber`, `pdfUrl`, `xlsxUrl`. Check it shows up in the Orçamentos screen in the browser.

- [ ] **Step 6: Confirm cancel works too**

Repeat Step 4 to get a fresh `pendingAction.id`, then:
```bash
curl -s -X POST http://localhost:4000/api/neo/actions/<id>/cancel -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:4000/api/neo/actions/<id>/confirm -H "Authorization: Bearer $TOKEN"
```
Expected: cancel returns 204; the subsequent confirm on the same id returns a 404 (`"Essa ação expirou..."`) — proving cancel actually discards it.

No commit for this task — it's verification only, not a code change.

---

## Task 12: Frontend — icon, nav item, route

**Files:**
- Modify: `apps/web/src/components/icons.tsx`
- Modify: `apps/web/src/components/Layout.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Produces: `IconBot` component (same signature as every other icon in the file: `(props: SVGProps<SVGSVGElement>) => JSX.Element`), a `{ to: '/neo', label: 'Neo', icon: IconBot }` entry in `navItems`, and a `<Route path="/neo" element={<Neo />} />` inside the existing `<ProtectedRoute />`/`<Layout />` nesting.

- [ ] **Step 1: Add the icon**

In `apps/web/src/components/icons.tsx`, following the exact pattern of the other icons in the file (look at `IconChart` or `IconBoard` immediately above for the stroke-width/viewBox convention used), add:

```tsx
export function IconBot(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 8V4" />
      <circle cx="12" cy="3" r="1" />
      <circle cx="9" cy="13" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.25" fill="currentColor" stroke="none" />
      <path d="M9 17h6" />
    </svg>
  )
}
```
(This is a placeholder glyph — Task 13 may swap the sidebar icon for something derived from the GIF avatar once it exists. Not blocking.)

- [ ] **Step 2: Add the nav item**

In `apps/web/src/components/Layout.tsx`, add `IconBot` to the import from `./icons`, and add an entry to `navItems` (right after `{ to: '/minha-pro-delphus', ... }` reads naturally, but anywhere in the array is fine — order here is just menu order):

```ts
  { to: '/neo', label: 'Neo', icon: IconBot },
```

- [ ] **Step 3: Add the route**

In `apps/web/src/App.tsx`, add the import:
```ts
import { Neo } from './pages/Neo'
```
And add the route inside the existing `<Route element={<Layout />}>` block (next to `/minha-pro-delphus` is fine):
```tsx
          <Route path="/neo" element={<Neo />} />
```

This will fail to compile until Task 13 creates `pages/Neo.tsx` — that's expected and fixed in the next task.

- [ ] **Step 4: Commit**

Hold this commit — combine it with Task 13's commit, since `App.tsx`/`Layout.tsx` won't compile until `Neo.tsx` exists. Proceed directly to Task 13.

---

## Task 13: Frontend — Neo chat page

**Before starting this task, load the `frontend-design` skill** — the spec requires the same polish level as the rest of the app, and this is the task where that actually gets decided (layout, spacing, color use, the confirmation-card treatment, where the avatar GIF sits).

**Files:**
- Create: `apps/web/src/pages/Neo.tsx`

**Interfaces:**
- Consumes: `api` (`../lib/api.ts`, axios instance — see its `export const api = axios.create({...})`), `cn` (`../lib/cn.ts`, already used across the app for conditional classNames).
- Produces: `export function Neo()` — a page component, default-exported nowhere (named export, matching every other page in `apps/web/src/pages/`).

- [ ] **Step 1: Define the message/pending-action types and API calls**

```tsx
import { useState, useRef, useEffect } from 'react'
import { api } from '../lib/api'
import { cn } from '../lib/cn'

interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

interface PendingAction {
  id: string
  kind: 'orcamento_criar' | 'orcamento_editar' | 'pedido_criar' | 'pedido_editar' | 'cliente_editar'
  summary: string
}

const KIND_LABEL: Record<PendingAction['kind'], string> = {
  orcamento_criar: 'Criar orçamento',
  orcamento_editar: 'Editar orçamento',
  pedido_criar: 'Criar pedido',
  pedido_editar: 'Editar pedido',
  cliente_editar: 'Editar cliente',
}

async function sendMessage(message: string, history: ChatMessage[]) {
  const { data } = await api.post<{ reply: string; pendingAction?: PendingAction }>('/neo', { message, history })
  return data
}

async function confirmAction(id: string) {
  const { data } = await api.post(`/neo/actions/${id}/confirm`)
  return data
}

async function cancelAction(id: string) {
  await api.post(`/neo/actions/${id}/cancel`)
}
```

- [ ] **Step 2: Build the component shell — state, send handler, scroll-to-bottom**

```tsx
export function Neo() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setError(null)
    setActionResult(null)
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', text }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    try {
      const { reply, pendingAction } = await sendMessage(text, messages)
      setMessages((prev) => [...prev, { role: 'model', text: reply }])
      setPending(pendingAction ?? null)
    } catch {
      setError('Neo não conseguiu responder agora, tenta de novo em instantes.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!pending) return
    setLoading(true)
    setError(null)
    try {
      await confirmAction(pending.id)
      setActionResult(`${KIND_LABEL[pending.kind]} — feito com sucesso.`)
      setPending(null)
    } catch {
      setError('Não deu pra confirmar agora. Tenta de novo ou peça pro Neo montar de novo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!pending) return
    await cancelAction(pending.id).catch(() => {})
    setPending(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-8">
      <header className="mb-6 flex items-center gap-3">
        {/* Espaço reservado para o avatar animado do Neo (GIF a ser fornecido) */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 shadow-sm">
          N
        </div>
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Neo</h1>
          <p className="text-[13px] text-neutral-500">Assistente da Pro Delphus+</p>
        </div>
      </header>

      <div className="material flex-1 overflow-y-auto rounded-2xl border border-neutral-200/70 p-5">
        {messages.length === 0 && (
          <p className="text-[13.5px] text-neutral-400">
            Pergunte sobre produtos, setores, clientes, ou peça pra montar um orçamento/pedido.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                'max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed',
                m.role === 'user' ? 'ml-auto bg-brand-600 text-white' : 'bg-ink-900/[0.04] text-ink-900',
              )}
            >
              {m.text}
            </div>
          ))}

          {pending && (
            <div className="max-w-[85%] rounded-xl border border-brand-600/20 bg-brand-50 p-4">
              <p className="text-eyebrow mb-1 text-brand-600">{KIND_LABEL[pending.kind]}</p>
              <p className="mb-3 text-[13.5px] text-ink-900">{pending.summary}</p>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                >
                  Confirmar
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="rounded-lg border border-neutral-200 px-3.5 py-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {actionResult && <p className="text-[13px] text-emerald-600">{actionResult}</p>}
          {error && <p className="text-[13px] text-red-600">{error}</p>}
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Pergunte alguma coisa ao Neo..."
          className="material max-h-32 flex-1 resize-none rounded-xl border border-neutral-200/70 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand-600"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="h-10 shrink-0 rounded-xl bg-brand-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Apply `frontend-design` skill pass**

With the skill loaded (see task header), review this component against the rest of the app's visual language — check `Layout.tsx`, `Home.tsx` and `MyDesk.tsx` for the actual spacing/shadow/typography conventions (`material` class, `ink-900`/`brand-600`/`neutral-*` tokens, `text-eyebrow`) and adjust `Neo.tsx` until it reads as the same product, not a bolted-on chat widget. This step is inherently a judgment call made live with the skill's guidance — don't skip loading it.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc -b --noEmit
```
Expected: no errors (this also validates Task 12's `App.tsx`/`Layout.tsx` changes now that `Neo.tsx` exists).

- [ ] **Step 5: Commit (covers Task 12 + 13)**

```bash
git add apps/web/src/components/icons.tsx apps/web/src/components/Layout.tsx apps/web/src/App.tsx apps/web/src/pages/Neo.tsx
git commit -m "feat(neo): add Neo chat page, nav item and route"
```

---

## Task 14: Manual full-stack verification

**Files:** none (verification only)

- [ ] **Step 1: Run both dev servers**

```bash
npm run dev:api
```
(in one terminal) and
```bash
npm run dev:web
```
(in another).

- [ ] **Step 2: Read-only questions in the browser**

Log in, click **Neo** in the sidebar, and ask:
- "quais setores vocês atendem?" — expect a real list matching `Setores` (admin screen).
- "quais produtos tem pra cardiologia?" (or a sector that actually exists in your data) — expect real SKUs, not invented ones. Try a phrase that requires inferring a *related* sector, not an exact name match.
- "o cliente <nome real> está em atendimento?" — expect an answer matching the `inService` flag you can see on that client's page.
- Compare a product's price across currencies — expect numbers matching the Tabela de Preços screen.

- [ ] **Step 3: Quote creation flow**

Ask Neo to build a quote for a real client with a real product, deliberately leaving out the currency. Expect Neo to **ask** for it rather than assume (per the "não chuta, pergunta" rule) — if it silently picks one, that's a spec violation, go back to Task 6's system instruction and strengthen the wording, or Task 8's tool description.

Provide the missing info, confirm the pending-action card appears with a correct total, click **Confirmar**, and check the quote shows up in **Orçamentos** with a real number and downloadable PDF.

- [ ] **Step 4: Order creation flow**

From that quote, ask Neo to create a pedido. Expect it to ask for shipping/packaging fields it can't get from the client record (unless the linked client already has enough data), and to accept "pode usar o padrão" as authorization to leave something blank. Confirm and check the order appears in **Pedidos**.

- [ ] **Step 5: Client edit flow**

Ask Neo to update a note or the "em atendimento" flag on a real client, confirm, and check it changed on the **Clientes** screen.

- [ ] **Step 6: Cancel flow**

Trigger any pending action and click **Cancelar** — confirm nothing was created/changed.

- [ ] **Step 7: Error handling**

Temporarily set an invalid `GEMINI_API_KEY` in `apps/api/.env`, restart the API, ask Neo something, and confirm the UI shows the friendly error message (not a raw stack trace or a blank screen). Restore the real key and restart again afterward.

No commit for this task.

---

## Task 15: Prod deploy prep

**Files:** none in this repo beyond what Task 1 already changed (`.env.prod.example`, `docker-compose.prod.yml`) — this task is about the *server*, not the repo.

- [ ] **Step 1: Confirm the repo-side prod config is ready**

`.env.prod.example` and `docker-compose.prod.yml` already got `GEMINI_API_KEY` in Task 1 — nothing left to change in the repo for this.

- [ ] **Step 2: Hand off to the user for the real deploy**

This step is manual, on the production server, same pattern as every other deploy in this project: SSH in, `git pull origin main` (after this branch is merged), add the real `GEMINI_API_KEY` line to the server's own `.env.prod` (never commit it), then `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build`. Don't do this until local verification (Task 14) is fully green and the user says so.

No commit for this task.
