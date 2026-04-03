import { Camera, ChevronDown, Save, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface UserProfile {
  id?: number
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  username: string
  profilePhoto: string
}

const Profile = () => {
  const [profile, setProfile] = useState<UserProfile>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    username: '',
    profilePhoto: ''
  })
  const [tempProfile, setTempProfile] = useState<UserProfile>(profile)
  const [previewImage, setPreviewImage] = useState<string>('')
  const [hasChanges, setHasChanges] = useState(false)
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch user profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await window.api.employees.getProfile({ with_profile_pic: true })

        if (response.success && response.data) {
          const data = response.data

          const profilePicData =
            data.profile_picture?.path
              ? window.api.files.readFileAsDataURL(data.profile_picture.path)
              : ''

          const fullProfile: UserProfile = {
            id: data.id,
            first_name: data.first_name || null,
            last_name: data.last_name || null,
            email: data.email || null,
            phone: data.phone || null,
            username: data.username,
            profilePhoto: (profilePicData) as string
          }
          setProfile(fullProfile)
          setTempProfile(fullProfile)
          setPreviewImage(fullProfile.profilePhoto)
        } else {
          console.error('Failed to load profile:', response.message)
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  // Detect changes in tempProfile or password fields
  useEffect(() => {
    const profileChanged = Object.keys(tempProfile).some(
      (key) => (tempProfile as any)[key] !== (profile as any)[key]
    )
    const passwordChanged = newPassword !== '' || confirmPassword !== ''
    setHasChanges(profileChanged || passwordChanged)
  }, [tempProfile, profile, newPassword, confirmPassword])

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    setTempProfile((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    if (!profile.id) return

    // Validate password if changed
    if (newPassword || confirmPassword) {

      if (newPassword !== confirmPassword) {
        setPasswordError('New password and confirm password do not match')
        return
      }
      if (newPassword.length < 8) {
        setPasswordError('New password must be at least 8 characters')
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError(null)
    }

    // Update profile via IPC
    try {
      const response = await window.api.employees.update({
        id: profile.id,
        username: tempProfile.username,
        first_name: tempProfile.first_name ?? undefined,
        last_name: tempProfile.last_name ?? undefined,
        email: tempProfile.email ?? undefined,
        phone: tempProfile.phone ?? undefined,
        with_profile_pic: !!tempProfile.profilePhoto,
        profile_pic_data: tempProfile.profilePhoto
      })

      if (response.success) {
        setProfile(tempProfile)
        setHasChanges(false)
      } else {
        console.error('Failed to update profile:', response.message)
      }
    } catch (err) {
      console.error('Error updating profile:', err)
    }
  }

  const handleCancel = () => {
    setTempProfile(profile)
    setPreviewImage(profile.profilePhoto)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError(null)
    setHasChanges(false)
  }

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setPreviewImage(result)
        setTempProfile((prev) => ({
          ...prev,
          profilePhoto: result
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const toggleCredentials = () => setIsCredentialsOpen(!isCredentialsOpen)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading profile...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Profile Settings</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Update your personal information seamlessly
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          {/* Profile Photo */}
          <div className="flex justify-between items-start mb-6">
            <div className="relative">
              <div
                className="w-24 h-24 rounded-full border border-gray-200 overflow-hidden bg-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={handlePhotoClick}
              >
                {previewImage ? (
                  <img
                  src={previewImage}
                  alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400 text-sm">Upload</span>
                )}
              </div>
              <button
                onClick={handlePhotoClick}
                className="absolute bottom-0 right-0 bg-blue-500 text-white p-1.5 rounded-full hover:bg-blue-600 transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Profile Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={tempProfile.first_name ?? ''}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none transition-colors text-gray-900"
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={tempProfile.last_name ?? ''}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none transition-colors text-gray-900"
                placeholder="Enter last name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={tempProfile.email ?? ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none transition-colors text-gray-900"
                placeholder="Enter email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={tempProfile.phone ?? ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none transition-colors text-gray-900"
                placeholder="Enter phone"
              />
            </div>
          </div>

          {/* Critical Credentials Accordion */}
          <div className="mt-8">
            <button
              onClick={toggleCredentials}
              className="flex items-center justify-between w-full px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors text-gray-700 font-medium text-sm"
            >
              <span>Critical Credentials</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${isCredentialsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isCredentialsOpen && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={tempProfile.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none transition-colors text-gray-900"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none transition-colors text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none transition-colors text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none transition-colors text-gray-900"
                    />
                  </div>
                  {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tip */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            <span className="font-medium">Tip:</span> Keep your profile and credentials updated to ensure smooth communication and security.
          </p>
        </div>

        {/* Action Buttons */}
        {hasChanges && (
          <div className="flex gap-3 my-5 right-0 justify-end max-w-4xl mx-auto">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Profile
