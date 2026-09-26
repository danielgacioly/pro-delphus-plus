import { Router } from 'express'
import multer from 'multer'
import {
  ApiError,
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type Content,
  type FunctionDeclaration,
  type GenerateContentParameters,
  type Schema,
} from '@google/genai'
import { ZodError } from 'zod'
import { env, IS_PRODUCTION } from '../lib/env.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { buildNeoSystemInstruction } from '../lib/neoKnowledge.js'
import { recentHistory } from '../lib/neoHistory.js'
import { toPublicPendingAction, getPendingAction, discardPendingAction, redactInternalIds } from '../lib/neoPendingActions.js'
import {
  buscarProdutos,
  listarClientes,
  buscarCliente,
  listarSetores,
  buscarOrcamentos,
  buscarPedidos,
  verificarPendencias,
  criarTarefa,
  proporOrcamento,
  proporEdicaoOrcamento,
  proporPedido,
  proporEdicaoPedido,
  proporCliente,
  proporEdicaoCliente,
  buscarBiblioteca,
  proporRegistroBiblioteca,
} from '../lib/neoTools.js'
import { toQuoteDTO, toClientDTO, toLibraryEntryDTO } from '../lib/dto.js'
import { createQuoteRecord, updateQuoteRecord } from './quotes.routes.js'
import { createOrderRecord, updateOrderRecord, toOrderDTOFresh } from './orders.routes.js'
import { createClientRecord, updateClientRecord } from './clients.routes.js'
import { createLibraryEntryRecord } from './library.routes.js'

export const neoRouter = Router()
neoRouter.use(requireAuth)

// O lite responde em 2-5s, mas às vezes passa de 25s; o teto evita que uma
// chamada travada deixe a pessoa olhando os três pontinhos pra sempre.
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { timeout: 45_000 } })

// Em memória, não em disco: é áudio de ditado, não um documento do sistema —
// vira texto e é descartado, nunca precisa sobreviver a um restart.
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

const AUDIO_EXTENSION: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
}
const MAX_TOOL_ITERATIONS = 6
// O NEO escolhe ferramentas e segue regras escritas; não resolve problema
// difícil. Raciocínio baixo corta tempo e custo de cada chamada (o
// raciocínio é cobrado como saída), e o ganho se multiplica pelas 3-5
// chamadas de um orçamento.
const THINKING_CONFIG = { thinkingLevel: ThinkingLevel.LOW }
// Picos de 429 (limite por minuto) e 5xx do Gemini costumam passar em segundos;
// sem retry, cada soluço desses virava erro na cara do usuário.
const RETRY_DELAYS_MS = [1500, 4000]

function isTransient(err: unknown) {
  if (err instanceof ApiError) return err.status === 429 || err.status >= 500
  // O timeout do nosso próprio httpOptions bate como DOMException AbortError,
  // não ApiError — mas "não respondeu a tempo" é tão "tente de novo" quanto
  // um 503 explícito. Visto ao vivo: gemini-3.6-flash abortou aos 45s sem
  // nunca devolver status nenhum, e sem isto o fallback parava ali.
  return err instanceof DOMException && err.name === 'AbortError'
}

// Tenta um modelo específico, com retry em erro transitório (429/5xx). Deixa
// o erro original subir (sem embrulhar em HttpError) — quem decide se vale a
// pena tentar um modelo alternativo, ou desistir de vez, é o chamador.
// Modelos que recusaram o nível de raciocínio (400). O parâmetro é só
// otimização: se um modelo novo configurado no .env não aceitar, o NEO segue
// sem ele em vez de parar de responder.
const modelsWithoutThinkingLevel = new Set<string>()

function isThinkingLevelRejected(err: unknown) {
  return err instanceof ApiError && err.status === 400 && /thinking/i.test(err.message)
}

async function callGeminiModel(model: string, params: Omit<GenerateContentParameters, 'model'>) {
  const startedAt = Date.now()
  for (let attempt = 0; ; attempt++) {
    try {
      const config = modelsWithoutThinkingLevel.has(model) ? { ...params.config, thinkingConfig: undefined } : params.config
      const result = await ai.models.generateContent({ ...params, config, model })
      // Sempre loga, mesmo em produção (sem isso, uma reclamação de "tá lento"
      // não tinha como ser diagnosticada — só suspeita) — sem dado sensível,
      // só duração e quantas tentativas precisou.
      console.info(`[neo] ${model} respondeu em ${Date.now() - startedAt}ms (tentativa ${attempt + 1})`)
      return result
    } catch (err) {
      if (isThinkingLevelRejected(err) && !modelsWithoutThinkingLevel.has(model)) {
        console.warn(`[neo] ${model} não aceita thinkingLevel, seguindo sem ele`)
        modelsWithoutThinkingLevel.add(model)
        // Não conta como tentativa: as de erro transitório continuam todas.
        attempt--
        continue
      }
      if (isTransient(err) && attempt < RETRY_DELAYS_MS.length) {
        const reason = err instanceof ApiError ? String(err.status) : 'timeout'
        console.warn(`[neo] ${model} ${reason}, nova tentativa em ${RETRY_DELAYS_MS[attempt]}ms`)
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
        continue
      }
      console.error(`[neo] falha ao chamar ${model} após ${Date.now() - startedAt}ms:`, err)
      throw err
    }
  }
}

