# Como contribuir

Convenções deste repositório. São poucas e existem para que o código pareça
ter sido escrito por uma pessoa só.

## Idioma

**Português em tudo**: comentários, documentação, mensagens de commit, mensagens
de erro voltadas ao usuário e ao desenvolvedor.

Identificadores (nomes de variável, função, tipo, arquivo) ficam em inglês,
seguindo a convenção da linguagem e das bibliotecas — `quoteNumber`, não
`numeroOrcamento`. Termos do negócio que não têm tradução estabelecida no
sistema ficam como estão no documento real: `Invoice`, `Packing List`, `AWB`,
`Incoterms`.

## Comentários

A regra é uma só: **comentário explica o porquê, não o quê**. O código já diz o
que faz; se não disser, o problema é o código, não a falta de comentário.

Um comentário útil responde a alguma destas perguntas:

- Por que assim e não do jeito óbvio?
- Que bug isso está evitando?
- Que regra de negócio ou restrição externa obriga isso?

```ts
// ✗ Restata o código
// Ordena os produtos por nome
products.toSorted((a, b) => a.name.localeCompare(b.name))

// ✓ Explica uma decisão que não está no código
// Setor é um array escalar em Product, e o Prisma só sabe filtrar array por
// pertencimento exato (`has`), não por trecho. Como o catálogo é pequeno
// (~500 linhas), a busca livre é feita em JS.
```

### Formato

| Situação | Formato |
| --- | --- |
| Contrato de algo exportado (função, tipo, constante) | bloco `/** */` logo acima da declaração |
| Justificativa de uma linha ou bloco dentro de uma função | `//` na linha acima |
| Papel de um arquivo inteiro, quando não é óbvio pelo nome | bloco `/** */` no topo |

`@param` e `@returns` **só quando acrescentam informação que a assinatura não
dá**. TypeScript já carrega os tipos; repeti-los em prosa é ruído.

```ts
// ✗ Não acrescenta nada
/**
 * Calcula o total.
 * @param subtotal O subtotal
 * @returns O total
 */

// ✓ Diz o que o tipo não diz
/**
 * @returns a mensagem do problema, ou `null` quando a combinação é válida.
 */
```

### O que não entra

- **Código comentado.** O histórico do git guarda isso.
- **Comentário de cabeçalho com autor e data.** O `git blame` também.
- **`TODO` sem dono.** Se for para ficar, use `// TODO(nome): o que falta`. Se
  ninguém vai fazer, não escreva.
- **Comentário que documenta uma versão antiga do código.** Comentário errado é
  pior que comentário nenhum — ao mudar o código, mude o comentário junto.

## Organização

- **Um arquivo, um tipo de coisa.** Arquivo que exporta componente React não
  exporta também constante, tipo ou hook: isso quebra o fast refresh do Vite e
  faz a aplicação inteira recarregar a cada alteração. Formato de formulário vai
  para `*.model.ts`; contexto e hook, para um arquivo separado do provider.
- **Regra de negócio não mora em arquivo de rota.** O que decide preço, divisão
  em caixas ou documentação de pedido fica em `apps/api/src/domain/`, sem Prisma
  e sem Express, onde dá para testar sem subir banco. A rota orquestra: lê o
  banco, chama o domínio, responde.
- **Regra usada nas duas pontas mora em `packages/shared`.** Se a API e a tela
  precisam fazer a mesma conta, ela é escrita uma vez lá — foi assim que o total
  do Invoice passou a fechar nos dois lados.
- **Arquivo tem o nome do que exporta.** `AuthProvider.tsx` exporta
  `AuthProvider`; `AuthContext.ts` exporta `AuthContext`.

## Testes

Regra de negócio tem teste. São testes de unidade com o runner nativo do Node
(`node:test`), sem framework adicional, em arquivos `*.test.ts` ao lado do
código que testam.

```bash
npm test           # unidade, em todos os workspaces
npm run lint       # oxlint no monorepo inteiro
npm run typecheck  # tsc sem emitir
```

O teste descreve a regra em português, na voz do negócio, e não a implementação:

```ts
it('cai para preço final em real e euro, que não têm coluna de distribuidor', ...)
```

Caso que já deu bug entra como teste com o comentário do que aconteceu — é o
que impede a regressão de voltar sem ninguém notar.

## Commits

Formato [Conventional Commits](https://www.conventionalcommits.org/):
`tipo(escopo): resumo no imperativo`, com `feat`, `fix`, `refactor`, `chore`,
`docs`, `test`.

O corpo explica **por quê**, não o quê — o diff já mostra o quê. Correção de bug
descreve o caminho que reproduz o problema.

Um commit faz uma coisa. Correção de comportamento não viaja junto com
refatoração: se o commit diz "nada muda" e alguma coisa muda, o histórico deixa
de servir para investigar.

## Antes de abrir PR

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

A CI roda os quatro, mais o teste de integração com Postgres de verdade
(`npm run test:integration`).
