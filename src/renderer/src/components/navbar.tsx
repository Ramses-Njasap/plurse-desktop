import { ChevronDown, LogOut, User } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const Navbar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Mock user name (replace with actual user data from auth context or API)
  const userName = '?'
  const getAcronym = (name) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Determine button text and target based on route
  const isOnSalesPoint = location.pathname === '/sales-point'
  const buttonText = isOnSalesPoint ? 'To Dashboard' : 'To Sales Point'
  const buttonTarget = isOnSalesPoint ? '/dashboard/inventory' : '/sales-point'
  const buttonBg = isOnSalesPoint
    ? 'bg-gray-600 hover:bg-gray-700'
    : 'bg-blue-600 hover:bg-blue-700'

  const preventCopy = (e) => {
    e.preventDefault()
  }

  const handleLogout = () => {
    navigate('/login')
  }

  return (
    <div
      className="bg-white/90 backdrop-blur-sm border-b border-gray-100 px-8 py-4 flex justify-end items-center select-none fixed top-0 left-64 right-0 z-30"
      onCopy={preventCopy}
    >
      <div className="flex items-center gap-4">
        {/* Context-Aware Button */}
        <Link
          to={buttonTarget}
          className={`inline-flex items-center px-4 py-2 text-white rounded-md ${buttonBg} transition-colors text-sm font-medium`}
        >
          {buttonText}
        </Link>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 p-2 bg-blue-600/10 rounded-full hover:bg-blue-600/20 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
              {getAcronym(userName)}
            </div>
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </button>
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 z-10">
              <Link
                to="/dashboard/profile"
                className="flex items-center gap-2 px-4 py-2 text-gray-800 hover:bg-blue-50 transition-colors text-sm"
                onClick={() => setIsDropdownOpen(false)}
              >
                <User className="w-4 h-4" />
                View Profile
              </Link>
              <button
                onClick={() => {
                  setIsDropdownOpen(false)
                  handleLogout()
                }}
                className="flex items-center gap-2 px-4 py-2 text-gray-800 hover:bg-blue-50 transition-colors text-sm w-full text-left"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Navbar
