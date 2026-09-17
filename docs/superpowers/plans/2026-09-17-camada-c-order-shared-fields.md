# Camada C — Campos Compartilhados NewOrder/OrderDetail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair os blocos de campo genuinamente duplicados entre `NewOrder.tsx` (criação de pedido) e `OrderDetail.tsx` (edição de pedido) para componentes compartilhados — Comprador, Endereços, Pesos e Nota Fiscal — sem mudar nenhuma regra de negócio, nenhuma validação e nenhum layout visual existente em nenhuma das duas telas.

**Architecture:** Última fatia grande da Camada C. Uma investigação dedicada (agente de exploração, ver `docs/superpowers/specs/2026-09-16-frontend-premium-redesign-design.md` para o contexto maior) comparou linha a linha os dois formulários e achou 7 blocos com sobreposição. Dois desses blocos (Incoterms/Via de envio, e Pagamento/PayPal/câmbio) têm agrupamento estrutural genuinamente diferente entre as duas telas — juntar isso exigiria reestruturar uma das duas, não só extrair — **ficam de fora deste plano, deliberadamente**. `BoxAssignmentFields` já é o exemplo funcionando desse padrão (hook próprio + componente que só recebe `items`), mas os 4 blocos daqui são mais simples: só campos de formulário puro, sem hook próprio.

**Restrição de segurança central deste plano:** não há como fazer login real neste ambiente (nenhuma senha de admin disponível, e criar uma conta de teste no banco compartilhado foi corretamente bloqueado pelo classificador de permissões da sessão anterior). Por isso, **cada componente extraído deve ser prova-de-diff**: o JSX resultante, para cada prop passada por cada página, precisa produzir exatamente o mesmo HTML/comportamento que existe hoje — sem exceção, sem "enquanto estamos aqui, vamos padronizar isso também". Onde as duas telas hoje se comportam diferente (campo obrigatório numa e não na outra, texto de apoio presente numa e ausente na outra), a diferença é preservada via uma prop `variant: 'create' | 'edit'` — nunca resolvida silenciosamente para um lado.

**Tech Stack:** React 19 + TypeScript. Nenhuma dependência nova.

**Spec:** [docs/superpowers/specs/2026-09-16-frontend-premium-redesign-design.md](../specs/2026-09-16-frontend-premium-redesign-design.md) — seção Camada C, item OrderDetail ↔ NewOrder.

## Global Constraints

- Branch nasce da ponta atual de `feature/frontend-design-tokens`.
- Sem framework de teste automatizado. Verificação = `npm run build --workspace=apps/web` + `npm run lint --workspace=apps/web` — o TypeScript é a rede de segurança principal aqui, já que confirma que toda prop meio-usada bate exatamente com o shape esperado.
- **Nenhum wrapper de grid/FormSection novo pode ser adicionado onde não existia antes.** Cada componente extraído só pode assumir um wrapper de grid interno quando as DUAS páginas já usam exatamente as mesmas classes de grid para aquele bloco especificamente (confirmado campo a campo abaixo) — nos blocos onde as classes divergem (contagem de colunas, responsividade), o componente devolve só os `<Field>`s soltos via Fragment, e cada página mantém o wrapper que já tem hoje.
- **Nenhum atributo `required` pode mudar de comportamento.** Onde as duas telas hoje divergem em `required`, a prop `variant` decide — nunca fixar num valor só.
- Escopo de arquivos: `apps/web/src/components/OrderFormFields.tsx` (novo), `apps/web/src/pages/NewOrder.tsx`, `apps/web/src/pages/OrderDetail.tsx`. Nada de Incoterms/Via de envio/AWB/Pagamento/PayPal/câmbio — esses blocos continuam exatamente como estão hoje em ambos os arquivos, sem nenhuma linha tocada.

---

### Task 1: Criar `OrderFormFields.tsx`

**Files:**
- Create: `apps/web/src/components/OrderFormFields.tsx`

**Interfaces:**
- Produces: `BuyerFields`, `AddressFields`, `WeightFields`, `InvoiceFields` — cada um `({ value, onChange, ...}) => JSX.Element`, com `value`/`onChange` tipados por uma interface própria (`BuyerFieldsValue`, etc.) exportada junto. `onChange` recebe sempre um `Partial<...>` — compatível tanto com o `update(patch)` de NewOrder quanto com o `setEditForm((s) => ({...s, ...patch}))` de OrderDetail via um adaptador de uma linha em cada página (Task 2/3).

- [ ] **Step 1: Criar o arquivo completo**

```tsx
import { Field, Input, Textarea } from './ui'

export interface BuyerFieldsValue {
  purchaseOrder: string
  orderedByEmail: string
  shipDate: string
}

/**
 * Pedido de compra, e-mail do comprador, data de expedição — usado tanto na
 * criação (NewOrder) quanto na edição (OrderDetail) de pedidos.
 *
 * `variant` só controla diferenças que já existiam entre as duas telas antes
 * desta extração (texto de apoio e o e-mail sendo obrigatório só na
 * criação) — não introduz nenhuma regra nova.
 */
export function BuyerFields({
  value,
  onChange,
  variant,
}: {
  value: BuyerFieldsValue
  onChange: (patch: Partial<BuyerFieldsValue>) => void
  variant: 'create' | 'edit'
}) {
  const isCreate = variant === 'create'
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label={isCreate ? 'Pedido de compra (opcional)' : 'Pedido de compra'}
        hint={isCreate ? 'Se vazio, usa o número do orçamento.' : undefined}
      >
        <Input value={value.purchaseOrder} onChange={(e) => onChange({ purchaseOrder: e.target.value })} />
      </Field>
      <Field label="E-mail do comprador">
        <Input
          type="email"
          required={isCreate}
          value={value.orderedByEmail}
          onChange={(e) => onChange({ orderedByEmail: e.target.value })}
        />
      </Field>
      <Field label={isCreate ? 'Data de expedição (opcional)' : 'Data de expedição'}>
        <Input type="date" value={value.shipDate} onChange={(e) => onChange({ shipDate: e.target.value })} />
      </Field>
    </div>
  )
}

export interface AddressFieldsValue {
  billToText: string
  shipToText: string
  shipToNote: string
}

/** Bill To / Ship To / observação de entrega. Mesma regra de `variant` acima:
 * NewOrder exige preenchimento e mostra placeholder de exemplo; OrderDetail
 * (edição) não exige — o pedido já existe, os campos já vieram preenchidos. */
export function AddressFields({
  value,
  onChange,
  variant,
}: {
  value: AddressFieldsValue
  onChange: (patch: Partial<AddressFieldsValue>) => void
  variant: 'create' | 'edit'
}) {
  const isCreate = variant === 'create'
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Faturamento (Bill To)">
          <Textarea
            required={isCreate}
            rows={5}
            placeholder={
              isCreate ? 'Attn: Nome\nEndereço\nCidade, Estado. País.\nCEP\nMail: ...\nTel: ...' : undefined
            }
            value={value.billToText}
            onChange={(e) => onChange({ billToText: e.target.value })}
          />
        </Field>
        <Field label="Entrega (Ship To)">
          <Textarea
            required={isCreate}
            rows={5}
            placeholder={isCreate ? 'Attn: Nome - Empresa\nEndereço de entrega\n...' : undefined}
            value={value.shipToText}
            onChange={(e) => onChange({ shipToText: e.target.value })}
          />
        </Field>
      </div>
      <Field
        label="Observação de entrega (opcional)"
        hint={isCreate ? 'ex: "HOLD FOR PICKUP – CUSTOMER WILL COLLECT AT DHL OFFICE"' : undefined}
        className={isCreate ? 'mt-4' : undefined}
      >
        <Input value={value.shipToNote} onChange={(e) => onChange({ shipToNote: e.target.value })} />
      </Field>
    </>
  )
}

export interface WeightFieldsValue {
  netWeightKg: string
  grossWeightKg: string
}

/**
 * Peso líquido/bruto. Devolvido sem wrapper de grid — NewOrder encaixa estes
 * dois campos junto com um terceiro (Via de envio/Incoterms) num grid de 3
 * colunas; OrderDetail usa um grid próprio de 2. Cada página mantém o grid
 * que já tem; este componente só evita duplicar o par de <Field>.
 */
export function WeightFields({
  value,
  onChange,
}: {
  value: WeightFieldsValue
  onChange: (patch: Partial<WeightFieldsValue>) => void
}) {
  return (
    <>
      <Field label="Peso líquido (kg)">
        <Input
          type="number"
          step="0.001"
          className="tabular"
          value={value.netWeightKg}
          onChange={(e) => onChange({ netWeightKg: e.target.value })}
        />
      </Field>
      <Field label="Peso bruto (kg)">
        <Input
          type="number"
          step="0.001"
          className="tabular"
          value={value.grossWeightKg}
          onChange={(e) => onChange({ grossWeightKg: e.target.value })}
        />
      </Field>
    </>
  )
}

export interface InvoiceFieldsValue {
  nfNumber: string
  nfDate: string
}

/**
 * Número e data de emissão da NF. Sem wrapper de grid pelo mesmo motivo do
 * WeightFields — NewOrder usa `grid-cols-1 sm:grid-cols-2` (responsivo),
 * OrderDetail usa `grid-cols-2` fixo; unificar isso mudaria o comportamento
 * em telas estreitas numa das duas, fora do escopo desta extração.
 */
export function InvoiceFields({
  value,
  onChange,
}: {
  value: InvoiceFieldsValue
  onChange: (patch: Partial<InvoiceFieldsValue>) => void
}) {
  return (
    <>
      <Field label="Número da NF">
        <Input value={value.nfNumber} onChange={(e) => onChange({ nfNumber: e.target.value })} />
      </Field>
      <Field label="Data de emissão">
        <Input type="date" value={value.nfDate} onChange={(e) => onChange({ nfDate: e.target.value })} />
      </Field>
    </>
  )
}
```

