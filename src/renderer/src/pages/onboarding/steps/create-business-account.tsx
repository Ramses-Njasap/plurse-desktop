import PlurseLoadingPage from '@renderer/components/loading-page'
import { countryCodes, currencies, languages } from '@renderer/utils/variables.utils'
import { Building, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// TypeScript interfaces

interface FilterableDropdownProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: any[]
  displayField?: string
  valueField?: string
  placeholder?: string
}

interface FormData {
  businessName: string
  locationName: string
  email: string
  phoneNumber: string
  countryCode: string
  language: string
  currency: string
}

// Filterable Dropdown Component
const FilterableDropdown = ({
  label,
  value,
  onChange,
  options,
  displayField,
  valueField,
  placeholder = 'Search...'
}: FilterableDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filteredOptions = options.filter((option) => {
    const displayValue = displayField ? option[displayField] : option
    return displayValue.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const selectedOption = options.find((opt) => (valueField ? opt[valueField] : opt) === value)
  const displayValue = selectedOption
    ? displayField
      ? selectedOption[displayField]
      : selectedOption
    : value

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-[50px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left bg-white flex justify-between items-center hover:border-gray-400 transition-colors"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>{displayValue || label}</span>
        <ChevronRight
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : 'rotate-0'}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const optionValue = valueField ? option[valueField] : option
                const optionDisplay = displayField ? option[displayField] : option

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      onChange(optionValue)
                      setIsOpen(false)
                      setSearchTerm('')
                    }}
                    className={`w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors ${
                      optionValue === value ? 'bg-blue-100 text-blue-700' : 'text-gray-900'
                    }`}
                  >
                    {optionDisplay}
                  </button>
                )
              })
            ) : (
              <div className="px-4 py-3 text-gray-500 text-sm text-center">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const BusinessAccount = ({
  onNext,
  onPrevious
}: {
  onNext: () => void
  onPrevious: () => void
}) => {
  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    locationName: '',
    email: '',
    phoneNumber: '',
    countryCode: '+237',
    language: 'English',
    currency: 'XAF '
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string>('')

  // Load data from database on component mount
  useEffect(() => {
    loadBusinessData()
  }, [])

  const loadBusinessData = async () => {
    try {
      setIsLoading(true)
      setError('')

      // Fetch business data
      const businessResponse = await window.api.businessBranch.get()

      if (businessResponse.success && businessResponse.data) {
        const businessData = businessResponse.data

        // Parse coordinates if they exist
        let locationName = ''
        if (businessData.branch_location_coordinate) {
          try {
            const coordinates = JSON.parse(businessData.branch_location_coordinate)
            // You can use coordinates for mapping if needed
          } catch (e) {
            console.warn('Failed to parse location coordinates')
          }
        }

        // Extract phone number and country code
        let phoneNumber = ''
        let countryCode = '+237' // default
        if (businessData.branch_phone_number) {
          const phone = businessData.branch_phone_number
          // Simple extraction - you might want more sophisticated parsing
          const foundCode = countryCodes.find((code) => phone.startsWith(code.code))
          if (foundCode) {
            countryCode = foundCode.code
            phoneNumber = phone.replace(foundCode.code, '')
          } else {
            phoneNumber = phone
          }
        }

        setFormData({
          businessName: businessData.business_name || '',
          locationName: businessData.branch_location_name || '',
          email: businessData.branch_email_address || '',
          phoneNumber: phoneNumber,
          countryCode: countryCode,
          language: businessData.default_language || 'English',
          currency: businessData.default_currency || 'XAF '
        })
      }
    } catch (error) {
      console.error('Failed to load business data:', error)
      setError('Failed to load existing business data. You can continue to create new one.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    if (field === 'language') {
      // Check if value is in the name field of languages
      const foundLang = languages.find((language) => value === language.name)
      if (foundLang) {
        value = foundLang.code
      }
    }
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const handlePhoneNumberChange = (value: string) => {
    // Only allow digits
    const digitsOnly = value.replace(/\D/g, '')
    handleInputChange('phoneNumber', digitsOnly)
  }

  const isFormValid = () => {
    return (
      formData.businessName.trim() !== '' &&
      formData.locationName.trim() !== '' &&
      formData.email.trim() !== '' &&
      formData.phoneNumber.trim() !== '' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
    )
  }

  const handleNext = async () => {
    if (!isFormValid()) return

    try {
      setIsSaving(true)
      setError('')

      // Combine country code and phone number
      const fullPhoneNumber = formData.countryCode + formData.phoneNumber

      // Save to database
      const result = await window.api.businessBranch.upsert({
        business_name: formData.businessName,
        branch_location_name: formData.locationName,
        branch_email_address: formData.email,
        branch_phone_number: fullPhoneNumber,
        default_language: formData.language,
        default_currency: formData.currency,
        attempt_geolocation: true // Try to get coordinates automatically
      })

      if (result.success) {
        onNext()
      } else {
        setError(result.message || 'Failed to save business branch')
      }
    } catch (error) {
      console.error('Failed to save business data:', error)
      setError('An unexpected error occurred while saving. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <PlurseLoadingPage />
  }

  return (
    <div className="min-h-screen md:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-2xl mb-6">
            <Building className="w-10 h-10 text-green-600" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            {formData.businessName ? 'Update Business Account' : 'Create Business Account'}
          </h1>
          <p className="text-lg text-gray-600 max-w-md mx-auto">
            {formData.businessName
              ? 'Update your business information'
              : 'Set up your business information'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="mb-10 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Name *
              </label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => handleInputChange('businessName', e.target.value)}
                className="w-full h-[50px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter business name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location Name *
              </label>
              <input
                type="text"
                value={formData.locationName}
                onChange={(e) => handleInputChange('locationName', e.target.value)}
                className="w-full h-[50px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter location name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full h-[50px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="business@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
              <div className="flex gap-2">
                <div className="w-36">
                  <FilterableDropdown
                    label="Code"
                    value={formData.countryCode}
                    onChange={(value) => handleInputChange('countryCode', value)}
                    options={countryCodes}
                    displayField="display"
                    valueField="code"
                    placeholder="Search country..."
                  />
                </div>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => handlePhoneNumberChange(e.target.value)}
                  placeholder="123456789"
                  className="flex-1 h-[50px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
              <FilterableDropdown
                label="Select language"
                value={
                  languages.find((language) => formData.language === language.code)?.name || ''
                }
                onChange={(value) => handleInputChange('language', value)}
                options={languages.map((lang) => lang.name)}
                placeholder="Search language..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
              <FilterableDropdown
                label="Select currency"
                value={formData.currency}
                onChange={(value) => handleInputChange('currency', value)}
                options={currencies.map((curr) => curr.code)}
                placeholder="Search currency..."
              />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <button
            onClick={onPrevious}
            disabled={isSaving}
            className="px-6 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          <button
            onClick={handleNext}
            disabled={!isFormValid() || isSaving}
            className="inline-flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 shadow-md hover:shadow-lg"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BusinessAccount