// O ApiError do Gemini traz `status` 4xx (ex.: 429 de cota), e o errorHandler
// repassaria a mensagem crua do Google — com detalhes de cota/projeto — como
// se fosse erro do request. Aqui vira uma mensagem amigável.
function neoUnavailableError(err: unknown): HttpError {
  if (err instanceof ApiError && err.status === 429) {
    return new HttpError(503, 'O NEO atingiu o limite de uso por agora. Tenta de novo daqui a pouco.')
  }
  return new HttpError(502, 'O NEO não conseguiu responder agora. Tenta de novo em instantes.')
}

// Tenta o modelo preferido e, se ele esgotar as tentativas com um erro
// transitório (pico de demanda do lado do Google, não algo que repetir vai
// resolver), cai pros modelos de `GEMINI_FALLBACK_MODELS` em ordem — cada um
// tem cota grátis própria, então um "high demand" isolado num modelo não
// deixa o NEO inteiro sem responder. Devolve também qual modelo respondeu,
// pra quem chama continuar usando o mesmo nas próximas idas e vindas da
// mesma conversa (evita pagar o custo de redescobrir a cada iteração).
async function generateNeoContent(preferredModel: string, params: Omit<GenerateContentParameters, 'model'>) {
  const candidates = [preferredModel, ...env.GEMINI_FALLBACK_MODELS.filter((m) => m !== preferredModel)]
  let lastErr: unknown
  for (const model of candidates) {
    try {
      const response = await callGeminiModel(model, params)
      return { response, modelUsed: model }
    } catch (err) {
      lastErr = err
      if (!isTransient(err)) throw neoUnavailableError(err)
      console.warn(`[neo] ${model} indisponível, tentando modelo alternativo`)
    }
  }
  throw neoUnavailableError(lastErr)
}

// Erro de validação numa ferramenta (faltou moeda, cliente sem endereço,
// orçamento inexistente) é informação pro modelo, não falha do request: ele
// precisa ver o que faltou pra perguntar à pessoa. Só erro inesperado sobe.
function toolErrorForModel(err: unknown) {
  if (err instanceof ZodError) {
    return {
      erro: 'Dados inválidos ou faltando — pergunte à pessoa antes de tentar de novo.',
      problemas: err.issues.map((i) => `${i.path.join('.') || '(geral)'}: ${i.message}`),
    }
  }
  if (err instanceof HttpError && err.status < 500) return { erro: err.message }
  return null
}

