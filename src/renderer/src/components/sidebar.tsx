import {
  Award, BarChart3, Briefcase, ChevronDown, ChevronLeft, ChevronRight,
  DollarSign, FeatherIcon, FileText, LayoutDashboard, LogOut, Package,
  Settings, ShoppingCart, TrendingUp, UserPlus, Users
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useSidebar } from '@renderer/contexts/sidebar.context'

interface NavItem {
  to: string
  text: string
  icon: React.ComponentType<{ className?: string }>
  dropdown?: { to: string; text: string }[]
  nestedDropdown?: { text: string; items: { to: string; text: string }[] }[]
}

const Sidebar = () => {
  const navigate = useNavigate()
  const { isCollapsed, setIsCollapsed } = useSidebar() // ← from context
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [openNestedDropdown, setOpenNestedDropdown] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    general: true,
    management: false,
    tools: false
  })

  const isProSubscriber: boolean = false

  const preventCopy = (e: React.ClipboardEvent) => e.preventDefault()
  const handleLogout = () => navigate('/login')

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const toggleDropdown = (text: string, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation() }
    setOpenDropdown(openDropdown === text ? null : text)
    setOpenNestedDropdown(null)
  }

  const toggleNestedDropdown = (text: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpenNestedDropdown(openNestedDropdown === text ? null : text)
  }

  const generalNavItems: NavItem[] = [
    { to: 'overview', text: 'Inventories', icon: Package },
    {
      to: 'users', text: 'Employees', icon: Users,
      dropdown: [
        { to: 'employees/create', text: 'Add Employees' },
        { to: 'employees', text: 'View Employees' }
      ]
    },
    { to: 'attributes', text: 'Attributes', icon: FeatherIcon },
    {
      to: 'products', text: 'Products', icon: ShoppingCart,
      nestedDropdown: [
        { text: 'Categories', items: [{ to: 'products/categories', text: 'Categories' }] },
        { text: 'Products', items: [{ to: 'products', text: 'Products' }] },
        { text: 'Stock Purchases', items: [{ to: 'products/stock-purchases', text: 'Stock Purchases' }] }
      ]
    },
    {
      to: 'people', text: 'people', icon: UserPlus,
      dropdown: [
        { to: 'people/suppliers', text: 'Suppliers' },
        { to: 'people/customers', text: 'Customers' }
      ]
    },
    { to: 'sales', text: 'Sales', icon: TrendingUp },
    {
      to: 'cashflow', text: 'Cashflow', icon: DollarSign,
      dropdown: [{ to: 'finance/transactions', text: 'Cashflow' }]
    },
  ]

  const managementNavItems: NavItem[] = [
    {
      to: 'projects', text: 'Projects', icon: Briefcase,
      dropdown: [
        { to: 'projects/add', text: 'Add Project' },
        { to: 'projects', text: 'View Projects' }
      ]
    },
    { to: 'money-transfer', text: 'Money Transfer', icon: DollarSign },
    {
      to: 'reports', text: 'Reports', icon: FileText,
      dropdown: [
        { to: 'reports/generate', text: 'Generate Report' },
        { to: 'reports', text: 'View Reports' }
      ]
    },
    { to: 'settings', text: 'Settings', icon: Settings }
  ]

  const toolsNavItems: NavItem[] = [
    {
      to: 'tools/badges', text: 'Badges', icon: Award,
      dropdown: [
        { to: 'tools/badges/create', text: 'Create Badge' },
        { to: 'tools/badges', text: 'View Badges' }
      ]
    },
    { to: 'tools/analytics', text: 'Analytics', icon: BarChart3 },
    {
      to: 'tools/marketing', text: 'Marketing', icon: LayoutDashboard,
      dropdown: [
        { to: 'tools/marketing/create', text: 'Create Campaign' },
        { to: 'tools/marketing', text: 'View Campaigns' }
      ]
    }
  ]

  const renderNavItem = ({ to, text, icon: Icon, dropdown, nestedDropdown }: NavItem) => {
    const hasDropdown = dropdown || nestedDropdown
    const isOpen = openDropdown === text

    return (
      <div key={to} className="group relative">
        <div className="flex items-center">
          {hasDropdown ? (
            <button
              onClick={(e) => toggleDropdown(text, e)}
              className={`flex items-center gap-2 p-3 text-white hover:bg-white/10 rounded-lg transition-colors w-full ${
                isOpen && !isCollapsed ? 'bg-white/10' : ''
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className={`text-sm font-medium flex-1 text-left ${isCollapsed ? 'hidden' : ''}`}>
                {text}
              </span>
              {!isCollapsed && hasDropdown && (
                <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
              )}
              {isCollapsed && (
                <span className="absolute left-full ml-2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap hidden group-hover:block z-50">
                  {text}
                </span>
              )}
            </button>
          ) : (
            <NavLink
              to={`/dashboard/${to}`}
              className={({ isActive }) =>
                `flex items-center gap-2 p-3 text-white hover:bg-white/10 rounded-lg transition-colors w-full ${isActive ? 'bg-white/20' : ''}`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className={`text-sm font-medium ${isCollapsed ? 'hidden' : ''}`}>{text}</span>
              {isCollapsed && (
                <span className="absolute left-full ml-2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap hidden group-hover:block z-50">
                  {text}
                </span>
              )}
            </NavLink>
          )}
        </div>

        {dropdown && isOpen && !isCollapsed && (
          <div className="ml-6 mt-1 space-y-1">
            {dropdown.map(({ to: subTo, text: subText }) => (
              <NavLink
                key={subTo}
                to={`/dashboard/${subTo}`}
                className={({ isActive }) =>
                  `block p-2 pl-4 text-white/90 hover:bg-white/10 rounded-lg text-sm transition-colors ${isActive ? 'bg-white/20' : ''}`
                }
              >
                {subText}
              </NavLink>
            ))}
          </div>
        )}

        {nestedDropdown && isOpen && !isCollapsed && (
          <div className="ml-6 mt-1 space-y-1">
            {nestedDropdown.map(({ text: nestedText, items }) => {
              const isNestedOpen = openNestedDropdown === nestedText
              return (
                <div key={nestedText}>
                  <button
                    onClick={(e) => toggleNestedDropdown(nestedText, e)}
                    className="flex items-center justify-between gap-2 p-2 pl-4 text-white/90 hover:bg-white/10 rounded-lg text-sm w-full transition-colors"
                  >
                    <span>{nestedText}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isNestedOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isNestedOpen && (
                    <div className="ml-4 mt-1 space-y-1">
                      {items.map(({ to: subTo, text: subText }) => (
                        <NavLink
                          key={subTo}
                          to={`/dashboard/${subTo}`}
                          className={({ isActive }) =>
                            `block p-2 pl-4 text-white/80 hover:bg-white/10 rounded-lg text-sm transition-colors ${isActive ? 'bg-white/20' : ''}`
                          }
                        >
                          {subText}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`bg-gradient-to-br from-blue-900 to-blue-700 backdrop-blur-sm flex flex-col justify-between select-none transition-all duration-300 h-screen fixed top-0 left-0 z-40 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
      onCopy={preventCopy}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className={`flex-shrink-0 ${isCollapsed ? 'px-2 py-4' : 'px-6 py-6'}`}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 ${isCollapsed ? 'hidden' : ''}`}>
              <div className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-white">Plurse</span>
            </div>
            <button
              onClick={() => {
                setIsCollapsed(!isCollapsed)
                setOpenDropdown(null)
                setOpenNestedDropdown(null)
              }}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors group relative"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5 text-white" />
              ) : (
                <ChevronLeft className="w-5 h-5 text-white" />
              )}
              {isCollapsed && (
                <span className="absolute left-full ml-2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap hidden group-hover:block z-50">
                  Expand Sidebar
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${isCollapsed ? 'px-2' : 'px-6'}`}>
          <div className="space-y-4 pb-4">
            <div>
              <button
                onClick={() => toggleSection('general')}
                className={`flex items-center justify-between w-full mb-2 group ${isCollapsed ? 'justify-center' : ''}`}
              >
                {!isCollapsed && (
                  <>
                    <span className="text-xs font-bold text-white/70 uppercase tracking-wider">General</span>
                    <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${openSections.general ? 'rotate-180' : ''}`} />
                  </>
                )}
                {isCollapsed && (
                  <div className="h-px bg-white/30 w-full relative group">
                    <span className="absolute left-full ml-2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap hidden group-hover:block z-50 top-1/2 -translate-y-1/2">
                      General
                    </span>
                  </div>
                )}
              </button>
              {openSections.general && (
                <div className="space-y-1">
                  {generalNavItems.map((item) => renderNavItem(item))}
                </div>
              )}
            </div>

            {isProSubscriber && (
              <div>
                <button
                  onClick={() => toggleSection('management')}
                  className={`flex items-center justify-between w-full mb-2 group ${isCollapsed ? 'justify-center' : ''}`}
                >
                  {!isCollapsed ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Management</span>
                        <span className="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">Pro</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${openSections.management ? 'rotate-180' : ''}`} />
                    </>
                  ) : (
                    <div className="h-px bg-yellow-500/50 w-full relative group">
                      <span className="absolute left-full ml-2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap hidden group-hover:block z-50 top-1/2 -translate-y-1/2">
                        Management (Pro)
                      </span>
                    </div>
                  )}
                </button>
                {openSections.management && (
                  <div className="space-y-1">
                    {managementNavItems.map((item) => renderNavItem(item))}
                  </div>
                )}
              </div>
            )}

            {isProSubscriber && (
              <div>
                <button
                  onClick={() => toggleSection('tools')}
                  className={`flex items-center justify-between w-full mb-2 group ${isCollapsed ? 'justify-center' : ''}`}
                >
                  {!isCollapsed ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Tools</span>
                        <span className="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">Pro</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${openSections.tools ? 'rotate-180' : ''}`} />
                    </>
                  ) : (
                    <div className="h-px bg-yellow-500/50 w-full relative group">
                      <span className="absolute left-full ml-2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap hidden group-hover:block z-50 top-1/2 -translate-y-1/2">
                        Tools (Pro)
                      </span>
                    </div>
                  )}
                </button>
                {openSections.tools && (
                  <div className="space-y-1">
                    {toolsNavItems.map((item) => renderNavItem(item))}
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Logout */}
        <div className={`flex-shrink-0 border-t border-white/10 ${isCollapsed ? 'px-2 py-4' : 'px-6 py-4'}`}>
          <button
            onClick={handleLogout}
            className="group relative flex items-center gap-2 p-3 text-white hover:bg-white/10 rounded-lg transition-colors w-full"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={`text-sm font-medium ${isCollapsed ? 'hidden' : ''}`}>Logout</span>
            {isCollapsed && (
              <span className="absolute left-full ml-2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap hidden group-hover:block z-50">
                Logout
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Sidebar