import React from 'react'

type Props = {
  employee: {
    id: number
    sync_id: string | null
    username: string
    role: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    created_on: string
    updated_on: string
    is_deleted: boolean
    last_sync: string | null
    is_sync_required: boolean
    is_active: boolean
    profile_picture?: {
      path: string
      filename: string
      original_filename: string
      mime_type: string
      file_size: number
      uploaded_at: string
    } | null
  }
  expanded: boolean
  onToggle: () => void
  onDelete?: (employeeId: number) => void
  onRestore?: (employeeId: number) => void
}

const EmployeeCard = ({ employee, expanded, onToggle, onDelete, onRestore }: Props) => {
  const [showDropdown, setShowDropdown] = React.useState(false)
  const [showDeleteModal, setShowDeleteModal] = React.useState(false)
  const [showRestoreModal, setShowRestoreModal] = React.useState(false)
  const [previewImage, setPreviewImage] = React.useState<string>('')
  const [loading, setLoading] = React.useState(true)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const fullName =
    `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() ||
    employee.username
  
  React.useEffect(() => {
    const loadEmployeePic = async () => {
      try {
        const profilePicData =
          employee.profile_picture?.path
            ? window.api.files.readFileAsDataURL(employee.profile_picture.path)
            : ''

        setPreviewImage(profilePicData as string)
      } catch (err) {
        console.error('Error fetching profile pic:', err)
      } finally {
        setLoading(false)
      }
    }

    loadEmployeePic()
  }, [employee.profile_picture])

  // Generate a color based on the employee's name for avatar
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-cyan-500',
      'bg-teal-500',
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  // Format last sync date
  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Never synced'
    const date = new Date(lastSync)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInHours / 24)

    if (diffInDays > 0) return `${diffInDays}d ago`
    if (diffInHours > 0) return `${diffInHours}h ago`
    return 'Just now'
  }

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }

    return undefined
  }, [showDropdown])

  const handleSync = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDropdown(false)
    // Handle sync logic
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDropdown(false)
    setShowDeleteModal(true)
  }

  const handleRestoreClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDropdown(false)
    setShowRestoreModal(true)
  }

  const confirmDelete = () => {
    if (onDelete) {
      onDelete(employee.id)
    }
    setShowDeleteModal(false)
  }

  const confirmRestore = () => {
    if (onRestore) {
      onRestore(employee.id)
    }
    setShowRestoreModal(false)
  }

  const cancelDelete = () => {
    setShowDeleteModal(false)
  }

  const cancelRestore = () => {
    setShowRestoreModal(false)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-4 md:px-6 py-4 animate-pulse border-b border-gray-100">
        <div className="md:col-span-1 flex items-center gap-3 md:gap-0">
          <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
          <div className="md:hidden flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-100 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`group ${employee.is_deleted ? 'opacity-60' : ''}`}>
        {/* Main Card */}
        <div
          className={`
            relative grid grid-cols-1 md:grid-cols-12 items-center gap-3 md:gap-4
            px-4 md:px-6 py-4
            border-b border-gray-100
            hover:bg-gray-50/80
            transition-all duration-200
            ${expanded ? 'bg-blue-50/40' : ''}
            ${employee.is_deleted ? 'bg-red-50/30' : ''}
            cursor-pointer
          `}
          onClick={onToggle}
        >
          {/* Avatar with deleted indicator */}
          <div className="col-span-1 flex items-center gap-3 md:gap-0">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border border-gray-200 overflow-hidden bg-gray-100">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={`
                      w-10 h-10 ${employee.is_deleted ? 'bg-gray-400' : getAvatarColor(fullName)}
                      rounded-full flex items-center justify-center
                      text-white text-sm font-semibold
                    `}
                  >
                    {fullName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {employee.is_deleted && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
            </div>
            {/* Mobile: Show name next to avatar */}
            <div className="md:hidden flex-1">
              <div className="font-semibold text-gray-900 flex items-center gap-2">
                {fullName}
                {employee.is_deleted && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    Deleted
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">@{employee.username}</div>
            </div>
          </div>

          {/* Name - Desktop only */}
          <div className="hidden md:block col-span-3">
            <div className="font-semibold text-gray-900 flex items-center gap-2">
              {fullName}
              {employee.is_deleted && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  Deleted
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">ID: {employee.id}</div>
          </div>

          {/* Username - Desktop only */}
          <div className="hidden md:flex col-span-2 items-center gap-1">
            <span className="text-gray-400 text-sm">@</span>
            <span className="text-gray-700 text-sm font-medium">
              {employee.username}
            </span>
          </div>

          {/* Role */}
          <div className="col-span-1 md:col-span-3">
            <span
              className="
                inline-flex items-center px-3 py-1 rounded-full
                text-xs font-medium
                bg-gradient-to-r from-gray-100 to-gray-50
                text-gray-700 border border-gray-200
                shadow-sm
              "
            >
              {employee.role}
            </span>
          </div>

          {/* Email - Desktop only */}
          <div className="hidden lg:flex col-span-2 items-center gap-2">
            {employee.email ? (
              <>
                <svg
                  className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-sm text-gray-600 truncate">
                  {employee.email}
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-400">No email</span>
            )}
          </div>

          {/* Expand Toggle */}
          <div className="col-span-1 flex justify-end">
            <div
              className={`
                w-8 h-8 flex items-center justify-center
                rounded-full
                text-gray-400 hover:text-gray-600 hover:bg-gray-100
                transition-all duration-200
                ${expanded ? 'rotate-180 bg-blue-100 text-blue-600' : ''}
              `}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        <div
          className={`
            overflow-hidden transition-all duration-300 ease-in-out
            ${expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}
          `}
        >
          {expanded && (
            <div className={`border-b border-gray-100 ${employee.is_deleted ? 'bg-red-50/20' : 'bg-gradient-to-b from-blue-50/30 to-gray-50/30'}`}>
              <div className="px-4 md:px-6 py-6 grid grid-cols-1 gap-4">
                {/* Deleted Warning Banner with Restore Option */}
                {employee.is_deleted && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-red-800">Employee Deleted</h4>
                        <p className="text-xs text-red-600 mt-1">This employee has been marked as deleted and is no longer active in the system.</p>
                        <button
                          onClick={handleRestoreClick}
                          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Restore Employee
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      Contact Details
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/60 transition-colors">
                        <svg
                          className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-500 mb-0.5">
                            Email
                          </div>
                          <div className="text-sm text-gray-900 font-medium break-words">
                            {employee.email || (
                              <span className="text-gray-400">Not provided</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/60 transition-colors">
                        <svg
                          className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-500 mb-0.5">
                            Phone
                          </div>
                          <div className="text-sm text-gray-900 font-medium">
                            {employee.phone || (
                              <span className="text-gray-400">Not provided</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Account Information */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
                        />
                      </svg>
                      Account Info
                    </h3>
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg hover:bg-white/60 transition-colors">
                        <div className="text-xs text-gray-500 mb-1">
                          Employee ID
                        </div>
                        <div className="text-sm text-gray-900 font-mono font-medium">
                          #{employee.id.toString().padStart(4, '0')}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg hover:bg-white/60 transition-colors">
                        <div className="text-xs text-gray-500 mb-1">
                          Username
                        </div>
                        <div className="text-sm text-gray-900 font-medium">
                          @{employee.username}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg hover:bg-white/60 transition-colors">
                        <div className="text-xs text-gray-500 mb-1">
                          Status
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${employee.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                          <span className="text-sm text-gray-900 font-medium">
                            {employee.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      Quick Actions
                    </h3>
                    <div className="space-y-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          // Handle view/edit
                        }}
                        disabled={employee.is_deleted}
                        className="
                          w-full px-4 py-2.5
                          bg-gray-900 hover:bg-gray-800
                          disabled:bg-gray-400 disabled:cursor-not-allowed
                          text-white text-sm font-medium
                          rounded-lg transition-all duration-200
                          flex items-center justify-center gap-2
                          shadow-sm hover:shadow
                        "
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        View/Edit Profile
                      </button>
                      
                      {/* More Options Dropdown */}
                      <div className="relative" ref={dropdownRef}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowDropdown(!showDropdown)
                          }}
                          className="
                            w-full px-4 py-2.5
                            bg-white hover:bg-gray-50
                            text-gray-700 text-sm font-medium
                            border border-gray-300 rounded-lg
                            transition-all duration-200
                            flex items-center justify-center gap-2
                            shadow-sm hover:shadow
                          "
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                            />
                          </svg>
                          More Options
                        </button>

                        {/* Dropdown Menu */}
                        {showDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                            <button
                              onClick={handleSync}
                              disabled={!employee.is_sync_required}
                              className={`
                                w-full px-4 py-2.5 text-left text-sm
                                flex items-center justify-between gap-3
                                transition-colors
                                ${employee.is_sync_required 
                                  ? 'hover:bg-gray-50 text-gray-900' 
                                  : 'text-gray-400 cursor-not-allowed'
                                }
                              `}
                            >
                              <div className="flex items-center gap-3">
                                <svg
                                  className={`w-4 h-4 ${employee.is_sync_required ? 'text-blue-500' : 'text-gray-400'}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                </svg>
                                <span className="font-medium">Sync</span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {formatLastSync(employee.last_sync)}
                              </span>
                            </button>
                            
                            <div className="border-t border-gray-100 my-1"></div>
                            
                            {employee.is_deleted ? (
                              <button
                                onClick={handleRestoreClick}
                                className="
                                  w-full px-4 py-2.5 text-left text-sm
                                  flex items-center gap-3
                                  hover:bg-green-50 text-green-600
                                  transition-colors
                                "
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                </svg>
                                <span className="font-medium">Restore</span>
                              </button>
                            ) : (
                              <button
                                onClick={handleDeleteClick}
                                className="
                                  w-full px-4 py-2.5 text-left text-sm
                                  flex items-center gap-3
                                  hover:bg-red-50 text-red-600
                                  transition-colors
                                "
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                                <span className="font-medium">Delete</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with Profile */}
            <div className="relative bg-gradient-to-br from-red-50 to-red-100/50 px-6 pt-6 pb-4">
              <div className="flex items-start gap-4">
                {/* Employee Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 rounded-full border-2 border-white overflow-hidden bg-white shadow-lg">
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt={fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className={`
                          w-full h-full ${getAvatarColor(fullName)}
                          flex items-center justify-center
                          text-white text-xl font-bold
                        `}
                      >
                        {fullName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>

                {/* Employee Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 truncate">
                    {fullName}
                  </h3>
                  <p className="text-sm text-gray-600 mt-0.5">@{employee.username}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/80 text-gray-700 border border-gray-200">
                      {employee.role}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/80 text-gray-700 border border-gray-200">
                      ID: #{employee.id.toString().padStart(4, '0')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-gray-900 mb-1">
                    Delete Employee?
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Are you sure you want to delete this employee? This action will mark the employee as deleted in the system.
                  </p>
                </div>
              </div>

              {/* Employee Details Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Email:</span>
                  <span className="text-gray-900 font-medium truncate ml-2 max-w-[200px]">
                    {employee.email || 'Not provided'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Phone:</span>
                  <span className="text-gray-900 font-medium">
                    {employee.phone || 'Not provided'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Status:</span>
                  <span className={`inline-flex items-center gap-1.5 font-medium ${employee.is_active ? 'text-green-600' : 'text-gray-600'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${employee.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    {employee.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Warning Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    This employee will be marked as deleted but their data will be preserved in the system for record-keeping purposes.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelDelete}
                  className="
                    flex-1 px-4 py-2.5
                    bg-white hover:bg-gray-50
                    text-gray-700 text-sm font-semibold
                    border border-gray-300 rounded-lg
                    transition-all duration-200
                    shadow-sm hover:shadow
                  "
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="
                    flex-1 px-4 py-2.5
                    bg-gradient-to-r from-red-600 to-red-500
                    hover:from-red-700 hover:to-red-600
                    text-white text-sm font-semibold rounded-lg
                    transition-all duration-200
                    shadow-md hover:shadow-lg
                    flex items-center justify-center gap-2
                  "
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Employee
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with Profile */}
            <div className="relative bg-gradient-to-br from-green-50 to-green-100/50 px-6 pt-6 pb-4">
              <div className="flex items-start gap-4">
                {/* Employee Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 rounded-full border-2 border-white overflow-hidden bg-white shadow-lg">
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt={fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className={`
                          w-full h-full ${getAvatarColor(fullName)}
                          flex items-center justify-center
                          text-white text-xl font-bold
                        `}
                      >
                        {fullName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                </div>

                {/* Employee Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 truncate">
                    {fullName}
                  </h3>
                  <p className="text-sm text-gray-600 mt-0.5">@{employee.username}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/80 text-gray-700 border border-gray-200">
                      {employee.role}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/80 text-gray-700 border border-gray-200">
                      ID: #{employee.id.toString().padStart(4, '0')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-gray-900 mb-1">
                    Restore Employee?
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Are you sure you want to restore this employee? This will reactivate their account and restore full access.
                  </p>
                </div>
              </div>

              {/* Employee Details Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Email:</span>
                  <span className="text-gray-900 font-medium truncate ml-2 max-w-[200px]">
                    {employee.email || 'Not provided'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Phone:</span>
                  <span className="text-gray-900 font-medium">
                    {employee.phone || 'Not provided'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Current Status:</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-red-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                    Deleted
                  </span>
                </div>
              </div>

              {/* Success Notice */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-5">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-green-800 leading-relaxed">
                    The employee will be restored and marked as active in the system. They will regain full access to their account.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelRestore}
                  className="
                    flex-1 px-4 py-2.5
                    bg-white hover:bg-gray-50
                    text-gray-700 text-sm font-semibold
                    border border-gray-300 rounded-lg
                    transition-all duration-200
                    shadow-sm hover:shadow
                  "
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRestore}
                  className="
                    flex-1 px-4 py-2.5
                    bg-gradient-to-r from-green-600 to-green-500
                    hover:from-green-700 hover:to-green-600
                    text-white text-sm font-semibold rounded-lg
                    transition-all duration-200
                    shadow-md hover:shadow-lg
                    flex items-center justify-center gap-2
                  "
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Restore Employee
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out;
        }
      `}</style>
    </>
  )
}

export default EmployeeCard