const readTools: FunctionDeclaration[] = [
  {
    name: 'buscar_produtos',
    description:
      'Busca produtos ativos do catálogo por setor(es), tipo e/ou texto livre, e também responde pergunta de preço: ordene por preço e use limite pra achar o mais caro/mais barato, ou precoMax/precoMin pra "o que cabe em até X". Devolve nome, SKU, tipo ("modelo completo" ou "componente (peça)"), setores e todos os preços — e, quando a busca traz até 5 produtos, também descricaoPadrao e componentesPadrao (en/pt), que é o que responde "qual é a descrição / quais são os componentes desse produto". Pra "quais são os modelos completos" ou "quantos componentes existem", use o parâmetro tipo — sem ele a lista e o total misturam os dois. O campo "total" da resposta é a contagem REAL de produtos que casam com o filtro (não só os que vieram na lista, que pode vir cortada) — pra "quantos produtos vocês têm", chame sem nenhum filtro e leia "total". Se o texto buscado não bater com nada, a resposta pode vir com "sugestoesPorSemelhanca" (produto parecido, possível erro de digitação) — nesse caso PERGUNTE à pessoa se é um desses antes de usar; nunca escolha sozinho.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        setores: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Nomes de setor, pode incluir vários (inclusive correlatos)' },
        tipo: {
          type: Type.STRING,
          enum: ['modelo_completo', 'componente'],
          description:
            'modelo_completo = o simulador inteiro, que é o que se vende como produto principal; componente = peça isolada (reposição/parte de um modelo). Sem este filtro vêm os dois misturados.',
        },
        texto: { type: Type.STRING, description: 'Texto livre pra buscar no nome/descrição do produto' },
        moeda: { type: Type.STRING, enum: ['BRL', 'USD', 'EUR', 'USD_DISTRIBUIDOR'], description: 'Moeda usada pra ordenar/filtrar preço (padrão BRL)' },
        ordenar: { type: Type.STRING, enum: ['nome', 'preco_desc', 'preco_asc'], description: 'preco_desc = mais caro primeiro; preco_asc = mais barato primeiro' },
        precoMin: { type: Type.NUMBER },
        precoMax: { type: Type.NUMBER, description: 'Ex.: "algo até 5 mil" → precoMax 5000' },
        limite: { type: Type.NUMBER, description: 'Quantos produtos devolver (máx. 30). Pro "mais caro", use 1' },
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
    description:
      'Busca um cliente pelo nome da pessoa ou da instituição. Use antes de propor orçamento pra pegar o clientId real. Se não achar nome exato, a resposta pode vir com "sugestoesPorSemelhanca" (cliente parecido, possível erro de digitação) — nesse caso PERGUNTE à pessoa se é um desses ("Você quis dizer X?") antes de usar o clientId; nunca escolha sozinho.',
    parameters: { type: Type.OBJECT, properties: { nome: { type: Type.STRING } }, required: ['nome'] },
  },
  {
    name: 'listar_setores',
    description: 'Lista todos os setores/áreas médicas do catálogo.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'buscar_orcamentos',
    description:
      'Busca orçamentos (os 10 mais recentes que casarem) por número e/ou nome do cliente. Devolve id, itens, moeda, total e números dos pedidos já criados. Use pra achar o id antes de editar orçamento ou criar pedido.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        numero: { type: Type.STRING, description: 'Número do orçamento, ex. 260915-01 (aceita parte)' },
        cliente: { type: Type.STRING, description: 'Nome do cliente' },
      },
    },
  },
  {
    name: 'buscar_pedidos',
    description: 'Busca pedidos (os 10 mais recentes que casarem) por número e/ou nome do cliente. Use pra achar o id antes de editar pedido.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        numero: { type: Type.NUMBER, description: 'Número do pedido' },
        cliente: { type: Type.STRING, description: 'Nome do cliente' },
      },
    },
  },
  {
    name: 'verificar_pendencias',
    description:
      'Lista o que está parado: pedidos pendentes sem AWB e/ou Nota Fiscal (conforme o pedido é nacional ou internacional) e clientes marcados em atendimento sem orçamento recente ou nunca orçados. Use pra perguntas como "o que falta fazer", "tem pendência", "quem eu preciso retornar".',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'buscar_biblioteca',
    description:
      'Busca na Biblioteca — perguntas que clientes já fizeram sobre os simuladores (funcionalidade, material, uso médico, o que dá ou não dá pra fazer) ou sobre um cliente, com a resposta que a empresa confirmou. A busca é por significado: mande a pergunta do jeito que a pessoa fez, não precisa acertar as palavras. Use SEMPRE que perguntarem se um produto tem/faz/simula algo, ou qualquer dúvida técnica/médica sobre um simulador — antes de responder com conhecimento próprio. "semelhanca" diz se é quase a mesma pergunta ou só do mesmo assunto.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pergunta: { type: Type.STRING, description: 'A pergunta, com as palavras da pessoa (inclua o nome do produto se ela citou)' },
        produtoId: { type: Type.STRING, description: 'Só se a pergunta é sobre um produto específico: productId de buscar_produtos' },
        clienteId: { type: Type.STRING, description: 'Só se a pergunta é sobre um cliente específico: clienteId de buscar_cliente' },
      },
      required: ['pergunta'],
    },
  },
]

const itemSchema = {
  type: Type.OBJECT,
  properties: {
    productId: { type: Type.STRING },
    quantity: { type: Type.NUMBER },
    unitPrice: {
      type: Type.NUMBER,
      description:
        'Preço negociado do item ("preço especial"), quando diferente do preço de catálogo. Pedido de desconto num item específico ("10% de desconto nesse produto") vai AQUI — calcule preço de catálogo × (1 - desconto) e preencha este campo. Não use o campo "discount" do orçamento pra isso: ele é um abatimento geral sobre o total, não por item.',
    },
    title: { type: Type.STRING, description: 'Nome customizado do item, só se a pessoa pedir um diferente do nome de catálogo' },
    description: {
      type: Type.STRING,
      description:
        'Descrição impressa no item. OMITA para usar a descrição padrão do produto (só preencha se a pessoa recusou o padrão e ditou uma).',
    },
    components: {
      type: Type.STRING,
      description:
        'Componentes do item, só de modelo completo ("1 MMT 0, 1 MMT 1"), sem o rótulo "Componentes:" — o sistema coloca. OMITA para usar os componentes padrão do produto; só preencha se a pessoa recusou o padrão e ditou os dela. String vazia = sem componentes.',
    },
  },
  required: ['productId', 'quantity'],
}

