import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

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
    <div>
      <Link to="/admin/setores" className="text-sm font-medium text-brand-600 hover:underline">
        ← Voltar para setores
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-ink-900">Novo setor</h1>
      <p className="mt-1 text-neutral-500">O nome precisa ser único — não pode repetir um setor já existente.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          createSector.mutate()
        }}
        className="animate-fade-in-up mt-4 max-w-md rounded-xl border border-neutral-200 bg-white p-5"
      >
        {error && <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</div>}

        <label className="mb-1 block text-xs font-medium text-neutral-600">Nome do setor (inglês)</label>
        <input
          autoFocus
          required
          placeholder="ex: Spine"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-shadow focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />

        <label className="mb-1 mt-3 block text-xs font-medium text-neutral-600">Nome em português (opcional)</label>
        <input
          placeholder="ex: Coluna"
          value={namePt}
          onChange={(e) => setNamePt(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-shadow focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />

        <button
          type="submit"
          disabled={createSector.isPending}
          className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
        >
          {createSector.isPending ? 'Criando…' : 'Criar setor'}
        </button>
      </form>
    </div>
  )
}
