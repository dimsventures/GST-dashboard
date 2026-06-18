'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

interface DashboardShellProps {
  children: React.ReactNode
  title?: string
}

export function DashboardShell({ children, title = 'Dashboard' }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div>
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
      />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[390] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content area shifts with sidebar */}
      <div
        style={{
          paddingLeft: collapsed ? '60px' : '200px',
          transition: 'padding-left 0.25s ease',
        }}
        className="max-md:!pl-0"
      >
        <TopBar
          title={title}
          onHamburgerClick={() => setMobileOpen(o => !o)}
        />
        {children}
      </div>
    </div>
  )
}
