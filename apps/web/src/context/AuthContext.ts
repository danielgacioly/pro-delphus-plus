/**
 * O contexto de sessão e o hook que o lê.
 *
 * Separados do provider porque um arquivo que exporta componente e
 * não-componente quebra o fast refresh do Vite: cada alteração recarrega a
 * aplicação inteira, e no caso da sessão isso significa perder o estado de
 * quem está logado a cada salvamento.
 */
import { createContext, useContext } from 'react'
import type { UserDTO } from '@prodelphusplus/shared'

interface AuthContextValue {
  user: UserDTO | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: UserDTO) => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
