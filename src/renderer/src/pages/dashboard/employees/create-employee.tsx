import ToastContainer, { ToastMessage } from '@renderer/components/toast/toast-container'
import { useEffect, useRef, useState } from 'react'

const CreateEmployeeByAdmin = () => {
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'viewer',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    date_of_birth: '',
    date_of_joining: '',
    emergency_contact: '',
    department_id: '',
    salary: ''
  })

  // Profile picture state
  const [profilePic, setProfilePic] = useState<string>('')
  const [profilePicPreview, setProfilePicPreview] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // UI state
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [departments, setDepartments] = useState<Array<{
    id: number
    sync_id: string | null
    department_name: string
    created_on: string
    updated_on: string
    is_deleted: boolean
    last_sync: string | null
    is_sync_required: boolean
    is_active: boolean
  }>>([])
  const [loadingDepartments, setLoadingDepartments] = useState(false)

  // Toast helper functions
  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  // Fetch departments
  const getDepartments = async () => {
    setLoadingDepartments(true)
    try {
      const result = await window.api.departments.get({ include_deleted: false })
      if (result.success && result.data) {
        // Ensure data is an array
        setDepartments(Array.isArray(result.data) ? result.data : [])
      } else {
        addToast(result.message || 'Failed to fetch departments', 'error')
        setDepartments([])
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
      addToast('Failed to load departments', 'error')
      setDepartments([])
    } finally {
      setLoadingDepartments(false)
    }
  }

  // Fetch departments on mount
  useEffect(() => {
    getDepartments()
  }, [])

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // Handle profile picture upload
  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, profile_pic: 'Please select an image file' }))
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, profile_pic: 'Image size must be less than 5MB' }))
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      setProfilePic(result)
      setProfilePicPreview(result)
      // Clear error
      if (errors.profile_pic) {
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors.profile_pic
          return newErrors
        })
      }
    }
    reader.readAsDataURL(file)
  }

  // Remove profile picture
  const removeProfilePic = () => {
    setProfilePic('')
    setProfilePicPreview('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Step 1: Account Details
    if (currentStep === 1) {
      if (!formData.username.trim()) {
        newErrors.username = 'Username is required'
      } else if (formData.username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters'
      }

      if (!formData.password.trim()) {
        newErrors.password = 'Password is required'
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters'
      }

      if (!formData.role) {
        newErrors.role = 'Role is required'
      }

      if (!profilePic) {
        newErrors.profile_pic = 'Profile picture is required'
      }
    }

    // Step 2: Personal Information
    if (currentStep === 2) {
      if (!formData.first_name.trim()) {
        newErrors.first_name = 'First name is required'
      }

      if (!formData.last_name.trim()) {
        newErrors.last_name = 'Last name is required'
      }

      // Email or phone validation
      const hasEmail = formData.email.trim()
      const hasPhone = formData.phone.trim()

      if (!hasEmail && !hasPhone) {
        newErrors.contact = 'Either email or phone number is required'
      }

      if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address'
      }

      if (hasPhone && !/^\+?[\d\s\-()]+$/.test(formData.phone)) {
        newErrors.phone = 'Please enter a valid phone number'
      }

      if (!formData.address.trim()) {
        newErrors.address = 'Address is required'
      }

      if (!formData.date_of_birth) {
        newErrors.date_of_birth = 'Date of birth is required'
      }
    }

    // Step 3: Employment Details
    if (currentStep === 3) {
      if (!formData.date_of_joining) {
        newErrors.date_of_joining = 'Date of joining is required'
      }

      if (!formData.salary.trim()) {
        newErrors.salary = 'Salary is required'
      } else if (isNaN(Number(formData.salary)) || Number(formData.salary) <= 0) {
        newErrors.salary = 'Please enter a valid salary amount'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle next step
  const handleNext = () => {
    if (validateForm()) {
      setCurrentStep((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Handle previous step
  const handlePrevious = () => {
    setCurrentStep((prev) => prev - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setLoading(true)

    try {
      const payload = {
        username: formData.username.trim(),
        password: formData.password,
        role: formData.role,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim(),
        date_of_birth: formData.date_of_birth,
        date_of_joining: formData.date_of_joining,
        emergency_contact: formData.emergency_contact.trim() || undefined,
        department_id: formData.department_id ? Number(formData.department_id) : undefined,
        salary: formData.salary,
        with_profile_pic: true as const,
        profile_pic_data: profilePic
      }

      const result = await window.api.employees.createByAdmin(payload)

      if (result.success) {
        addToast('Employee created successfully!', 'success')
        
        // Reset form
        setFormData({
          username: '',
          password: '',
          role: 'viewer',
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          address: '',
          date_of_birth: '',
          date_of_joining: '',
          emergency_contact: '',
          department_id: '',
          salary: ''
        })
        setProfilePic('')
        setProfilePicPreview('')
        setCurrentStep(1)
        setErrors({})
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        addToast(result.message || 'Failed to create employee', 'error')
      }
    } catch (error) {
      console.error('Error creating employee:', error)
      addToast('An unexpected error occurred', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50 py-8">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create New Employee</h1>
              <p className="text-sm text-gray-600 mt-1">
                Step {currentStep} of 3: {
                  currentStep === 1 ? 'Account Details' :
                  currentStep === 2 ? 'Personal Information' :
                  'Employment Details'
                }
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                  step <= currentStep 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500' 
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <form onSubmit={handleSubmit}>
            <div className="p-6 sm:p-8">
              {/* Step 1: Account Details */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="pb-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Account Details</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Set up the basic login credentials and profile picture
                    </p>
                  </div>

                  {/* Profile Picture Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Profile Picture <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-start gap-6">
                      {/* Preview */}
                      <div className="relative">
                        <div className="w-32 h-32 rounded-full border-2 border-gray-300 overflow-hidden bg-gray-100">
                          {profilePicPreview ? (
                            <img
                              src={profilePicPreview}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {profilePicPreview && (
                          <button
                            type="button"
                            onClick={removeProfilePic}
                            className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors shadow-lg"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Upload Button */}
                      <div className="flex-1">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePicChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-colors flex flex-col items-center justify-center gap-2"
                        >
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-base font-semibold">
                            {profilePicPreview ? 'Change Photo' : 'Upload Photo'}
                          </span>
                          <span className="text-xs text-gray-500">
                            JPG, PNG or GIF. Max size 5MB.
                          </span>
                        </button>
                      </div>
                    </div>
                    {errors.profile_pic && (
                      <p className="text-sm text-red-600 mt-2">{errors.profile_pic}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Username */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Username <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                          @
                        </div>
                        <input
                          type="text"
                          name="username"
                          value={formData.username}
                          onChange={handleChange}
                          className={`w-full pl-9 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                            errors.username
                              ? 'border-red-300 focus:ring-red-500'
                              : 'border-gray-300 focus:ring-blue-500'
                          }`}
                          placeholder="johndoe"
                        />
                      </div>
                      {errors.username && (
                        <p className="text-sm text-red-600 mt-1">{errors.username}</p>
                      )}
                    </div>

                    {/* Password */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                            errors.password
                              ? 'border-red-300 focus:ring-red-500'
                              : 'border-gray-300 focus:ring-blue-500'
                          }`}
                          placeholder="Enter secure password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-sm text-red-600 mt-1">{errors.password}</p>
                      )}
                    </div>

                    {/* Role */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Role <span className="text-red-500">*</span>
                      </label>
                      <select 
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                          errors.role
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="staff">Staff</option>
                        <option value="accountant">Accountant</option>
                        <option value="sales_person">Sales Person</option>
                      </select>
                      {errors.role && (
                        <p className="text-sm text-red-600 mt-1">{errors.role}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Personal Information */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="pb-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Enter the employee's personal and contact details
                    </p>
                  </div>

                  {errors.contact && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">{errors.contact}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* First Name */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                          errors.first_name
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        placeholder="John"
                      />
                      {errors.first_name && (
                        <p className="text-sm text-red-600 mt-1">{errors.first_name}</p>
                      )}
                    </div>

                    {/* Last Name */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                          errors.last_name
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        placeholder="Doe"
                      />
                      {errors.last_name && (
                        <p className="text-sm text-red-600 mt-1">{errors.last_name}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email {!formData.phone && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                          errors.email
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        placeholder="john.doe@example.com"
                      />
                      {errors.email && (
                        <p className="text-sm text-red-600 mt-1">{errors.email}</p>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Phone {!formData.email && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                          errors.phone
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        placeholder="+1 234 567 8900"
                      />
                      {errors.phone && (
                        <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
                      )}
                    </div>

                    {/* Address */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Address <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        rows={3}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none ${
                          errors.address
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        placeholder="123 Main Street, City, State, ZIP"
                      />
                      {errors.address && (
                        <p className="text-sm text-red-600 mt-1">{errors.address}</p>
                      )}
                    </div>

                    {/* Date of Birth */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Date of Birth <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="date_of_birth"
                        value={formData.date_of_birth}
                        onChange={handleChange}
                        max={new Date().toISOString().split('T')[0]}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                          errors.date_of_birth
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                      />
                      {errors.date_of_birth && (
                        <p className="text-sm text-red-600 mt-1">{errors.date_of_birth}</p>
                      )}
                    </div>

                    {/* Emergency Contact */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Emergency Contact
                      </label>
                      <input
                        type="tel"
                        name="emergency_contact"
                        value={formData.emergency_contact}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="+1 234 567 8900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Employment Details */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="pb-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Employment Details</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Configure employment-specific information
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Date of Joining */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Date of Joining <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="date_of_joining"
                        value={formData.date_of_joining}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                          errors.date_of_joining
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                      />
                      {errors.date_of_joining && (
                        <p className="text-sm text-red-600 mt-1">{errors.date_of_joining}</p>
                      )}
                    </div>

                    {/* Department */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Department
                      </label>
                      <select
                        name="department_id"
                        value={formData.department_id}
                        onChange={handleChange}
                        disabled={loadingDepartments}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">Select a department (optional)</option>
                        {Array.isArray(departments) && departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.department_name}
                            {dept.is_sync_required && ' ⚠️ (Sync Required)'}
                          </option>
                        ))}
                      </select>
                      {loadingDepartments && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Loading departments...
                        </p>
                      )}
                      {!loadingDepartments && Array.isArray(departments) && departments.length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">No departments available</p>
                      )}
                    </div>

                    {/* Salary */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Salary <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                          $
                        </div>
                        <input
                          type="number"
                          name="salary"
                          value={formData.salary}
                          onChange={handleChange}
                          min="0"
                          step="0.01"
                          className={`w-full pl-9 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                            errors.salary
                              ? 'border-red-300 focus:ring-red-500'
                              : 'border-gray-300 focus:ring-blue-500'
                          }`}
                          placeholder="50000.00"
                        />
                      </div>
                      {errors.salary && (
                        <p className="text-sm text-red-600 mt-1">{errors.salary}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 sm:px-8 py-5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-4">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevious}
                    disabled={loading}
                    className="px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={loading}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Create Employee
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateEmployeeByAdmin