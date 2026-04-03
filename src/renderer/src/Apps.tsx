import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import DashboardLayout from './pages/dashboard/layout'
import DashboardOverview from './pages/dashboard/overview'
// import Users from './pages/dashboard/Users'
// import AddUser from './pages/dashboard/AddUser'
// import Products from './pages/dashboard/Products'
// import AddProduct from './pages/dashboard/AddProduct'
// import Categories from './pages/dashboard/Categories'
// import AddCategory from './pages/dashboard/AddCategory'
// import Customers from './pages/dashboard/Customers'
// import AddCustomer from './pages/dashboard/AddCustomer'
// import Sales from './pages/dashboard/Sales'
// import Cashflow from './pages/dashboard/Cashflow'
// import AddCashflow from './pages/dashboard/AddCashflow'
// import ActivityLog from './pages/dashboard/ActivityLog'
// import Projects from './pages/dashboard/Projects'
// import AddProject from './pages/dashboard/AddProject'
// import MoneyTransfer from './pages/dashboard/MoneyTransfer'
// import Reports from './pages/dashboard/Reports'
// import GenerateReport from './pages/dashboard/GenerateReport'
// import Settings from './pages/dashboard/Settings'
// import Badges from './pages/dashboard/Badges'
// import CreateBadge from './pages/dashboard/CreateBadge'
// import Analytics from './pages/dashboard/Analytics'
// import Marketing from './pages/dashboard/Marketing'
// import CreateCampaign from './pages/dashboard/CreateCampaign'
import Profile from './pages/dashboard/profile'
import Login from './pages/login'
import Onboarding from './pages/onboarding/onboarding'

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Onboarding />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard/inventories" replace />} />
          <Route path="overview" element={<DashboardOverview />} />
          {/* <Route path="users" element={<Users />} />
          <Route path="users/add" element={<AddUser />} />
          <Route path="products" element={<Products />} />
          <Route path="products/add" element={<AddProduct />} />
          <Route path="products/categories" element={<Categories />} />
          <Route path="products/categories/add" element={<AddCategory />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/add" element={<AddCustomer />} />
          <Route path="sales" element={<Sales />} />
          <Route path="cashflow" element={<Cashflow />} />
          <Route path="cashflow/add" element={<AddCashflow />} />
          <Route path="activity-log" element={<ActivityLog />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/add" element={<AddProject />} />
          <Route path="money-transfer" element={<MoneyTransfer />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/generate" element={<GenerateReport />} />
          <Route path="settings" element={<Settings />} />
          <Route path="tools/badges" element={<Badges />} />
          <Route path="tools/badges/create" element={<CreateBadge />} />
          <Route path="tools/analytics" element={<Analytics />} />
          <Route path="tools/marketing" element={<Marketing />} />
          <Route path="tools/marketing/create" element={<CreateCampaign />} /> */}
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