// Na edição o orçamento é reescrito inteiro: sem repassar o preço/nome que já
// estavam no item, um preço especial negociado com o cliente voltaria
// silenciosamente pro preço de catálogo.
const editItemSchema = {
  type: Type.OBJECT,
  properties: {
    productId: { type: Type.STRING },
    quantity: { type: Type.NUMBER },
    unitPrice: {
      type: Type.NUMBER,
      description:
        'Preço negociado do item ("preço especial"). Repita o valor atual (de buscar_orcamentos) quando não muda; se a pessoa pedir desconto nesse item agora, calcule o valor novo aqui — não use o campo "discount" do orçamento, que é um abatimento geral sobre o total, não por item.',
    },
    title: { type: Type.STRING, description: 'Repita o title atual do item, se houver' },
    description: {
      type: Type.STRING,
      description: 'Repita a description atual do item (de buscar_orcamentos), ou a nova se a pessoa pediu pra mudar. Sem repassar, volta pro padrão do produto.',
    },
    components: {
      type: Type.STRING,
      description: 'Repita os components atuais do item (de buscar_orcamentos), ou os novos se a pessoa pediu pra mudar. Sem repassar, voltam pro padrão do produto. String vazia = sem componentes.',
    },
  },
  required: ['productId', 'quantity'],
}

const quoteFieldsProps = {
  clientName: { type: Type.STRING },
  clientId: { type: Type.STRING, description: 'Id do cliente cadastrado (de buscar_cliente), se houver' },
  items: { type: Type.ARRAY, items: itemSchema },
  exportScope: { type: Type.STRING, enum: ['NATIONAL', 'INTERNATIONAL'], description: 'NATIONAL = Brasil, sempre BRL e português' },
  currency: { type: Type.STRING, enum: ['BRL', 'USD', 'EUR'], description: 'Obrigatório se INTERNATIONAL (USD ou EUR)' },
  language: { type: Type.STRING, enum: ['PT', 'EN', 'ES'], description: 'Idioma do documento. Obrigatório se INTERNATIONAL' },
  priceTier: { type: Type.STRING, enum: ['FINAL', 'DISTRIBUTOR'], description: 'Obrigatório se USD' },
  freight: { type: Type.NUMBER, description: 'Frete, na moeda do orçamento' },
  discount: {
    type: Type.NUMBER,
    description:
      'Desconto GERAL, sem menção a item específico ("me dá 10% de desconto" sem falar de produto nenhum) — valor ABSOLUTO sobre o total do orçamento, na moeda do orçamento, nunca porcentagem. Some o subtotal dos itens (quantidade × preço de catálogo de cada um) e calcule você mesmo o valor absoluto antes de preencher. Desconto pedido pra um produto específico vai no unitPrice desse item, não aqui.',
  },
  notes: {
    type: Type.STRING,
    description:
      'Observações do orçamento. Ao editar, ACRESCENTA ao que já existe — pegue o notes atual de buscar_orcamentos e mande ele + o texto novo. Só substitui o texto inteiro se a pessoa pedir isso explicitamente.',
  },
}

// Peso por unidade e divisão por caixa são informados por SKU/nome do item; a
// API converte pro formato posicional que o banco guarda.
const orderItemProps: Record<string, Schema> = {
  pesosPorItem: {
    type: Type.ARRAY,
    description: 'Kg/Un: peso por unidade de cada item do orçamento',
    items: {
      type: Type.OBJECT,
      properties: {
        item: { type: Type.STRING, description: 'SKU ou nome exato do item, como veio em buscar_orcamentos' },
        kgPorUnidade: { type: Type.NUMBER },
      },
      required: ['item', 'kgPorUnidade'],
    },
  },
  caixas: {
    type: Type.ARRAY,
    description:
      'O que vai em cada caixa, do jeito que a pessoa falar. Item que não está no orçamento é aceito como item avulso e sai destacado no cartão.',
    items: {
      type: Type.OBJECT,
      properties: {
        caixa: { type: Type.NUMBER, description: 'Número da caixa, começando em 1' },
        itens: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { item: { type: Type.STRING }, quantidade: { type: Type.NUMBER } },
            required: ['item', 'quantidade'],
          },
        },
      },
      required: ['caixa', 'itens'],
    },
  },
}

