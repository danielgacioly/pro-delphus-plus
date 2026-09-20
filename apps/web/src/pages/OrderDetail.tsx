import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatAmount, formatOrderNumber, type OrderDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { DropZone } from '../components/DropZone'
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal'
import {
  Alert,
  Button,
  buttonClasses,
  Card,
  Page,
  Section,
  Skeleton,
  TBody,
  THead,
  Table,
  TableShell,
  Td,
  Th,
  Tr,
} from '../components/ui'
import { IconDownload, IconPencil, IconQuote, IconTrash } from '../components/icons'

async function fetchOrder(id: string) {
  const { data } = await api.get<{ order: OrderDTO }>(`/orders/${id}`)
  return data.order
}

function ReadField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[12px] font-medium text-neutral-600">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-900">
        {value?.trim() ? value : '—'}
      </dd>
    </div>
  )
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

function DocLink({ href, children, tone = 'brand' }: { href: string; children: ReactNode; tone?: 'brand' | 'ink' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      // Documento é arquivo, não ação principal: botão secundário com o
      // glifo colorido pelo tipo (vermelho PDF, verde planilha), como no Finder.
      className={buttonClasses()}
    >
      <IconQuote className={`h-3.5 w-3.5 ${tone === 'brand' ? 'text-brand-600' : 'text-emerald-600'}`} />
      {children}
    </a>
  )
}

