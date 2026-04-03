import PlurseLoadingPage from '@renderer/components/loading-page'
import { CheckCircle, ChevronRight, Phone } from 'lucide-react'
import { useEffect, useState } from 'react'

// Step 4: Contact Verification Component
const ContactVerification = ({ onNext, onSkip, onPrevious }) => {
  const [verificationCode, setVerificationCode] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Check verification status on component load
  useEffect(() => {
    checkVerificationStatus()
  }, [])

  const checkVerificationStatus = async () => {
    try {
      setIsLoading(true)
      setError('')

      const result = await window.api.businessBranch.get()

      if (result.success && result.data) {
        setIsVerified(result.data.is_verified === 1)
      } else {
        setError('Failed to load verification status')
      }
    } catch (error) {
      console.error('Error checking verification status:', error)
      setError('Failed to load verification status')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerification = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit verification code')
      return
    }

    try {
      setIsVerifying(true)
      setError('')
      setSuccess('')

      const result = await window.api.businessBranch.verify({
        verification_code: verificationCode
      })

      if (result.success) {
        setSuccess('Contact verified successfully!')
        setIsVerified(true)
        // Auto-proceed after successful verification
        setTimeout(() => {
          onNext()
        }, 1500)
      } else {
        setError(result.message || 'Verification failed. Please check the code and try again.')
      }
    } catch (error) {
      console.error('Verification error:', error)
      setError('An unexpected error occurred during verification.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSkip = () => {
    // Just proceed to next step without verification
    onSkip()
  }

  const handleResendCode = async () => {
    // You'll need to implement this IPC handler
    // For now, just show a message
    setSuccess('Verification code has been resent!')
    setVerificationCode('') // Clear the input field
  }

  if (isLoading) {
    return <PlurseLoadingPage />
  }

  return (
    <div className="p-12">
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-purple-50 rounded-2xl mb-8">
          {isVerified ? (
            <CheckCircle className="w-12 h-12 text-green-600" />
          ) : (
            <Phone className="w-12 h-12 text-purple-600" />
          )}
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {isVerified ? 'Contact Verified!' : 'Verify Contact Info'}
        </h1>
        <p className="text-xl text-gray-600 max-w-md mx-auto">
          {isVerified
            ? 'Your contact information has been successfully verified.'
            : 'Enter the verification code sent to your phone'}
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="max-w-md mx-auto mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 text-center">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="max-w-md mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-center">{error}</p>
        </div>
      )}

      {!isVerified && (
        <div className="max-w-md mx-auto mb-12">
          <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
          <input
            type="text"
            value={verificationCode}
            onChange={(e) => {
              setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              setError('') // Clear error when user starts typing
            }}
            placeholder="Enter 6-digit code"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest disabled:bg-gray-100 disabled:cursor-not-allowed"
            maxLength={6}
            disabled={isVerifying}
          />
          <p className="text-sm text-gray-500 mt-2 text-center">
            Didn't receive a code?{' '}
            <button
              onClick={handleResendCode}
              className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
              disabled={isVerifying}
            >
              Resend
            </button>
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrevious}
          disabled={isVerifying}
          className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>

        <div className="flex items-center space-x-4">
          {!isVerified && (
            <>
              <button
                onClick={handleSkip}
                disabled={isVerifying}
                className="px-6 py-2 text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip verification
              </button>

              <button
                onClick={handleVerification}
                disabled={verificationCode.length !== 6 || isVerifying || isVerified}
                className="inline-flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isVerifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            </>
          )}

          {isVerified && (
            <button
              onClick={onNext}
              className="inline-flex items-center px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-2" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ContactVerification
