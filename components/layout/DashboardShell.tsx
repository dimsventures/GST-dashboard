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
    <div className="bg-[#0a0a0a] min-h-screen">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
      />

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[390] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        style={{
          paddingLeft: collapsed ? '60px' : '200px',
          transition: 'padding-left 0.25s ease',
        }}
        className="max-md:!pl-0 min-h-screen"
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