- [ ] **Step 2: Verificar**

```bash
npm run build --workspace=packages/shared && npm run build --workspace=apps/web
npm run lint --workspace=apps/web
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/OrderFormFields.tsx
git commit -m "feat(web): add shared Buyer/Address/Weight/Invoice order form fields"
```

---

### Task 2: Usar em `NewOrder.tsx`

**Files:**
- Modify: `apps/web/src/pages/NewOrder.tsx`

**Interfaces:**
- Consumes: `BuyerFields`, `AddressFields`, `WeightFields`, `InvoiceFields` da Task 1. `onChange` de cada um recebe `update` diretamente (já tem a assinatura `(patch: Partial<typeof form>) => void`, compatível por estrutura com todo `Partial<XyzValue>` já que `form` contém todos os mesmos nomes de campo).

- [ ] **Step 1: Adicionar o import**

No topo do arquivo, junto aos outros imports de `../components/`:
```ts
import { AddressFields, BuyerFields, InvoiceFields, WeightFields } from '../components/OrderFormFields'
```

- [ ] **Step 2: Trocar o bloco "Comprador"**

Substituir (dentro de `<FormSection title="Comprador">`):
```tsx
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Pedido de compra (opcional)" hint="Se vazio, usa o número do orçamento.">
                <Input value={form.purchaseOrder} onChange={(e) => update({ purchaseOrder: e.target.value })} />
              </Field>
              <Field label="E-mail do comprador">
                <Input
                  type="email"
                  required
                  value={form.orderedByEmail}
                  onChange={(e) => update({ orderedByEmail: e.target.value })}
                />
              </Field>
              <Field label="Data de expedição (opcional)">
                <Input type="date" value={form.shipDate} onChange={(e) => update({ shipDate: e.target.value })} />
              </Field>
            </div>
```
por:
```tsx
            <BuyerFields value={form} onChange={update} variant="create" />
```

