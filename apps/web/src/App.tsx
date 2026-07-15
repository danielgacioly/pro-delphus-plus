import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Home } from './pages/Home'
import { PriceTable } from './pages/PriceTable'
import { Products } from './pages/Products'
import { Quotes } from './pages/Quotes'
import { Profile } from './pages/Profile'
import { AdminUsers } from './pages/admin/Users'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/precos" element={<PriceTable />} />
          <Route path="/produtos" element={<Products />} />
          <Route path="/orcamentos" element={<Quotes />} />
          <Route path="/minha-conta" element={<Profile />} />

          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin/contas" element={<AdminUsers />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App
