import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Home } from './pages/Home'
import { PriceTable } from './pages/PriceTable'
import { Products } from './pages/Products'
import { NewProduct } from './pages/NewProduct'
import { Quotes } from './pages/Quotes'
import { Orders } from './pages/Orders'
import { NewOrder } from './pages/NewOrder'
import { OrderDetail } from './pages/OrderDetail'
import { Profile } from './pages/Profile'
import { AdminUsers } from './pages/admin/Users'
import { AdminSectors } from './pages/admin/Sectors'

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
          <Route path="/pedidos" element={<Orders />} />
          <Route path="/pedidos/novo" element={<NewOrder />} />
          <Route path="/pedidos/:id" element={<OrderDetail />} />
          <Route path="/minha-conta" element={<Profile />} />

          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/produtos/novo" element={<NewProduct />} />
            <Route path="/admin/contas" element={<AdminUsers />} />
            <Route path="/admin/setores" element={<AdminSectors />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App