function ManualUpload({
  title,
  url,
  onFile,
  isPending,
}: {
  title: string
  url: string | null | undefined
  onFile: (file: File) => void
  isPending: boolean
}) {
  return (
    <div className="border-t border-neutral-200/70 pt-4">
      <h3 className="text-eyebrow mb-2 text-neutral-600">{title}</h3>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] font-medium text-brand-600 hover:underline"
        >
          Ver arquivo enviado
        </a>
      ) : (
        <p className="text-[13px] text-neutral-500">Nenhum arquivo enviado.</p>
      )}
      <DropZone
        className="mt-2.5 py-3"
        disabled={isPending}
        onFiles={(files) => {
          const file = files[0]
          if (file) onFile(file)
        }}
      >
        <p className="text-[12.5px] text-neutral-600">
          Arraste o arquivo ou <span className="font-medium text-brand-600">clique para selecionar</span>
        </p>
      </DropZone>
    </div>
  )
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const toast = useToast()

  const {
    data: order,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
  })

  const [deleting, setDeleting] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  }

  const uploadAwb = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/orders/${id}/awb-document`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      invalidate()
      toast.success('AWB enviado.')
    },
  })

  const uploadBoleto = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/orders/${id}/boleto-document`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      invalidate()
      toast.success('Boleto enviado.')
    },
  })

  const uploadNf = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/orders/${id}/nf-document`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      invalidate()
      toast.success('Nota fiscal enviada.')
    },
  })

  const deleteOrder = useMutation({
    mutationFn: async () => api.delete(`/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Pedido excluído.')
      navigate('/pedidos')
    },
  })

  async function downloadAllDocuments() {
    if (!order) return
    setDownloadingAll(true)
    try {
      // Disparar um <a download> por arquivo em sequência esbarrava no
      // bloqueio do navegador para downloads automáticos consecutivos sem
      // gesto do usuário a cada um — só o primeiro saía, o resto sumia sem
      // erro. O servidor agora empacota tudo num único .zip.
      const { data } = await api.get<Blob>(`/orders/${order.id}/documents.zip`, { responseType: 'blob' })
      triggerBlobDownload(data, `Order-${formatOrderNumber(order.orderNumber)}-Documents.zip`)
    } catch {
      toast.error('Não foi possível baixar os documentos.')
    } finally {
      setDownloadingAll(false)
    }
  }

  if (isLoading) {
    return (
      <Page title="Pedido">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </Page>
    )
  }

  if (isError || !order) {
    return (
      <Page title="Pedido">
        <Alert tone="error">Não foi possível carregar este pedido.</Alert>
      </Page>
    )
  }

  const currency = order.quote.currency
  // Venda nacional não sai do Brasil — sem câmbio, Incoterms nem AWB (via de
  // envio entra no lugar). Ver a mesma regra em apps/api/src/routes/orders.routes.ts.
  const isNational = order.quote.exportScope === 'NATIONAL'
  // Mesma conta do Invoice gerado (subtotal + frete - desconto + taxa do
  // PayPal quando é a forma de pagamento) — "Total do orçamento" nunca inclui
  // a taxa, porque ela é um dado do pedido, não do orçamento em si. Sem este
  // campo, trocar pra PayPal e salvar parecia não fazer efeito nenhum na tela,
  // já que o único total visível ficava igual — a taxa só aparecia no PDF.
  const invoiceTotal =
    Number(order.quote.subtotal) +
    Number(order.quote.freight ?? 0) -
    Number(order.quote.discount) +
    (order.prepaymentBy === 'PAYPAL' ? Number(order.paypalFee ?? 0) : 0)

  return (
    <Page
      back={{ to: '/pedidos', label: 'Pedidos' }}
      title={`Pedido #${formatOrderNumber(order.orderNumber)}`}
      description={`A partir do orçamento ${order.quoteNumber} — ${order.quote.clientName}`}
    >

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-heading text-ink-900">Documentos</h2>

          {order.documentsStale && (
            <div className="mt-4">
              <Alert
                tone="warning"
                action={
                  <Link
                    to={`/pedidos/${order.id}/editar`}
                    className="text-[13px] font-medium underline underline-offset-2"
                  >
                    Editar pedido
                  </Link>
                }
              >
                O orçamento vinculado foi editado depois da última geração destes documentos — os arquivos abaixo podem
                estar desatualizados.
              </Alert>
            </div>
          )}

          {/* Baixar tudo fecha a própria lista que ele empacota, em vez de
              flutuar no cabeçalho longe dos arquivos. */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {order.invoicePdfUrl && <DocLink href={order.invoicePdfUrl}>Invoice</DocLink>}
            {order.packingListPdfUrl && <DocLink href={order.packingListPdfUrl}>Packing List</DocLink>}
            {order.packingListBoxPdfUrl && <DocLink href={order.packingListBoxPdfUrl}>Packing List Box</DocLink>}
            {order.exportDocXlsxUrl && (
              <DocLink href={order.exportDocXlsxUrl} tone="ink">
                Doc. de Exportação
              </DocLink>
            )}
            {(order.invoicePdfUrl || order.packingListPdfUrl || order.packingListBoxPdfUrl || order.exportDocXlsxUrl) && (
              <Button
                size="md"
                variant="ghost"
                disabled={downloadingAll}
                onClick={downloadAllDocuments}
                className="text-neutral-600 hover:text-ink-900"
              >
                <IconDownload className="h-3.5 w-3.5" />
                {downloadingAll ? 'Baixando…' : 'Baixar tudo'}
              </Button>
            )}
          </div>

          <div className="mt-5 space-y-4">
            {isNational ? (
              <ManualUpload
                title="Boleto (manual)"
                url={order.boletoDocumentUrl}
                isPending={uploadBoleto.isPending}
                onFile={(file) => uploadBoleto.mutate(file)}
              />
            ) : (
              <ManualUpload
                title="AWB (manual)"
                url={order.awbDocumentUrl}
                isPending={uploadAwb.isPending}
                onFile={(file) => uploadAwb.mutate(file)}
              />
            )}
            <ManualUpload
              title="Nota Fiscal (manual)"
              url={order.nfDocumentUrl}
              isPending={uploadNf.isPending}
              onFile={(file) => uploadNf.mutate(file)}
            />
          </div>
        </Card>

        <Card className="p-5">
          {/* As ações moram no card que representa o pedido, não soltas no
              canto da página — lápis e lixeira lado a lado, como nas linhas de
              Orçamentos e Produtos. Editar abre a mesma tela de criar pedido. */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-heading text-ink-900">Dados do pedido</h2>
            <div className="flex items-center gap-1">
              <Link
                to={`/pedidos/${order.id}/editar`}
                title="Editar pedido"
                aria-label="Editar pedido"
                className={buttonClasses({
                  variant: 'ghost',
                  size: 'sm',
                  className: 'px-2 text-neutral-600 hover:text-ink-900',
                })}
              >
                <IconPencil className="h-3.5 w-3.5" />
              </Link>
              {user?.role === 'ADMIN' && (
                <Button
                  size="sm"
                  variant="ghost"
                  title="Excluir pedido"
                  aria-label="Excluir pedido"
                  onClick={() => setDeleting(true)}
                  className="px-2 text-neutral-600 hover:bg-brand-50 hover:text-brand-600"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
            <ReadField label="Pedido de compra" value={order.purchaseOrder ?? order.quoteNumber} />
            <ReadField label="E-mail do comprador" value={order.orderedByEmail} />
            <ReadField
              label="Data de expedição"
              value={order.shipDate ? new Date(order.shipDate).toLocaleDateString('pt-BR') : null}
            />
            <ReadField label="Data do invoice" value={new Date(order.invoiceDate).toLocaleDateString('pt-BR')} />
            <ReadField label="Nº de pacotes" value={order.numberOfPackages} />
            <ReadField label="Peso líquido" value={order.netWeightKg ? `${order.netWeightKg} KG` : null} />
            <ReadField label="Peso bruto" value={order.grossWeightKg ? `${order.grossWeightKg} KG` : null} />
            {isNational ? (
              <ReadField label="Via de envio" value={order.shippingMethod} />
            ) : (
              <>
                <ReadField label="Incoterms" value={order.incoterms} />
                <ReadField label="AWB #" value={order.awbNumber} />
              </>
            )}
            <ReadField
              label="Forma de pagamento"
              value={
                order.prepaymentBy === 'PAYPAL'
                  ? `PayPal (taxa ${currency} ${formatAmount(order.paypalFee ?? 0)})`
                  : order.prepaymentBy === 'PIX'
                    ? 'Pix'
                    : 'Transferência bancária'
              }
            />
            <ReadField label="Número da NF" value={order.nfNumber} />
            <ReadField
              label="Emissão da NF"
              value={order.nfDate ? new Date(order.nfDate).toLocaleDateString('pt-BR') : null}
            />
            {!isNational && <ReadField label={`Câmbio ${currency}/BRL`} value={order.exchangeRate} />}
            <ReadField label="Total do orçamento" value={`${currency} ${formatAmount(order.quote.total)}`} />
            <ReadField label="Total do pedido (Invoice)" value={`${currency} ${formatAmount(invoiceTotal)}`} />
          </dl>

          <div className="mt-5 space-y-4 border-t border-neutral-200/70 pt-4">
            <ReadField label="Faturamento (Bill To)" value={order.billToText} />
            <ReadField label="Entrega (Ship To)" value={order.shipToText} />
            {order.shipToNote && <ReadField label="Observação de entrega" value={order.shipToNote} />}
          </div>
        </Card>
      </div>

      <Section title={`Itens do orçamento ${order.quoteNumber}`}>
        <TableShell>
          <Table>
            <THead>
              <tr>
                <Th>Item</Th>
                <Th align="right">Qtd.</Th>
                <Th align="right">Preço unit.</Th>
                <Th align="right">Total</Th>
              </tr>
            </THead>
            <TBody>
              {order.quote.items.map((item, i) => (
                <Tr key={i}>
                  <Td>
                    <p className="font-medium text-ink-900">{item.productName}</p>
                    {item.description && (
                      <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-600">{item.description}</p>
                    )}
                  </Td>
                  <Td className="tabular text-right">{item.quantity}</Td>
                  <Td className="tabular whitespace-nowrap text-right">
                    {/* Só risca o preço de tabela quando o cobrado é um desconto
                        negociado (menor). Um preço customizado maior não é
                        "especial" — é só o preço do item, sem riscado. */}
                    {item.listPrice && item.listPrice > item.unitPrice && (
                      <span className="mr-1.5 text-neutral-500 line-through">
                        {formatAmount(item.listPrice)}
                      </span>
                    )}
                    {currency} {formatAmount(item.unitPrice)}
                  </Td>
                  <Td className="tabular whitespace-nowrap text-right font-semibold text-ink-900">
                    {currency} {formatAmount(item.lineTotal)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableShell>
      </Section>

      {deleting && (
        <ConfirmDeleteModal
          title={`Excluir pedido #${formatOrderNumber(order.orderNumber)}?`}
          description="O pedido e os documentos gerados (Invoice, Packing List, etc.) serão removidos definitivamente. O orçamento de origem não é afetado."
          isPending={deleteOrder.isPending}
          onConfirm={() => deleteOrder.mutate()}
          onCancel={() => setDeleting(false)}
        />
      )}
    </Page>
  )
}
