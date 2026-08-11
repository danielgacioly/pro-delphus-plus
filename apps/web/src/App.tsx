import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Home } from './pages/Home'
import { Account } from './pages/Account'
import { MyDesk } from './pages/MyDesk'
import { PriceTable } from './pages/PriceTable'
import { Products } from './pages/Products'
import { NewProduct } from './pages/NewProduct'
import { Clients } from './pages/Clients'
import { ClientDetail } from './pages/ClientDetail'
import { Quotes } from './pages/Quotes'
import { NewQuote } from './pages/NewQuote'
import { Orders } from './pages/Orders'
import { NewOrder } from './pages/NewOrder'
import { OrderDetail } from './pages/OrderDetail'
import { Stats } from './pages/Stats'
import { AdminUsers } from './pages/admin/Users'
import { AdminSectors } from './pages/admin/Sectors'
import { NewSector } from './pages/admin/NewSector'

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
          <Route path="/clientes" element={<Clients />} />
          <Route path="/clientes/:id" element={<ClientDetail />} />
          <Route path="/orcamentos" element={<Quotes />} />
          <Route path="/orcamentos/novo" element={<NewQuote />} />
          <Route path="/orcamentos/:id/editar" element={<NewQuote />} />
          <Route path="/pedidos" element={<Orders />} />
          <Route path="/pedidos/novo" element={<NewOrder />} />
          <Route path="/pedidos/:id" element={<OrderDetail />} />
          <Route path="/minha-conta" element={<Account />} />
          <Route path="/minha-pro-delphus" element={<MyDesk />} />

          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/produtos/novo" element={<NewProduct />} />
            <Route path="/admin/contas" element={<AdminUsers />} />
            <Route path="/admin/setores" element={<AdminSectors />} />
            <Route path="/admin/setores/novo" element={<NewSector />} />
            <Route path="/admin/metricas" element={<Stats />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App
