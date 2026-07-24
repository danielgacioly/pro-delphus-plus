import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPasswordWithToken } from './pages/ResetPasswordWithToken'
import { Home } from './pages/Home'
import { PriceTable } from './pages/PriceTable'
import { Products } from './pages/Products'
import { NewProduct } from './pages/NewProduct'
import { Quotes } from './pages/Quotes'
import { NewQuote } from './pages/NewQuote'
import { Orders } from './pages/Orders'
import { NewOrder } from './pages/NewOrder'
import { OrderDetail } from './pages/OrderDetail'
import { Stats } from './pages/Stats'
import { AdminUsers } from './pages/admin/Users'
import { AdminSectors } from './pages/admin/Sectors'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Register />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPasswordWithToken />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/precos" element={<PriceTable />} />
          <Route path="/produtos" element={<Products />} />
          <Route path="/orcamentos" element={<Quotes />} />
          <Route path="/orcamentos/novo" element={<NewQuote />} />
          <Route path="/pedidos" element={<Orders />} />
          <Route path="/pedidos/novo" element={<NewOrder />} />
          <Route path="/pedidos/:id" element={<OrderDetail />} />
          <Route path="/minha-conta" element={<Navigate to="/" replace />} />

          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/produtos/novo" element={<NewProduct />} />
            <Route path="/admin/contas" element={<AdminUsers />} />
            <Route path="/admin/setores" element={<AdminSectors />} />
            <Route path="/admin/metricas" element={<Stats />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App
