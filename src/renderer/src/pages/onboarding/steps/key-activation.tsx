import { ChevronRight, Key, X } from 'lucide-react'
import { useState } from 'react'

// Step 2: Activation Key Component
const ActivationKey = ({ onNext, onSkip, onPrevious }) => {
  const [activationKey, setActivationKey] = useState('')
  const [showModal, setShowModal] = useState(false)

  const handleActivate = () => {
    setShowModal(true)
  }

  return (
    <div className="p-12">
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-amber-50 rounded-2xl mb-8">
          <Key className="w-12 h-12 text-amber-600" />
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">Activate Your Software</h1>
        <p className="text-xl text-gray-600 max-w-md mx-auto">
          Enter your activation key to unlock premium features
        </p>
      </div>

      <div className="max-w-md mx-auto mb-12">
        <label className="block text-sm font-medium text-gray-700 mb-2">Activation Key</label>
        <input
          type="text"
          value={activationKey}
          onChange={(e) => setActivationKey(e.target.value)}
          placeholder="Enter your activation key"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrevious}
          className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Back
        </button>

        <div className="flex items-center space-x-4">
          <button
            onClick={onSkip}
            className="px-6 py-2 text-blue-600 hover:text-blue-800 transition-colors"
          >
            Skip for now
          </button>

          <button
            onClick={handleActivate}
            disabled={!activationKey.trim()}
            className="inline-flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Activate
            <ChevronRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Invalid Activation Key</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              The activation key you entered is not valid. Please check and try again.
            </p>
            <button
              onClick={() => {
                setShowModal(false)
                onNext()
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivationKey
