import { CheckCircle, Shield } from 'lucide-react'
import { useState } from 'react'

// Step 5: Admin User Component
const AdminUser = ({ onHandleComplete, onPrevious }) => {
  const [formData, setFormData] = useState({
    role: 'admin',
    username: '',
    password: '',
    confirmPassword: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const isFormValid = () => {
    return (
      formData.username.trim() &&
      formData.password &&
      formData.confirmPassword &&
      formData.password === formData.confirmPassword
    )
  }

  const passwordsMatch = () => {
    return formData.password === formData.confirmPassword
  }

  const handleComplete = async () => {
    if (!isFormValid()) return

    // Double-check password match before submitting
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match. Please check and try again.')
      return
    }

    try {
      setIsLoading(true)
      setError('')

      // Create admin user using the employees API
      const result = await window.api.employees.create({
        username: formData.username.trim(),
        password: formData.password,
        role: formData.role
      })

      if (result.success) {
        // Update setup progress to complete
        const setupResult = await window.api.setup.update({
          action: 'complete'
        })

        if (setupResult.success) {
          onHandleComplete()
        } else {
          setError('Setup completed but failed to update progress. Please contact support.')
        }
      } else {
        setError(result.message || 'Failed to create admin user. Please try again.')
      }
    } catch (error) {
      console.error('Error creating admin user:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-12">
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-emerald-50 rounded-2xl mb-8">
          <Shield className="w-12 h-12 text-emerald-600" />
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">Create Admin User</h1>
        <p className="text-xl text-gray-600 max-w-md mx-auto">Set up your administrator account</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-md mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-center">{error}</p>
        </div>
      )}

      <div className="max-w-md mx-auto mb-12 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
          <input
            type="text"
            value={formData.role}
            disabled
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Username *</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={isLoading}
            placeholder="Enter admin username"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={isLoading}
            placeholder="Enter secure password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password *</label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
              formData.confirmPassword && !passwordsMatch()
                ? 'border-red-300 bg-red-50'
                : formData.confirmPassword && passwordsMatch()
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300'
            }`}
            disabled={isLoading}
            placeholder="Confirm your password"
          />
          {formData.confirmPassword && !passwordsMatch() && (
            <p className="text-red-600 text-sm mt-2">Passwords do not match</p>
          )}
          {formData.confirmPassword && passwordsMatch() && (
            <p className="text-green-600 text-sm mt-2">Passwords match</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrevious}
          disabled={isLoading}
          className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>

        <button
          onClick={handleComplete}
          disabled={!isFormValid() || isLoading}
          className="inline-flex items-center px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Creating...
            </>
          ) : (
            <>
              Complete Setup
              <CheckCircle className="w-4 h-4 ml-2" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default AdminUser
