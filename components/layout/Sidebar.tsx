'use client'

import { useState, useEffect, type ReactElement } from 'react'
import { usePathname } from 'next/navigation'

type IconProps = { className?: string }

function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 11.5L12 4l8 7.5" />
      <path d="M6 10V20H18V10" />
      <path d="M10 20v-5h4v5" />
    </svg>
  )
}

function DumbbellIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="8" width="5" height="8" rx="1.5" />
      <rect x="17" y="8" width="5" height="8" rx="1.5" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  )
}

function DollarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="9" />
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="700" stroke="none" fill="currentColor">$</text>
    </svg>
  )
}

function TrendUpIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3,17 9,11 13,15 21,6" />
      <polyline points="15,6 21,6 21,12" />
    </svg>
  )
}

function WalletIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17a2 2 0 0 1 2 2v1" />
      <path d="M3 7.5V17a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2" />
      <path d="M21 9.5h-4.5a2.5 2.5 0 0 0 0 5H21z" />
      <circle cx="16.5" cy="12" r=".6" fill="currentColor" stroke="none" />
    </svg>
  )
}

function GlobeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9s1.3-6.6 3.8-9z" />
    </svg>
  )
}

function GraphIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="6" cy="7" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="17" cy="17" r="2.2" />
      <circle cx="8" cy="16" r="2.2" />
      <path d="M8 8.4l7.8 7M7.6 8.2L7 13.9M9.9 15.4L16 7.3M9.9 16.6l5 .6" />
    </svg>
  )
}

function UserIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3.1-6.5 7-6.5s7 3 7 6.5" />
    </svg>
  )
}

function ScaleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v18" />
      <path d="M7 7h10" />
      <path d="M5 7l-2.5 5.5a3 3 0 0 0 5 0L5 7z" />
      <path d="M19 7l-2.5 5.5a3 3 0 0 0 5 0L19 7z" />
      <path d="M7 21h10" />
    </svg>
  )
}

type NavItem = { Icon: (props: IconProps) => ReactElement; label: string; href: string }

const NAV: NavItem[] = [
  { Icon: HomeIcon, label: 'The Dashboard', href: '/dashboard' },
  { Icon: DumbbellIcon, label: 'The Sh*t Things', href: '/gst' },
  { Icon: WalletIcon, label: 'The Budget', href: '/budget' },
  { Icon: DollarIcon, label: 'The Finance', href: '/finance' },
  { Icon: TrendUpIcon, label: 'The Portfolio', href: '/portfolio' },
  { Icon: ScaleIcon, label: 'The Valuation', href: '/valuation' },
  { Icon: GlobeIcon, label: 'The Macro', href: '/macro' },
  { Icon: GraphIcon, label: 'The Mind', href: '/garden' },
  { Icon: UserIcon, label: 'The Profile', href: '/profile' },
]

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

type RItem = { id?: string; text: string }
type Reminders = { dreams: RItem[]; yGoals: RItem[]; mGoals: RItem[]; todos: RItem[]; learning: RItem[] }

