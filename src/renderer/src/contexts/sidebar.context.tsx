import { createContext, useContext, useState } from 'react'

interface SidebarContextType {
  isCollapsed: boolean
  setIsCollapsed: (v: boolean) => void
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {}
})

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)