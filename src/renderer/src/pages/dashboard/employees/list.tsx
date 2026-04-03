import EmployeeCard from '@renderer/components/employees/card'
import ToastContainer, { ToastMessage } from '@renderer/components/toast/toast-container'
import { useEffect, useState } from 'react'

type Employee = {
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

const Employees = () => {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // Toast helper functions
  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  useEffect(() => {
    const load = async () => {
      try {
        const res = await window.api.employees.get({
          page: 1,
          limit: 20
        })
        if (res.success && res.data) {
          setEmployees(res.data.employees)
        } else {
          addToast('Failed to load employees', 'error')
        }
      } catch (error) {
        console.error('Failed to load employees:', error)
        addToast('An error occurred while loading employees', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleDelete = async (employeeId: number) => {
    try {
      // Get employee name for notification
      const employee = employees.find(emp => emp.id === employeeId)
      const employeeName = employee
        ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.username
        : 'Employee'

      // Your delete API call here
      // const res = await window.api.employees.delete(employeeId)
      const res = await window.api.employees.delete({ id: employeeId })
      // if (!res.success) {
      //   throw new Error(res.error || 'Failed to delete employee')
      // }

      if (!res.success) {
        throw new Error(res.message || 'Failed to delete employee')
      }
      
      // Simulate API call for demo
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Update local state to mark as deleted
      setEmployees(prev => 
        prev.map(emp => 
          emp.id === employeeId 
            ? { ...emp, is_deleted: true } 
            : emp
        )
      )
      
      // Close expanded view if this employee was expanded
      if (expandedId === employeeId) {
        setExpandedId(null)
      }

      // Show success notification
      addToast(`${employeeName} has been deleted successfully`, 'success')
    } catch (error) {
      console.error('Failed to delete employee:', error)
      addToast(
        error instanceof Error ? error.message : 'Failed to delete employee',
        'error'
      )
    }
  }

  const handleRestore = async (employeeId: number) => {
    try {
      // Get employee name for notification
      const employee = employees.find(emp => emp.id === employeeId)
      const employeeName = employee
        ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.username
        : 'Employee'

      // Your restore API call here
      const res = await window.api.employees.delete({ id: employeeId, restore: true })
      if (!res.success) {
        throw new Error(res.message || 'Failed to restore employee')
      }
      
      // Simulate API call for demo
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Update local state to mark as not deleted
      setEmployees(prev => 
        prev.map(emp => 
          emp.id === employeeId 
            ? { ...emp, is_deleted: false } 
            : emp
        )
      )

      // Close expanded view if this employee was expanded
      if (expandedId === employeeId) {
        setExpandedId(null)
      }

      // Show success notification
      addToast(`${employeeName} has been restored successfully`, 'success')
    } catch (error) {
      console.error('Failed to restore employee:', error)
      addToast(
        error instanceof Error ? error.message : 'Failed to restore employee',
        'error'
      )
    }
  }

  const filteredEmployees = employees.filter((emp) => {
    const searchLower = search.toLowerCase()
    return (
      search === '' ||
      emp.username.toLowerCase().includes(searchLower) ||
      emp.first_name?.toLowerCase().includes(searchLower) ||
      emp.last_name?.toLowerCase().includes(searchLower) ||
      emp.email?.toLowerCase().includes(searchLower) ||
      emp.role.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      {/* Enhanced Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                Employees
              </h1>
              <p className="text-sm text-gray-600 mt-1.5 flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {filteredEmployees.length} {filteredEmployees.length === 1 ? 'member' : 'members'}
                </span>
                {search && (
                  <span className="text-gray-500 hidden sm:inline">
                    • Filtered from {employees.length} total
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {/* Search Input */}
              <div className="relative flex-1 sm:flex-initial">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="
                    w-full sm:w-64 lg:w-72 pl-10 pr-10 py-2.5
                    text-sm
                    border border-gray-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-all duration-200
                    bg-white
                  "
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Add Button */}
              <button className="
                px-3 sm:px-5 py-2.5
                bg-gradient-to-r from-blue-600 to-blue-500
                hover:from-blue-700 hover:to-blue-600
                text-white text-sm font-semibold rounded-lg
                transition-all duration-200
                shadow-md hover:shadow-lg
                flex items-center gap-2
                whitespace-nowrap
              ">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Add Employee</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Header - Desktop Only */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
            <div className="col-span-1">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Avatar
              </span>
            </div>
            <div className="col-span-3">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Full Name
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Username
              </span>
            </div>
            <div className="col-span-3">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Role
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Email
              </span>
            </div>
            <div className="col-span-1">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </span>
            </div>
          </div>

          {/* Employee List */}
          <div>
            {loading ? (
              // Enhanced Loading Skeleton
              <div className="divide-y divide-gray-100">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-4 md:px-6 py-4 animate-pulse">
                    <div className="md:col-span-1 flex items-center gap-3 md:gap-0">
                      <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                      <div className="md:hidden flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                      </div>
                    </div>
                    <div className="hidden md:block md:col-span-3 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                    </div>
                    <div className="hidden md:block md:col-span-2">
                      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    </div>
                    <div className="md:col-span-3">
                      <div className="h-6 bg-gray-200 rounded-full w-24"></div>
                    </div>
                    <div className="hidden lg:block md:col-span-2">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                    </div>
                    <div className="md:col-span-1">
                      <div className="h-8 w-8 bg-gray-200 rounded-full ml-auto"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEmployees.length === 0 ? (
              // Enhanced Empty State
              <div className="py-12 sm:py-20 px-4 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-7.125a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  {search ? 'No employees found' : 'No employees yet'}
                </h3>
                <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                  {search
                    ? `No results match "${search}". Try adjusting your search.`
                    : 'Get started by adding your first team member to the system.'}
                </p>
                {search ? (
                  <button
                    onClick={() => setSearch('')}
                    className="
                      inline-flex items-center gap-2 px-4 py-2
                      text-sm font-medium text-blue-600 hover:text-blue-700
                      bg-blue-50 hover:bg-blue-100 rounded-lg
                      transition-colors duration-200
                    "
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear search
                  </button>
                ) : (
                  <button className="
                    inline-flex items-center gap-2 px-4 sm:px-5 py-2.5
                    bg-gradient-to-r from-blue-600 to-blue-500
                    hover:from-blue-700 hover:to-blue-600
                    text-white text-sm font-semibold rounded-lg
                    transition-all duration-200 shadow-md hover:shadow-lg
                  ">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add your first employee
                  </button>
                )}
              </div>
            ) : (
              // Employee Cards
              <div className="divide-y divide-gray-100">
                {filteredEmployees.map((emp) => (
                  <EmployeeCard
                    key={emp.id}
                    employee={emp}
                    expanded={expandedId === emp.id}
                    onToggle={() =>
                      setExpandedId(expandedId === emp.id ? null : emp.id)
                    }
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        {!loading && filteredEmployees.length > 0 && (
          <div className="mt-4 sm:mt-6 text-center text-sm text-gray-500">
            Showing {filteredEmployees.length} of {employees.length} employees
          </div>
        )}
      </div>
    </div>
  )
}

export default Employees