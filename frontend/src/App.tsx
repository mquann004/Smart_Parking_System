import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Billing from './pages/Billing'
import Dashboard from './pages/Dashboard'
import Gates from './pages/Gates'
import History from './pages/History'
import Vehicles from './pages/Vehicles'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'gates', element: <Gates /> },
      { path: 'vehicles', element: <Vehicles /> },
      { path: 'history', element: <History /> },
      { path: 'billing', element: <Billing /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
