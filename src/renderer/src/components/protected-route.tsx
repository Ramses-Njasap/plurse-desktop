import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/auth.context'
import PlurseLoadingPage from './loading-page'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireSetupComplete?: boolean
  requireSetupIncomplete?: boolean
  roles?: string[]
  fallbackPath?: string
}

const ProtectedRoute = ({
  children,
  requireAuth = false,
  requireSetupComplete = false,
  requireSetupIncomplete = false,
  roles = [],
  fallbackPath
}: ProtectedRouteProps) => {
  const { isAuthenticated, userRole, isLoading, setupComplete } = useAuth()

  // Show loading spinner
  if (isLoading) {
    return <PlurseLoadingPage />
  }

  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={fallbackPath || '/login'} replace />
  }

  // Check setup completion requirement
  if (requireSetupComplete && !setupComplete) {
    return <Navigate to={fallbackPath || '/'} replace />
  }

  // Check setup incompletion requirement
  if (requireSetupIncomplete && setupComplete) {
    return <Navigate to={fallbackPath || '/login'} replace />
  }

  // Check role-based access
  if (requireAuth && roles.length > 0 && userRole && !roles.includes(userRole)) {
    return <Navigate to={fallbackPath || '/dashboard'} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
