import React, { createContext, useContext, useEffect, useState } from 'react'

interface AuthContextType {
  isAuthenticated: boolean
  userRole: string | null
  isLoading: boolean
  setupComplete: boolean
  checkAuth: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [setupComplete, setSetupComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const checkAuth = async () => {
    try {
      // Check authentication status
      const authResult = await window.api.employees.checkAuth()
      const authenticated = !!(authResult.success && authResult.data?.isAuthenticated)
      setIsAuthenticated(authenticated)

      if (authenticated) {
        // Get user role from session
        const sessionResult = await window.api.employees.getCurrentSession()
        if (sessionResult.success && sessionResult.data) {
          setUserRole(sessionResult.data.employee.role)
        }
      } else {
        setUserRole(null)
      }

      // Check setup status
      const setupResult = await window.api.setup.get()
      if (setupResult.success && setupResult.data) {
        setSetupComplete(setupResult.data.is_completed === 1)
      }
    } catch (error) {
      console.error('Error checking auth:', error)
      setIsAuthenticated(false)
      setUserRole(null)
      setSetupComplete(false)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await window.api.employees.logout()
      setIsAuthenticated(false)
      setUserRole(null)
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userRole,
        isLoading,
        setupComplete,
        checkAuth,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
