import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { BackLink, Button, Card, Field, Input, Page } from '../../components/ui'

export function NewSector() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [namePt, setNamePt] = useState('')
  const [error, setError] = useState<string | null>(null)

  const createSector = useMutation({
    mutationFn: async () => api.post('/sectors', { name: name.trim(), namePt: namePt.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors'] })
      queryClient.invalidateQueries({ queryKey: ['product-sectors'] })
      navigate('/admin/setores')
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Não foi possível criar o setor.'
      setError(message)
    },
  })

  return (
    <Page
      title="Novo setor"
      description="O nome precisa ser único — não pode repetir um setor já existente."
      width="narrow"
    >
      <div className="-mt-4 mb-5">
        <BackLink to="/admin/setores">Setores</BackLink>
      </div>

      <Card className="max-w-md p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createSector.mutate()
          }}
          className="space-y-4"
        >
          {error && <div className="rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">{error}</div>}

          <Field label="Nome do setor (inglês)">
            <Input autoFocus required placeholder="ex: Spine" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="Nome em português (opcional)">
            <Input placeholder="ex: Coluna" value={namePt} onChange={(e) => setNamePt(e.target.value)} />
          </Field>

          <Button type="submit" variant="primary" size="lg" disabled={createSector.isPending} className="w-full">
            {createSector.isPending ? 'Criando…' : 'Criar setor'}
          </Button>
        </form>
      </Card>
    </Page>
  )
}
