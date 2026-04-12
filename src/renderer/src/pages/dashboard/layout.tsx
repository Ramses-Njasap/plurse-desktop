import Navbar from '@renderer/components/navbar'
import Sidebar from '@renderer/components/sidebar'
import { SidebarProvider, useSidebar } from '@renderer/contexts/sidebar.context'
import { Outlet } from 'react-router-dom'

const DashboardContent = () => {
  const { isCollapsed } = useSidebar()

  const preventCopy = (e: React.ClipboardEvent) => e.preventDefault()

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        <Navbar />
        <div className="p-8 pt-20">
          <div className="max-w-7xl mx-auto py-5">
            <div
              className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-100 p-6 select-none"
              onCopy={preventCopy}
            >
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const DashboardLayout = () => (
  <SidebarProvider>
    <DashboardContent />
  </SidebarProvider>
)

export default DashboardLayout