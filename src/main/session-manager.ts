// Global session state
export interface Session {
  employeeId: number
  username: string
  role: string
  loginTime: Date
  sessionToken: string
}

let currentSession: Session | null = null

export const sessionManager = {
  // Get current session
  getCurrentSession: (): Session | null => currentSession,

  // Login - replaces any existing session
  login: (sessionData: Session): void => {
    currentSession = sessionData
  },

  // Logout - clear current session
  logout: (): void => {
    currentSession = null
  },

  // Check if user is logged in
  isLoggedIn: (): boolean => currentSession !== null,

  // Validate session (for future expiry checks)
  validateSession: (): boolean => {
    if (!currentSession) return false
    // Add session expiry logic here if needed
    return true
  }
}
