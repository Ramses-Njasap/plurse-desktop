import { Navigate, Route, MemoryRouter as Router, Routes } from 'react-router-dom'
import ProtectedRoute from './components/protected-route'
import { SalesPage } from './components/public/types/index'
import { AuthProvider } from './contexts/auth.context'
import Attributes from './pages/dashboard/attributes/list'
import CreateEmployeesByAdmin from './pages/dashboard/employees/create-employee'
import Employees from './pages/dashboard/employees/list'
import Transactions from './pages/dashboard/finance/transactions/list'
import DashboardLayout from './pages/dashboard/layout'
import DashboardOverview from './pages/dashboard/overview'
import Customers from './pages/dashboard/people/customers/list'
import Suppliers from './pages/dashboard/people/suppliers/list'
import ProductCategories from './pages/dashboard/products/categories/list'
import Products from './pages/dashboard/products/list'
import StockPurchases from './pages/dashboard/products/stock-purchases/list'
import Profile from './pages/dashboard/profile'
import Sales from './pages/dashboard/sales/list'
import Login from './pages/login'
import Onboarding from './pages/onboarding/onboarding'


const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public route - only accessible when setup is not complete */}
          <Route
            path="/"
            element={
              <ProtectedRoute requireSetupIncomplete>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          {/* Public route - only accessible when setup is complete but not authenticated */}
          <Route
            path="/login"
            element={
              <ProtectedRoute requireSetupComplete>
                <Login />
              </ProtectedRoute>
            }
          />

          <Route
            path="/sales-point"
            element={
              <ProtectedRoute requireAuth requireSetupComplete>
                <SalesPage />
              </ProtectedRoute>
            }
          />

          {/* Protected dashboard routes - require authentication */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireAuth requireSetupComplete>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="overview" element={<DashboardOverview />} />
            <Route path="profile" element={<Profile />} />

            <Route
              path="employees"
              element={
                <ProtectedRoute requireAuth roles={['admin', 'manager']}>
                  <Employees />
                </ProtectedRoute>
              }
            />

            <Route
              path="employees/create"
              element={
                <ProtectedRoute requireAuth roles={['admin']}>
                  <CreateEmployeesByAdmin />
                </ProtectedRoute>
              }
            />

            <Route
              path="attributes"
              element={
                <ProtectedRoute requireAuth roles={['admin', 'manager']}>
                  <Attributes />
                </ProtectedRoute>
              }
            />

            <Route
              path="products"
              element={
                <ProtectedRoute requireAuth roles={['admin', 'manager']}>
                  <Products />
                </ProtectedRoute>
              }
            />

            <Route
              path="products/categories"
              element={
                <ProtectedRoute requireAuth roles={['admin', 'manager']}>
                  <ProductCategories />
                </ProtectedRoute>
              }
            />

            <Route
              path="products/stock-purchases"
              element={
                <ProtectedRoute requireAuth roles={['admin', 'manager']}>
                  <StockPurchases />
                </ProtectedRoute>
              }
            />

            <Route
              path="people/suppliers"
              element={
                <ProtectedRoute requireAuth roles={['admin', 'manager']}>
                  <Suppliers />
                </ProtectedRoute>
              }
            />

            <Route
              path="people/customers"
              element={
                <ProtectedRoute requireAuth roles={['admin', 'manager']}>
                  <Customers />
                </ProtectedRoute>
              }
            />

            {/* Example of role-based routes */}
            <Route
              path="admin-only"
              element={
                <ProtectedRoute requireAuth roles={['admin']}>
                  <div>Admin Only Page</div>
                </ProtectedRoute>
              }
            />

            <Route
              path="manager-only"
              element={
                <ProtectedRoute requireAuth roles={['admin', 'manager']}>
                  <div>Manager Only Page</div>
                </ProtectedRoute>
              }
            />

            <Route
              path="finance/transactions"
              element={
                <ProtectedRoute requireAuth roles={['admin', 'manager']}>
                  <Transactions />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales"
              element={
                <ProtectedRoute requireAuth roles={['admin', 'manager']}>
                  <Sales />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
