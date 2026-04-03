import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AdminUser from './steps/create-admin-user'
import BusinessAccount from './steps/create-business-account'
import Intro from './steps/intro'
import ActivationKey from './steps/key-activation'
import ContactVerification from './steps/verify-contact'

import PlurseLoadingPage from '@renderer/components/loading-page'
import { useAuth } from '@renderer/contexts/auth.context'

// Main Onboarding Component
const Onboarding = () => {
  const navigate = useNavigate()
  const { checkAuth } = useAuth()
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const loadSetup = async () => {
      const res = await window.api.setup.get()
      if (res.success && res.data) {
        setCurrentStep(res.data.progress)
      }
      setLoading(false)
    }
    loadSetup()
  }, [])

  const handleNext = async () => {
    const res = await window.api.setup.update({ action: 'next' })
    if (res.success && res.data) {
      if (res.data.is_completed) {
        // Redirect to login page if setup is completed
        navigate('/login')
      } else {
        // setCurrentStep(res.data.progress)
        setCurrentStep(currentStep + 1) // Optimistically update step
      }
    }
  }

  const handlePrevious = async () => {
    const res = await window.api.setup.update({ action: 'previous' })
    if (res.success && res.data) {
      // setCurrentStep(res.data.progress)
      setCurrentStep(currentStep - 1) // Optimistically update step
    }
  }

  const handleSkip = async () => {
    const res = await window.api.setup.update({ action: 'skip', stage: currentStep })

    if (res.success && res.data) {
      if (res.data.is_completed) {
        // Redirect to login page if setup is completed
        navigate('/login')
      } else {
        // setCurrentStep(res.data.progress)
        setCurrentStep(currentStep + 1) // Optimistically update step
      }
    }
  }

  const handleComplete = async () => {
    const res = await window.api.setup.update({ action: 'complete' })

    if (res.success) {
      // Refresh auth plus setup state
      await checkAuth()
      navigate('/login')
    }
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return <Intro onNext={handleNext} />
      case 1:
        return <ActivationKey onNext={handleNext} onSkip={handleSkip} onPrevious={handlePrevious} />
      case 2:
        return <BusinessAccount onNext={handleNext} onPrevious={handlePrevious} />
      case 3:
        return (
          <ContactVerification
            onNext={handleNext}
            onSkip={handleSkip}
            onPrevious={handlePrevious}
          />
        )
      case 4:
        return <AdminUser onHandleComplete={handleComplete} onPrevious={handlePrevious} />
      default:
        return <Intro onNext={handleNext} />
    }
  }

  if (loading) return <PlurseLoadingPage />

  return (
    <div className="min-h-screen relative flex items-center justify-center p-5">
      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Base grid pattern - very subtle */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(59, 130, 246, 0.04) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(59, 130, 246, 0.04) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Secondary finer grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(99, 102, 241, 0.02) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(99, 102, 241, 0.02) 1px, transparent 1px)
            `,
            backgroundSize: '10px 10px'
          }}
        />

        {/* Major grid lines */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(37, 99, 235, 0.06) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(37, 99, 235, 0.06) 1px, transparent 1px)
            `,
            backgroundSize: '200px 200px'
          }}
        />

        {/* Progressive blur effect */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(
                180deg,
                rgba(255, 255, 255, 0) 0%,
                rgba(255, 255, 255, 0) 55%,
                rgba(255, 255, 255, 0.1) 65%,
                rgba(255, 255, 255, 0.3) 75%,
                rgba(255, 255, 255, 0.6) 85%,
                rgba(255, 255, 255, 0.95) 100%
              )
            `,
            backdropFilter: 'blur(0px)'
          }}
        />

        {/* Additional blur overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(
                180deg,
                transparent 0%,
                transparent 55%,
                rgba(255, 255, 255, 0.05) 65%,
                rgba(255, 255, 255, 0.15) 85%,
                rgba(255, 255, 255, 0.3) 100%
              )
            `,
            filter: 'blur(1px)',
            opacity: 0.8
          }}
        />
      </div>

      <div className="relative w-full max-w-4xl px-8">
        {/* Main Content Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1 bg-gray-100">
            <div
              className="h-full bg-blue-500 transition-all duration-500 ease-out"
              style={{ width: `${((currentStep + 1) / 5) * 100}%` }}
            />
          </div>

          {/* Render Current Step */}
          {renderCurrentStep()}
        </div>

        {/* Skip Option */}
        <div className="text-center my-8">
          <button className="text-gray-500 hover:text-gray-700 transition-colors text-sm">
            Already have an account? Log in
          </button>
        </div>
      </div>
    </div>
  )
}

export default Onboarding