const writeTools: FunctionDeclaration[] = [
  {
    name: 'criar_tarefa',
    description:
      'Cria uma tarefa no quadro pessoal (Minha Pro Delphus) de quem está conversando com você — GRAVA NA HORA, sem prévia nem confirmação (diferente das ferramentas "propor_*"): é um lembrete pessoal, não um documento comercial. Use quando pedirem pra anotar, lembrar ou criar uma tarefa/pendência.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING },
        notas: { type: Type.STRING },
        clienteNome: { type: Type.STRING, description: 'Nome do cliente relacionado, se houver — texto livre' },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        prazo: { type: Type.STRING, description: 'Data limite, formato AAAA-MM-DD' },
        coluna: { type: Type.STRING, description: 'Nome da coluna do quadro a usar; se não informar, usa a primeira' },
        orcamentoId: { type: Type.STRING, description: 'Id do orçamento relacionado (de buscar_orcamentos), se houver' },
        pedidoId: { type: Type.STRING, description: 'Id do pedido relacionado (de buscar_pedidos), se houver' },
      },
      required: ['titulo'],
    },
  },
  {
    name: 'propor_orcamento',
    description:
      'Monta uma prévia de orçamento novo — NÃO grava nada. Antes, tenha confirmado com a pessoa: cliente, itens (productId real de buscar_produtos) e quantidades, se é nacional ou internacional e, se internacional, moeda, idioma e (em USD) preço final ou distribuidor. Pergunte também, por item, se usa a descrição e os componentes padrão do produto. Se a ferramenta devolver "erro", pergunte o que falta.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ...quoteFieldsProps,
        padraoDescricaoComponentesAutorizado: {
          type: Type.BOOLEAN,
          description:
            'true só se a pessoa respondeu que SIM, quer a descrição padrão e os componentes padrão dos produtos (a pergunta é obrigatória — a ferramenta recusa sem isso ou sem description/components preenchidos).',
        },
      },
      required: ['clientName', 'items'],
    },
  },
  {
    name: 'propor_edicao_orcamento',
    description:
      'Monta uma prévia de edição de um orçamento existente — NÃO grava nada. Substitui o orçamento inteiro: pegue os dados atuais com buscar_orcamentos e mande todos os campos e itens, só com as mudanças pedidas aplicadas.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        orcamentoId: { type: Type.STRING },
        ...quoteFieldsProps,
        items: { type: Type.ARRAY, items: editItemSchema },
        confirmCompletedOrders: { type: Type.BOOLEAN, description: 'true só depois de avisar a pessoa que existe pedido concluído vinculado e ela autorizar' },
      },
      required: ['orcamentoId', 'clientName', 'items'],
    },
  },
  {
    name: 'propor_pedido',
    description:
      'Monta uma prévia de pedido novo a partir de um orçamento (quoteId de buscar_orcamentos) — NÃO grava nada. orderedByEmail/billToText/shipToText vêm do cadastro do cliente vinculado quando existirem; só informe se faltarem ou a pessoa pedir outro valor. Todo o resto você PERGUNTA numa mensagem só (caixas, pagamento, pesos, incoterms ou forma de envio, AWB, pedido de compra, data de expedição, Kg/Un, NF e data da NF, e o que vai em cada caixa); pessoaAutorizouPadrao=true só se a pessoa disser explicitamente que pode deixar em branco/usar o padrão. A taxa do PayPal é exceção: pergunte numa mensagem separada, depois de ela dizer que o pagamento é PayPal.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        quoteId: { type: Type.STRING },
        orderedByEmail: { type: Type.STRING },
        billToText: { type: Type.STRING, description: 'Endereço de cobrança completo' },
        shipToText: { type: Type.STRING, description: 'Endereço de entrega completo' },
        packageCount: { type: Type.NUMBER, description: 'Número de caixas' },
        prepaymentBy: { type: Type.STRING, enum: ['PAYPAL', 'WIRE_TRANSFER', 'PIX'] },
        paypalFee: { type: Type.NUMBER, description: 'Taxa do PayPal. Só quando o pagamento é PayPal, e perguntada numa mensagem separada' },
        incoterms: { type: Type.STRING, description: 'Só internacional, ex. EXW, DAP, DDP' },
        shippingMethod: { type: Type.STRING, description: 'Só nacional, ex. SEDEX, PAC, transportadora' },
        netWeightKg: { type: Type.NUMBER },
        grossWeightKg: { type: Type.NUMBER },
        awbNumber: { type: Type.STRING, description: 'AWB do envio' },
        purchaseOrder: { type: Type.STRING, description: 'Pedido de compra do cliente' },
        shipDate: { type: Type.STRING, description: 'Data de expedição, formato AAAA-MM-DD' },
        nfNumber: { type: Type.STRING, description: 'Número da nota fiscal' },
        nfDate: { type: Type.STRING, description: 'Data da nota fiscal, formato AAAA-MM-DD' },
        ...orderItemProps,
        pessoaAutorizouPadrao: { type: Type.BOOLEAN, description: 'true só se a pessoa autorizou explicitamente usar padrão/deixar em branco o que falta (nunca vale pra taxa do PayPal)' },
      },
      required: ['quoteId'],
    },
  },
  {
    name: 'propor_edicao_pedido',
    description: 'Monta uma prévia de edição de um pedido existente (pedidoId de buscar_pedidos) — NÃO grava nada. Mande só os campos que mudam.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pedidoId: { type: Type.STRING },
        packageCount: { type: Type.NUMBER },
        prepaymentBy: { type: Type.STRING, enum: ['PAYPAL', 'WIRE_TRANSFER', 'PIX'] },
        paypalFee: { type: Type.NUMBER },
        incoterms: { type: Type.STRING },
        shippingMethod: { type: Type.STRING },
        netWeightKg: { type: Type.NUMBER },
        grossWeightKg: { type: Type.NUMBER },
        awbNumber: { type: Type.STRING },
        purchaseOrder: { type: Type.STRING },
        shipDate: { type: Type.STRING, description: 'AAAA-MM-DD' },
        nfNumber: { type: Type.STRING },
        nfDate: { type: Type.STRING, description: 'AAAA-MM-DD' },
        ...orderItemProps,
        billToText: { type: Type.STRING },
        shipToText: { type: Type.STRING },
        orderedByEmail: { type: Type.STRING },
      },
      required: ['pedidoId'],
    },
  },
  {
    name: 'propor_cliente',
    description:
      'Monta uma prévia de cadastro de um cliente novo — NÃO grava nada. Só o nome é obrigatório; o resto é o que a pessoa foi contando na conversa (ver o passo 1 do processo comercial) — não invente endereço, e-mail ou telefone que ninguém disse.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        kind: { type: Type.STRING, enum: ['INDIVIDUAL', 'INSTITUTION', 'DISTRIBUTOR'] },
        institution: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        country: { type: Type.STRING },
        billToText: { type: Type.STRING, description: 'Endereço de cobrança completo' },
        shipToText: { type: Type.STRING, description: 'Endereço de entrega completo' },
        sectors: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Setores/áreas de interesse do cliente' },
        inService: { type: Type.BOOLEAN, description: 'Cliente "em atendimento" (negociação ativa agora)' },
        notes: { type: Type.STRING },
      },
      required: ['name'],
    },
  },
  {
    name: 'propor_edicao_cliente',
    description:
      'Monta uma prévia de edição de um cliente existente (clienteId de buscar_cliente) — NÃO grava nada. Mande só os campos que mudam. notes SUBSTITUI a observação inteira: pra acrescentar algo, mande a observação atual + o texto novo.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        clienteId: { type: Type.STRING },
        name: { type: Type.STRING },
        institution: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        country: { type: Type.STRING },
        billToText: { type: Type.STRING, description: 'Endereço de cobrança completo' },
        shipToText: { type: Type.STRING, description: 'Endereço de entrega completo' },
        inService: { type: Type.BOOLEAN, description: 'Cliente "em atendimento"' },
        notes: { type: Type.STRING },
      },
      required: ['clienteId'],
    },
  },
  {
    name: 'propor_registro_biblioteca',
    description:
      'Monta uma prévia de pergunta nova na Biblioteca — NÃO grava nada. Use quando a pessoa pedir pra anotar/cadastrar/guardar na biblioteca uma resposta que ela já confirmou. Pergunta e resposta com as palavras dela (pode corrigir ortografia), nunca complete a resposta com conhecimento seu. Pelo menos um tópico: productId(s) de buscar_produtos e/ou clienteId(s) de buscar_cliente — se ela não disse de qual produto ou cliente é, pergunte.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pergunta: { type: Type.STRING },
        resposta: { type: Type.STRING },
        produtoIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        clienteIds: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['pergunta', 'resposta'],
    },
  },
]