- [ ] **Step 3: Trocar o bloco "Endereços"**

Substituir (dentro de `<FormSection title="Endereços">`):
```tsx
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Faturamento (Bill To)">
                <Textarea
                  required
                  rows={5}
                  placeholder={'Attn: Nome\nEndereço\nCidade, Estado. País.\nCEP\nMail: ...\nTel: ...'}
                  value={form.billToText}
                  onChange={(e) => update({ billToText: e.target.value })}
                />
              </Field>
              <Field label="Entrega (Ship To)">
                <Textarea
                  required
                  rows={5}
                  placeholder={'Attn: Nome - Empresa\nEndereço de entrega\n...'}
                  value={form.shipToText}
                  onChange={(e) => update({ shipToText: e.target.value })}
                />
              </Field>
            </div>
            <Field
              label="Observação de entrega (opcional)"
              hint='ex: "HOLD FOR PICKUP – CUSTOMER WILL COLLECT AT DHL OFFICE"'
              className="mt-4"
            >
              <Input value={form.shipToNote} onChange={(e) => update({ shipToNote: e.target.value })} />
            </Field>
```
por:
```tsx
            <AddressFields value={form} onChange={update} variant="create" />
```

- [ ] **Step 4: Trocar os dois campos de peso (dentro do grid de 3 colunas, mantendo o campo condicional Via/Incoterms exatamente como está)**

Substituir só estas duas `Field`s (as duas primeiras do grid `sm:grid-cols-3`, ANTES do `{isNational ? (...) : (...)}`):
```tsx
              <Field label="Peso líquido (kg)">
                <Input
                  type="number"
                  step="0.001"
                  className="tabular"
                  value={form.netWeightKg}
                  onChange={(e) => update({ netWeightKg: e.target.value })}
                />
              </Field>
              <Field label="Peso bruto (kg)">
                <Input
                  type="number"
                  step="0.001"
                  className="tabular"
                  value={form.grossWeightKg}
                  onChange={(e) => update({ grossWeightKg: e.target.value })}
                />
              </Field>
```
por:
```tsx
              <WeightFields value={form} onChange={update} />
```
O `{isNational ? (...) : (...)}` logo depois continua exatamente igual, sem nenhuma linha tocada — ele fica como o terceiro item do mesmo grid de 3 colunas.

- [ ] **Step 5: Trocar o bloco "Nota fiscal"**

Substituir (dentro de `<FormSection title="Nota fiscal" description="...">`):
```tsx
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Número da NF">
                <Input value={form.nfNumber} onChange={(e) => update({ nfNumber: e.target.value })} />
              </Field>
              <Field label="Data de emissão">
                <Input type="date" value={form.nfDate} onChange={(e) => update({ nfDate: e.target.value })} />
              </Field>
            </div>
```
por:
```tsx
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InvoiceFields value={form} onChange={update} />
            </div>
```

- [ ] **Step 6: Verificar imports não usados**

Depois das trocas acima, `Field`, `Input` e `Textarea` continuam sendo usados em outras partes do arquivo (Orçamento de origem, Via/Incoterms, AWB, Pagamento) — não remover esses imports, só confirmar via build que nada ficou órfão.

```bash
npm run build --workspace=packages/shared && npm run build --workspace=apps/web
npm run lint --workspace=apps/web
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/NewOrder.tsx
git commit -m "refactor(web): NewOrder uses shared Buyer/Address/Weight/Invoice fields"
```

---

### Task 3: Usar em `OrderDetail.tsx`

**Files:**
- Modify: `apps/web/src/pages/OrderDetail.tsx`

