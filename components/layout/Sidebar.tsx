'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

type NavItem = { icon: string; label: string; href: string }

const NAV: NavItem[] = [
  { icon: '🏠', label: 'Dashboard', href: '/dashboard' },
  { icon: '💪', label: 'GST', href: '/gst' },
  { icon: '💵', label: 'Finance', href: '/finance' },
  { icon: '📈', label: 'Portfolio', href: '/portfolio' },
  { icon: '👤', label: 'Profil', href: '/profile' },
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
        'fixed top-0 bottom-0 left-0 z-[400]',
        'flex flex-col bg-[#0c1428] border-r border-white/8',
        'transition-[left,width] duration-[250ms] ease-in-out',
        collapsed ? 'md:w-[60px] md:overflow-hidden' : 'md:w-[200px]',
        'max-md:w-[200px]',
        mobileOpen ? 'max-md:left-0' : 'max-md:-left-[220px]',
      ].join(' ')}
    >
      {/* Brand */}
      <div
        className="h-[52px] flex items-center px-5 border-b border-white/8 shrink-0 cursor-pointer select-none hover:bg-white/4 transition-colors duration-150"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed
          ? <span className="text-[#3e6df0] font-bold text-sm w-full text-center">G</span>
          : <span className="text-sm font-bold text-white tracking-[.05em]">GST<em className="text-[#3e6df0] not-italic">.</em></span>
        }
      </div>

      {/* Nav */}
      <nav className="py-2.5 flex-1 px-2.5 space-y-1">
        {NAV.map((item) => {
          const isActive = pathname === item.href
          return (
            <a
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 py-2.5 text-[13px] font-semibold tracking-[.03em] rounded-xl transition-all duration-150 no-underline',
                collapsed ? 'justify-center px-0' : 'px-3.5',
                isActive
                  ? 'text-white bg-[#3e6df0] shadow-[0_2px_10px_rgba(62,109,240,.35)]'
                  : 'text-white/55 hover:text-white hover:bg-white/5',
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
        <div className="p-3 border-t border-white/8">
          {username && (
            <div
              className="text-[10px] text-white/35 mb-2 truncate cursor-pointer hover:text-white/60 transition-colors"
              onClick={() => { window.location.href = '/profile' }}
            >
              {username}
            </div>
          )}
          <button
            onClick={logout}
            className="w-full bg-transparent border border-white/10 py-1.5 rounded-[5px] text-[10px] font-semibold text-white/55 cursor-pointer tracking-[.04em] hover:bg-white/5 hover:text-white transition-all duration-150"
          >
            Logout
          </button>
        </div>
      )}
    </aside>
  )
}