function toolArgs<T>(args: Record<string, unknown>) {
  return args as unknown as T
}

// `args` chega como JSON dinâmico vindo do Gemini. As ferramentas continuam
// sendo a fronteira de validação Zod; aqui os tipos são derivados das próprias
// assinaturas para o dispatcher não criar uma segunda definição de payload.
async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  lastUserText: string,
): Promise<{ result: unknown; pendingAction?: Awaited<ReturnType<typeof proporOrcamento>>['pendingAction'] }> {
  switch (name) {
    case 'buscar_produtos':
      return { result: await buscarProdutos(toolArgs<Parameters<typeof buscarProdutos>[0]>(args)) }
    case 'listar_clientes':
      return { result: await listarClientes(toolArgs<Parameters<typeof listarClientes>[0]>(args)) }
    case 'buscar_cliente':
      return { result: await buscarCliente(toolArgs<Parameters<typeof buscarCliente>[0]>(args)) }
    case 'listar_setores':
      return { result: await listarSetores() }
    case 'buscar_orcamentos':
      return { result: await buscarOrcamentos(toolArgs<Parameters<typeof buscarOrcamentos>[0]>(args)) }
    case 'buscar_pedidos':
      return { result: await buscarPedidos(toolArgs<Parameters<typeof buscarPedidos>[0]>(args)) }
    case 'verificar_pendencias':
      return { result: await verificarPendencias() }
    case 'buscar_biblioteca':
      return { result: await buscarBiblioteca(toolArgs<Parameters<typeof buscarBiblioteca>[0]>(args)) }
    case 'propor_registro_biblioteca': {
      const { pendingAction, summaryForModel } = await proporRegistroBiblioteca(
        toolArgs<Parameters<typeof proporRegistroBiblioteca>[0]>(args),
        userId,
      )
      return { result: summaryForModel, pendingAction }
    }
    case 'criar_tarefa':
      return { result: await criarTarefa(toolArgs<Parameters<typeof criarTarefa>[0]>(args), userId) }
    case 'propor_orcamento': {
      const { pendingAction, summaryForModel } = await proporOrcamento(toolArgs<Parameters<typeof proporOrcamento>[0]>(args), userId, lastUserText)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_edicao_orcamento': {
      const { pendingAction, summaryForModel } = await proporEdicaoOrcamento(toolArgs<Parameters<typeof proporEdicaoOrcamento>[0]>(args), userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_pedido': {
      const { pendingAction, summaryForModel } = await proporPedido(toolArgs<Parameters<typeof proporPedido>[0]>(args), userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_edicao_pedido': {
      const { pendingAction, summaryForModel } = await proporEdicaoPedido(toolArgs<Parameters<typeof proporEdicaoPedido>[0]>(args), userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_cliente': {
      const { pendingAction, summaryForModel } = await proporCliente(toolArgs<Parameters<typeof proporCliente>[0]>(args), userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_edicao_cliente': {
      const { pendingAction, summaryForModel } = await proporEdicaoCliente(toolArgs<Parameters<typeof proporEdicaoCliente>[0]>(args), userId)
      return { result: summaryForModel, pendingAction }
    }
    default:
      throw new HttpError(500, `Ferramenta desconhecida: ${name}`)
  }
}

neoRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const requestStartedAt = Date.now()
    const message = String(req.body?.message ?? '').trim()
    if (!message) throw new HttpError(400, 'Mensagem vazia')
    const historyIn = recentHistory(Array.isArray(req.body?.history) ? req.body.history : [])

    const contents: Content[] = [
      ...historyIn.map((h: { role: string; text: string }) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: message }] },
    ]

    let pendingAction: ReturnType<typeof toPublicPendingAction> | undefined
    // Começa no modelo preferido; se algum call cair num fallback, as
    // próximas iterações desta mesma conversa já começam por ele — sem
    // isso, cada iteração pagaria de novo o custo de esgotar as tentativas
    // do modelo principal antes de cair pro alternativo.
    let currentModel = env.GEMINI_MODEL

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const { response, modelUsed } = await generateNeoContent(currentModel, {
        contents,
        config: {
          systemInstruction: buildNeoSystemInstruction(),
          tools: [{ functionDeclarations: [...readTools, ...writeTools] }],
          thinkingConfig: THINKING_CONFIG,
        },
      })
      currentModel = modelUsed

      const calls = response.functionCalls ?? []
      if (calls.length === 0) {
        console.info(`[neo] pedido concluído em ${Date.now() - requestStartedAt}ms (${iteration + 1} chamada(s) ao Gemini)`)
        res.json({ reply: redactInternalIds(response.text ?? ''), pendingAction })
        return
      }

      // Reaproveita o `content` que o próprio Gemini devolveu (em vez de
      // reconstruir só com `functionCall`), porque modelos 3.x anexam um
      // `thoughtSignature` por parte — descartá-lo quebra a continuidade do
      // raciocínio nas próximas iterações do loop de tool calling.
      contents.push(response.candidates?.[0]?.content ?? { role: 'model', parts: calls.map((c) => ({ functionCall: c })) })

      const responseParts = []
      for (const call of calls) {
        if (!IS_PRODUCTION) console.info(`[neo] ${call.name}`, JSON.stringify(call.args ?? {}))
        const toolStartedAt = Date.now()
        let result: unknown
        try {
          const dispatched = await dispatchTool(call.name!, call.args ?? {}, req.user!.id, message)
          console.info(`[neo] ${call.name} levou ${Date.now() - toolStartedAt}ms`)
          result = dispatched.result
          if (dispatched.pendingAction) pendingAction = toPublicPendingAction(dispatched.pendingAction)
        } catch (err) {
          const forModel = toolErrorForModel(err)
          if (!forModel) throw err
          result = forModel
        }
        responseParts.push({ functionResponse: { name: call.name!, response: { result } } })
      }
      contents.push({ role: 'user', parts: responseParts })
    }

    // Estourou o teto de ferramentas: em vez de devolver erro (o que joga fora
    // tudo que já foi apurado), pede uma resposta final sem ferramentas — o
    // modelo conclui com o que tem, ou pergunta.
    const { response: finalResponse } = await generateNeoContent(currentModel, {
      contents: [
        ...contents,
        { role: 'user', parts: [{ text: 'Responda agora em texto, sem chamar mais ferramentas, com o que você já apurou. Se ainda falta informação, pergunte.' }] },
      ],
      config: { systemInstruction: buildNeoSystemInstruction(), thinkingConfig: THINKING_CONFIG },
    })
    console.info(`[neo] pedido concluído em ${Date.now() - requestStartedAt}ms (estourou o teto de ${MAX_TOOL_ITERATIONS} chamadas de ferramenta)`)
    res.json({ reply: redactInternalIds(finalResponse.text ?? ''), pendingAction })
  }),
)