**Interfaces:**
- Consumes: os mesmos 4 componentes da Task 1. `onChange` de cada um vira um adaptador de uma linha: `(patch) => setEditForm((s) => ({ ...s, ...patch }))` — `editForm` é `Partial<{...}>`, e os valores passados (`value={editForm}`) já têm exatamente os mesmos nomes de campo que `BuyerFieldsValue`/etc. esperam (confirmado campo a campo na investigação: `purchaseOrder`, `orderedByEmail`, `shipDate`, `billToText`, `shipToText`, `shipToNote`, `netWeightKg`, `grossWeightKg`, `nfNumber`, `nfDate` — todos strings em ambos os arquivos). Como `editForm` é `Partial`, os campos podem ser `undefined` no tipo — os componentes da Task 1 esperam `string` não-opcional; `startEdit()` (já existente, inalterado) sempre inicializa todos esses campos com `?? ''`, garantindo que na prática nunca chegam `undefined` quando o formulário de edição está montado — mas o TypeScript vai reclamar do tipo `Partial` puro. Resolver com um pequeno adaptador de "valor com fallback" no Step 2, não afrouxando o tipo dos componentes compartilhados.

- [ ] **Step 1: Adicionar o import e o adaptador de onChange**

No topo do arquivo:
```ts
import { AddressFields, BuyerFields, InvoiceFields, WeightFields } from '../components/OrderFormFields'
```

Dentro de `OrderDetail()`, logo depois da declaração de `editForm`/`setEditForm` (não precisa ser exatamente ali, qualquer ponto antes do JSX que os usa):
```ts
  function updateEditForm(patch: Partial<typeof editForm>) {
    setEditForm((s) => ({ ...s, ...patch }))
  }
```

- [ ] **Step 2: Trocar o bloco "Comprador" (dentro do `<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">` de comprador)**

Substituir:
```tsx
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Pedido de compra">
                    <Input
                      value={editForm.purchaseOrder}
                      onChange={(e) => setEditForm((s) => ({ ...s, purchaseOrder: e.target.value }))}
                    />
                  </Field>
                  <Field label="E-mail do comprador">
                    <Input
                      type="email"
                      value={editForm.orderedByEmail}
                      onChange={(e) => setEditForm((s) => ({ ...s, orderedByEmail: e.target.value }))}
                    />
                  </Field>
                  <Field label="Data de expedição">
                    <Input
                      type="date"
                      value={editForm.shipDate}
                      onChange={(e) => setEditForm((s) => ({ ...s, shipDate: e.target.value }))}
                    />
                  </Field>
                </div>
```
por:
```tsx
                <BuyerFields
                  value={{
                    purchaseOrder: editForm.purchaseOrder ?? '',
                    orderedByEmail: editForm.orderedByEmail ?? '',
                    shipDate: editForm.shipDate ?? '',
                  }}
                  onChange={updateEditForm}
                  variant="edit"
                />
```

- [ ] **Step 3: Trocar o bloco "Endereços"**

Substituir:
```tsx
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Faturamento (Bill To)">
                    <Textarea
                      rows={5}
                      value={editForm.billToText}
                      onChange={(e) => setEditForm((s) => ({ ...s, billToText: e.target.value }))}
                    />
                  </Field>
                  <Field label="Entrega (Ship To)">
                    <Textarea
                      rows={5}
                      value={editForm.shipToText}
                      onChange={(e) => setEditForm((s) => ({ ...s, shipToText: e.target.value }))}
                    />
                  </Field>
                </div>
                <Field label="Observação de entrega (opcional)">
                  <Input
                    value={editForm.shipToNote}
                    onChange={(e) => setEditForm((s) => ({ ...s, shipToNote: e.target.value }))}
                  />
                </Field>
```
por:
```tsx
                <AddressFields
                  value={{
                    billToText: editForm.billToText ?? '',
                    shipToText: editForm.shipToText ?? '',
                    shipToNote: editForm.shipToNote ?? '',
                  }}
                  onChange={updateEditForm}
                  variant="edit"
                />
```

- [ ] **Step 4: Trocar o bloco de pesos**

