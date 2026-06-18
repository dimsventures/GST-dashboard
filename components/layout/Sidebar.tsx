'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

type NavItem = { icon: string; label: string; href: string }

const NAV: NavItem[] = [
  { icon: '⊞', label: 'Dashboard', href: '/dashboard.html' },
  { icon: '◎', label: 'GST', href: '/legacy.html' },
  { icon: '◈', label: 'Finance', href: '/finance.html' },
  { icon: '◉', label: 'Portfolio', href: '/portfolio.html' },
  { icon: '◯', label: 'Profil', href: '/profile.html' },
]

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function Sidebar({ mobileOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const [username, setUsername] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u?.name) setUsername(u.name) })
      .catch(() => {})
  }, [])

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/login'
  }

  return (
    <aside
      className={[
        // Base: fixed, always left-0 on desktop
        'fixed top-0 bottom-0 left-0 z-[400]',
        'flex flex-col bg-white border-r border-[#e4e2de]',
        'transition-[left,width] duration-[250ms] ease-in-out',
        // Desktop width (varies with collapsed state)
        collapsed ? 'md:w-[60px] md:overflow-hidden' : 'md:w-[200px]',
        // Mobile: always 200px wide, slide in/out via left
        'max-md:w-[200px]',
        mobileOpen ? 'max-md:left-0' : 'max-md:-left-[220px]',
      ].join(' ')}
    >
      {/* Brand / collapse toggle */}
      <div
        className="h-[52px] flex items-center px-5 border-b border-[#e4e2de] shrink-0 cursor-pointer select-none hover:bg-[#f5f4f2] transition-colors duration-150"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed
          ? <span className="text-[#d12b2b] font-bold text-sm w-full text-center">G</span>
          : <span className="text-sm font-bold text-[#1a1a1a] tracking-[.05em]">GST<em className="text-[#d12b2b] not-italic">.</em></span>
        }
      </div>

      {/* Nav */}
      <nav className="py-2.5 flex-1">
        {NAV.map((item) => {
          const isActive = pathname === item.href
          return (
            <a
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 py-2.5 text-[13px] font-semibold tracking-[.03em] border-l-[3px] transition-all duration-150 no-underline',
                collapsed ? 'justify-center px-0' : 'px-5',
                isActive
                  ? 'text-[#d12b2b] bg-[#fef2f2] border-l-[#d12b2b]'
                  : 'text-[#4a4a4a] border-l-transparent hover:text-[#1a1a1a] hover:bg-[#f5f4f2]',
              ].join(' ')}
            >
              <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </a>
          )
        })}
      </nav>

      {/* Bottom: user + logout */}
      {!collapsed && (
        <div className="p-3 border-t border-[#e4e2de]">
          {username && (
            <div
              className="text-[10px] text-[#888] mb-2 truncate cursor-pointer hover:text-[#1a1a1a] transition-colors"
              onClick={() => { window.location.href = '/profile.html' }}
            >
              {username}
            </div>
          )}
          <button
            onClick={logout}
            className="w-full bg-transparent border border-[#e4e2de] py-1.5 rounded-[5px] text-[10px] font-semibold text-[#4a4a4a] cursor-pointer tracking-[.04em] hover:bg-[#f5f4f2] transition-all duration-150"
          >
            Logout
          </button>
        </div>
      )}
    </aside>
  )
}