export function Sidebar({ mobileOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const [username, setUsername] = useState('')
  const [rem, setRem] = useState<Reminders>({ dreams: [], yGoals: [], mGoals: [], todos: [], learning: [] })
  const [catOpen, setCatOpen] = useState(false)
  const [nudge, setNudge] = useState<{ tag: string; color: string; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u?.name) setUsername(u.name) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        const now = new Date(); const yr = now.getFullYear()
        const ym = `${yr}-${String(now.getMonth() + 1).padStart(2, '0')}`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = (d.goals || []) as any[]
        setRem({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dreams: (d.wishes || []).filter((w: any) => !w.done),
          yGoals: g.filter(x => x.scope === 'year' && !x.done && (!x.yr || x.yr === yr)),
          mGoals: g.filter(x => x.scope === 'month' && !x.done && (!x.ym || x.ym === ym)),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          todos: (d.todos || []).filter((t: any) => !t.done && (t.mode || 'doing') === 'doing'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          learning: (d.todos || []).filter((t: any) => !t.done && t.mode === 'learning'),
        })
      })
      .catch(() => {})
  }, [])

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/login'
  }

  function rollNudge() {
    const pool = [
      ...rem.todos.map(t => ({ tag: 'To-Do', color: '#34d399', text: t.text })),
      ...rem.learning.map(t => ({ tag: 'Learning', color: '#a3e635', text: t.text })),
      ...rem.mGoals.map(g => ({ tag: 'Goal Bulanan', color: '#3e6df0', text: g.text })),
      ...rem.yGoals.map(g => ({ tag: 'Goal Tahunan', color: '#f0b429', text: g.text })),
    ]
    setNudge(pool.length ? pool[Math.floor(Math.random() * pool.length)] : { tag: '', color: '#34d399', text: 'Semua kelar! 🎉' })
  }
  function toggleCat() {
    if (catOpen) setCatOpen(false)
    else { rollNudge(); setCatOpen(true) }
  }

  return (
    <>
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
          : <span className="text-sm font-bold tracking-[.05em]"><span className="text-white">GST</span> <span className="text-[#3e6df0]">dashboard</span></span>
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
              <span className="w-5 shrink-0 flex items-center justify-center">
                <item.Icon className="w-[18px] h-[18px]" />
              </span>
              {!collapsed && <span>{item.label}</span>}
            </a>
          )
        })}
      </nav>

      {/* Bottom: cat agent + user + logout */}
      {!collapsed && (
        <div className="sb-bottom">
          {catOpen && (
            <div className="sb-nudge" onClick={rollNudge} title="Klik buat ganti">
              <div className="sb-nudge-q">psst… mau ngerjain ini? 🐾</div>
              {nudge?.tag && <span className="sb-nudge-tag" style={{ color: nudge.color, borderColor: nudge.color + '66', background: nudge.color + '1f' }}>{nudge.tag}</span>}
              <div className="sb-nudge-t">{nudge?.text || '—'}</div>
            </div>
          )}
          <button className="sb-cat" onClick={toggleCat} title="Pengingat: yang belum kelar" aria-label="Pengingat">
            <svg viewBox="0 0 60 42" width="52" height="36">
              <path d="M11 30 L15 9 L26 22 Z" fill="#3d4868" />
              <path d="M49 30 L45 9 L34 22 Z" fill="#3d4868" />
              <path d="M8 42 Q8 17 30 17 Q52 17 52 42 Z" fill="#3d4868" />
              <circle className="sb-cat-eye" cx="22" cy="27" r="3.2" fill="#7af5d0" />
              <circle className="sb-cat-eye" cx="38" cy="27" r="3.2" fill="#7af5d0" />
              <path d="M27.5 32 L32.5 32 L30 34.5 Z" fill="#ff9bb0" />
            </svg>
          </button>
          <div className="sb-bottom-box p-3 border-t border-white/8">
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
        </div>
      )}
    </aside>

    <style>{`
      .sb-bottom{position:relative;}
      .sb-cat{position:absolute;top:-26px;left:50%;transform:translateX(-50%);z-index:1;background:none;border:none;padding:0;cursor:pointer;filter:drop-shadow(0 3px 7px rgba(0,0,0,.55));transition:transform .15s;}
      .sb-cat:hover{transform:translateX(-50%) translateY(-3px);}
      .sb-bottom-box{position:relative;z-index:2;background:#0c1428;box-shadow:0 -7px 20px rgba(0,0,0,.5);}
      .sb-nudge{position:absolute;bottom:calc(100% + 30px);left:50%;transform:translateX(-50%);width:calc(100% - 16px);z-index:5;background:#163457;border:1px solid rgba(122,162,255,.42);border-radius:12px;padding:9px 11px;box-shadow:0 8px 24px rgba(0,0,0,.5);cursor:pointer;animation:sb-pop-in .18s ease;}
      .sb-nudge::after{content:'';position:absolute;top:100%;left:50%;width:13px;height:13px;background:#163457;border-right:1px solid rgba(122,162,255,.42);border-bottom:1px solid rgba(122,162,255,.42);transform:translate(-50%,-50%) rotate(45deg);}
      @keyframes sb-pop-in{from{opacity:0;transform:translateX(-50%) translateY(6px) scale(.96)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
      .sb-nudge-q{font-size:9px;font-weight:600;color:#9fb4e8;letter-spacing:.02em;margin-bottom:5px;}
      .sb-nudge-tag{display:inline-block;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:1px 6px;border-radius:6px;border:1px solid;margin-bottom:4px;}
      .sb-nudge-t{font-size:11px;font-weight:500;color:#eef0f5;line-height:1.4;word-break:break-word;}
    `}</style>
    </>
  )
}