Substituir:
```tsx
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Peso líquido (kg)">
                    <Input
                      type="number"
                      step="0.001"
                      className="tabular"
                      value={editForm.netWeightKg}
                      onChange={(e) => setEditForm((s) => ({ ...s, netWeightKg: e.target.value }))}
                    />
                  </Field>
                  <Field label="Peso bruto (kg)">
                    <Input
                      type="number"
                      step="0.001"
                      className="tabular"
                      value={editForm.grossWeightKg}
                      onChange={(e) => setEditForm((s) => ({ ...s, grossWeightKg: e.target.value }))}
                    />
                  </Field>
                </div>
```
por:
```tsx
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <WeightFields
                    value={{
                      netWeightKg: editForm.netWeightKg ?? '',
                      grossWeightKg: editForm.grossWeightKg ?? '',
                    }}
                    onChange={updateEditForm}
                  />
                </div>
```

- [ ] **Step 5: Trocar o bloco "Nota fiscal"**

Substituir:
```tsx
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Número da NF">
                    <Input
                      value={editForm.nfNumber}
                      onChange={(e) => setEditForm((s) => ({ ...s, nfNumber: e.target.value }))}
                    />
                  </Field>
                  <Field label="Emissão da NF">
                    <Input
                      type="date"
                      value={editForm.nfDate}
                      onChange={(e) => setEditForm((s) => ({ ...s, nfDate: e.target.value }))}
                    />
                  </Field>
                </div>
```
por:
```tsx
                <div className="grid grid-cols-2 gap-4">
                  <InvoiceFields
                    value={{ nfNumber: editForm.nfNumber ?? '', nfDate: editForm.nfDate ?? '' }}
                    onChange={updateEditForm}
                  />
                </div>
```

(A troca de rótulo "Emissão da NF" → "Data de emissão", vindo do componente compartilhado, é a única mudança de texto visível deste plano — copy idêntica ao que `NewOrder.tsx` já mostra para o mesmo campo.)

- [ ] **Step 6: Verificar**

```bash
npm run build --workspace=packages/shared && npm run build --workspace=apps/web
npm run lint --workspace=apps/web
```
O TypeScript aqui é a validação central: qualquer prop faltando, tipo errado (`string | undefined` vs `string`) ou nome de campo trocado quebra o build imediatamente.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/OrderDetail.tsx
git commit -m "refactor(web): OrderDetail uses shared Buyer/Address/Weight/Invoice fields"
```

---

## Self-Review Notes

- **Cobertura**: os 4 blocos que a investigação classificou como seguros de extrair (Comprador, Endereços, Pesos, Nota Fiscal) estão cobertos. Os 2 blocos classificados como precisando de reestruturação (Incoterms/Via de envio/AWB, Pagamento/PayPal/câmbio) ficam deliberadamente de fora — nenhuma linha desses blocos é tocada em nenhuma das duas páginas.
- **Sem placeholders**: cada task tem o diff exato (bloco antigo → chamada nova), extraído do código real lido nesta sessão, não reconstruído de memória.
- **Consistência de tipos**: os 4 componentes e seus 4 tipos `XyzValue` foram desenhados a partir dos nomes de campo reais de `form` (NewOrder) e `editForm` (OrderDetail) — confirmados idênticos entre os dois arquivos antes de escrever este plano.
- **Risco assumido e mitigado**: sem verificação visual ao vivo possível nesta sessão (ver Architecture). A mitigação é o TypeScript pegar qualquer divergência estrutural, mais o desenho deliberadamente conservador (nenhum wrapper de grid novo, nenhuma mudança de `required`, nenhuma seção nova) que reduz a superfície do que poderia dar errado a "o texto mudou de lugar", não "o formulário quebrou".
- **Ganho colateral pequeno e seguro**: o rótulo "Emissão da NF" (OrderDetail) vira "Data de emissão" (igual a NewOrder) — puramente cosmético, correção de uma inconsistência de copy que a própria extração já resolve sem esforço extra.
