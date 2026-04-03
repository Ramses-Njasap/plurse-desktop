import { BarChart3, ChevronRight, Package, Settings, Users } from 'lucide-react'
import { useState } from 'react'

// Step 1: Intro Component
const Intro = ({ onNext }) => {
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    {
      icon: Package,
      title: 'Welcome to Plurse',
      subtitle: "Let's get your business organized"
    },
    {
      icon: BarChart3,
      title: 'Track Everything',
      subtitle: 'Monitor stock levels in real-time'
    },
    {
      icon: Users,
      title: 'Manage Your Team',
      subtitle: 'Collaborate with full control'
    },
    {
      icon: Settings,
      title: 'Ready to Setup?',
      subtitle: 'Configure your own system'
    }
  ]

  const CurrentIcon = steps[currentStep].icon

  return (
    <div className="p-12">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-50 rounded-2xl mb-8">
          <CurrentIcon className="w-12 h-12 text-blue-600" />
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">{steps[currentStep].title}</h1>

        <p className="text-xl text-gray-600 max-w-md mx-auto">{steps[currentStep].subtitle}</p>
      </div>

      {/* Feature Preview Area */}
      <div className="bg-gray-50 rounded-xl p-8 mb-12 min-h-64 flex items-center justify-center">
        <div className="text-center">
          <div className="w-32 h-32 bg-white rounded-xl shadow-sm mb-6 mx-auto flex items-center justify-center">
            <CurrentIcon className="w-16 h-16 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">Feature preview placeholder</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {/* Step Indicators */}
        <div className="flex space-x-2">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                index === currentStep
                  ? 'bg-blue-500 w-6'
                  : index < currentStep
                    ? 'bg-blue-300'
                    : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Action Button */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (currentStep < steps.length - 1) {
                setCurrentStep(currentStep + 1)
              } else {
                onNext()
              }
            }}
            className="inline-flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {currentStep === steps.length - 1 ? 'Setup' : 'Continue'}
            <ChevronRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default Intro
