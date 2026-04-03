import React from 'react'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface ModalTabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
}

const ModalTabs: React.FC<ModalTabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div className="flex gap-1 border-b border-gray-100 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-150 border-b-2 -mb-px
            ${activeTab === tab.id
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
          {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default ModalTabs