neoRouter.post(
  '/voz',
  audioUpload.single('audio'),
  asyncHandler(async (req, res) => {
    if (!env.GROQ_API_KEY) throw new HttpError(503, 'Ditado por voz não está configurado neste servidor.')
    if (!req.file) throw new HttpError(400, 'Nenhum áudio enviado.')

    const extension = AUDIO_EXTENSION[req.file.mimetype] ?? 'webm'
    const form = new FormData()
    // Uint8Array(buffer) copia pra um ArrayBuffer normal — o Buffer do multer
    // é ArrayBufferLike (podendo ser SharedArrayBuffer), e o Blob global exige
    // o tipo mais estrito.
    form.append('file', new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }), `ditado.${extension}`)
    form.append('model', 'whisper-large-v3-turbo')
    form.append('language', 'pt')
    form.append('response_format', 'json')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[neo] falha ao transcrever com Groq:', response.status, detail)
      if (response.status === 429) {
        throw new HttpError(503, 'O reconhecimento de voz atingiu o limite de uso por agora. Tenta de novo em instantes.')
      }
      throw new HttpError(502, 'Não deu para transcrever o áudio agora. Tenta de novo.')
    }

    const data = (await response.json()) as { text?: string }
    res.json({ text: (data.text ?? '').trim() })
  }),
)

neoRouter.post(
  '/actions/:id/confirm',
  asyncHandler(async (req, res) => {
    const action = getPendingAction(req.params.id, req.user!.id)
    if (!action) throw new HttpError(404, 'Essa ação expirou ou não existe mais. Peça pro NEO montar de novo.')

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
      case 'cliente_criar': {
        const client = await createClientRecord(action.payload as never, req.user!.id)
        discardPendingAction(action.id)
        res.json({ resource: 'client', client: toClientDTO(client) })
        return
      }
      case 'cliente_editar': {
        const { clienteId, data } = action.payload as { clienteId: string; data: unknown }
        const { client, aggregate } = await updateClientRecord(clienteId, data as never)
        discardPendingAction(action.id)
        res.json({ resource: 'client', client: toClientDTO(client, aggregate) })
        return
      }
      case 'biblioteca_criar': {
        const entry = await createLibraryEntryRecord(action.payload as never, req.user!.id)
        discardPendingAction(action.id)
        res.json({ resource: 'library', entry: toLibraryEntryDTO(entry) })
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
