import { useAuth } from '@renderer/contexts/auth.context'
import {
  BadgeCheck,
  BarChart3,
  ChevronRight,
  Cpu,
  LogIn,
  Package,
  TrendingUp,
  Users
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

interface FormData {
  role: string
  username: string
  password: string
}

const Login = () => {
  const [formData, setFormData] = useState<FormData>({
    role: '',
    username: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()
  const { checkAuth } = useAuth()

  // Updated roles to match your ACCOUNT_ROLES
  const roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'staff', label: 'Staff' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'sales_person', label: 'Sales Person' },
    { value: 'viewer', label: 'Viewer' }
  ]

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const isFormValid = () => {
    return formData.role && formData.username && formData.password
  }

  const handleLogin = async () => {
    if (!isFormValid()) return

    try {
      setIsLoading(true)
      setError('')

      // Call the login API
      const result = await window.api.employees.login({
        username: formData.username.trim(),
        password: formData.password,
        role: formData.role
      })

      if (result.success) {
        await checkAuth() // Trigger auth check to update AuthContext
        // Navigate to dashboard on successful login
        navigate('/dashboard/overview')
      } else {
        setError(result.message || 'Login failed. Please check your credentials.')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isFormValid() && !isLoading) {
      handleLogin()
    }
  }

  const preventCopy = (e: React.ClipboardEvent) => {
    e.preventDefault()
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50 p-5">
      {/* Left Side - Business/Technology Graphics */}
      <div
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-900 to-blue-700 p-8 flex-col justify-between relative overflow-hidden select-none"
        onCopy={preventCopy}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-16 left-16 w-56 h-56 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-16 right-16 w-72 h-72 bg-blue-300 rounded-full blur-3xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-white">Plurse</span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-4">Your Business Purse, Supercharged!</h1>

          <p className="text-blue-100 text-base max-w-sm leading-relaxed">
            Run smarter, grow faster, and keep your business one step ahead — from inventory to
            insights, all in one platform.
          </p>
        </div>

        {/* Feature Icons Grid */}
        <div className="relative z-10 grid grid-cols-2 gap-4 max-w-sm">
          {[
            { icon: Package, text: 'Inventory' },
            { icon: Users, text: 'Customers' },
            { icon: BarChart3, text: 'Analytics' },
            { icon: BadgeCheck, text: 'Brand Tools' },
            { icon: Cpu, text: 'AI Powered' },
            { icon: TrendingUp, text: 'Scale' }
          ].map(({ icon: Icon, text }, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-3 bg-white/10 rounded-lg backdrop-blur-sm"
            >
              <div className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center">
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-sm font-medium">{text}</span>
            </div>
          ))}
        </div>

        {/* Bottom Text */}
        <div className="relative z-10">
          <p className="text-blue-200 text-xs">Trusted by businesses worldwide</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Login Card */}
          <div
            className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden"
            onCopy={preventCopy}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-center select-none">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-lg mb-3">
                <LogIn className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-semibold text-white mb-1">Welcome Back</h1>
              <p className="text-blue-100 text-sm">Sign in to your Plurse account</p>
            </div>

            {/* Form Fields */}
            <div className="p-6 space-y-4">
              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-700 text-sm text-center">{error}</p>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-colors text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select your role</option>
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  placeholder="Enter your username"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  placeholder="Enter your password"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Login Button */}
              <button
                type="button"
                onClick={handleLogin}
                disabled={!isFormValid() || isLoading}
                className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Signing In...
                  </>
                ) : (
                  <>
                    Sign In
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </div>

            {/* Setup Business Link */}
            <div className="text-center pb-6 select-none" onCopy={preventCopy}>
              <Link
                to="/"
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium"
              >
                Setup business with Plurse
              </Link>
            </div>
          </div>

          {/* Footer Text */}
          <div className="text-center mt-4 select-none" onCopy={preventCopy}>
            <p className="text-xs text-gray-600">Plurse - Your business purse, supercharged!</p>
            <p className="text-xs text-gray-400 mt-1">© 2025 Plurse. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
