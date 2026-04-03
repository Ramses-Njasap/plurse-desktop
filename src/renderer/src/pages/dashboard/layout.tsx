import Navbar from '@renderer/components/navbar'
import Sidebar from '@renderer/components/sidebar'
import { Outlet } from 'react-router-dom'

const DashboardLayout = () => {
  const preventCopy = (e) => {
    e.preventDefault()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col ml-64">
        {' '}
        {/* Add ml-64 to offset for sidebar width */}
        <Navbar />
        <div className="p-8 pt-20">
          {' '}
          {/* Add pt-20 to offset for navbar height */}
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

export default DashboardLayout
