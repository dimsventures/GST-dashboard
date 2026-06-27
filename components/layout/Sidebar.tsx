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
type NavSection = { title: string | null; items: NavItem[] }

const SECTIONS: NavSection[] = [
  { title: null, items: [{ Icon: HomeIcon, label: 'Dashboard', href: '/dashboard' }] },
  { title: 'Productivity', items: [{ Icon: DumbbellIcon, label: 'Sh*t Things', href: '/gst' }] },
  {
    title: 'Finance', items: [
      { Icon: WalletIcon, label: 'Budget', href: '/budget' },
      { Icon: DollarIcon, label: 'Finance', href: '/finance' },
      { Icon: TrendUpIcon, label: 'Portfolio', href: '/portfolio' },
    ],
  },
  {
    title: 'Investment', items: [
      { Icon: GlobeIcon, label: 'Macro', href: '/macro' },
      { Icon: ScaleIcon, label: 'Valuation', href: '/valuation' },
    ],
  },
  { title: 'Agent', items: [{ Icon: GraphIcon, label: 'Mind', href: '/garden' }] },
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
  const [nudge, setNudge] = useState<{ tag: string; color: string; text: string } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

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

  // Bubble auto-rotate: ganti random tiap 5 detik dari to-do/learning/bulanan/tahunan/big dream
  useEffect(() => {
    const pool = [
      ...rem.todos.map(t => ({ tag: 'To-Do', color: '#34d399', text: t.text })),
      ...rem.learning.map(t => ({ tag: 'Learning', color: '#a3e635', text: t.text })),
      ...rem.mGoals.map(g => ({ tag: 'Bulanan', color: '#3e6df0', text: g.text })),
      ...rem.yGoals.map(g => ({ tag: 'Tahunan', color: '#f0b429', text: g.text })),
      ...rem.dreams.map(w => ({ tag: 'Big Dream', color: '#ec4899', text: w.text })),
    ]
    const roll = () => setNudge(pool.length ? pool[Math.floor(Math.random() * pool.length)] : { tag: '', color: '#34d399', text: 'Semua udah kelar! 🎉' })
    roll()
    const iv = setInterval(roll, 5000)
    return () => clearInterval(iv)
  }, [rem])

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/login'
  }

  const col = (title: string, color: string, items: RItem[], empty: string) => (
    <div className="sb-pop-col">
      <div className="sb-pop-ct" style={{ color }}>{title} <span className="sb-pop-cn">{items.length}</span></div>
      <div className="sb-pop-list">
        {items.length
          ? items.map((it, i) => <div className="sb-pop-it" key={it.id || i}><span className="sb-pop-dot" style={{ background: color }} />{it.text}</div>)
          : <div className="sb-pop-empty">{empty}</div>}
      </div>
    </div>
  )

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
      <nav className="py-2.5 flex-1 px-2.5 overflow-y-auto">
        {SECTIONS.map((sec, si) => (
          <div key={si} className={si > 0 ? 'mt-3.5' : ''}>
            {!collapsed && sec.title && (
              <div className="px-3.5 mb-1.5 text-[8.5px] font-bold tracking-[.14em] uppercase text-white/30 select-none">{sec.title}</div>
            )}
            {collapsed && si > 0 && <div className="mx-3 mb-2 border-t border-white/8" />}
            <div className="space-y-1">
              {sec.items.map((item) => {
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
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: cat agent + user + logout */}
      {!collapsed && (
        <div className="sb-bottom">
          {nudge && (
            <div className="sb-nudge" key={nudge.text} onClick={() => setModalOpen(true)} title="Klik buat rincian lengkap">
              <div className="sb-nudge-q">psst… mau ngerjain ini? 🐾</div>
              {nudge.tag && <span className="sb-nudge-tag" style={{ color: nudge.color, borderColor: nudge.color + '66', background: nudge.color + '1f' }}>{nudge.tag}</span>}
              <div className="sb-nudge-t">{nudge.text}</div>
            </div>
          )}
          <button className="sb-cat" onClick={() => setModalOpen(true)} title="Lihat semua yang belum kelar" aria-label="Pengingat">
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

    {modalOpen && (
      <div className="sb-pop-ov" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
        <div className="sb-pop">
          <div className="sb-pop-hd"><span>🐱 Yang masih nungguin lu{username ? ', ' + username : ''}…</span><button className="sb-pop-x" onClick={() => setModalOpen(false)}>✕</button></div>
          <div className="sb-pop-grid">
            {col('✦ Big Dream', '#ec4899', rem.dreams, 'Semua dream ke-realize 🎉')}
            {col('◎ Goal Tahunan', '#f0b429', rem.yGoals, 'Goal tahun ini kelar 🎉')}
            {col('◉ Goal Bulanan', '#3e6df0', rem.mGoals, 'Goal bulan ini kelar 🎉')}
            <div className="sb-pop-col">
              <div className="sb-pop-ct" style={{ color: '#34d399' }}>✓ To-Do + Learning <span className="sb-pop-cn">{rem.todos.length + rem.learning.length}</span></div>
              <div className="sb-pop-list">
                {rem.todos.map((it, i) => <div className="sb-pop-it" key={'t' + (it.id || i)}><span className="sb-pop-dot" style={{ background: '#34d399' }} />{it.text}</div>)}
                {rem.learning.map((it, i) => <div className="sb-pop-it" key={'l' + (it.id || i)}><span className="sb-pop-tag">learn</span>{it.text}</div>)}
                {!rem.todos.length && !rem.learning.length && <div className="sb-pop-empty">Semua task kelar 🎉</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    <style>{`
      .sb-bottom{position:relative;}
      .sb-cat{position:absolute;top:-26px;left:50%;transform:translateX(-50%);z-index:1;background:none;border:none;padding:0;cursor:pointer;filter:drop-shadow(0 3px 7px rgba(0,0,0,.55));transition:transform .15s;}
      .sb-cat:hover{transform:translateX(-50%) translateY(-3px);}
      .sb-bottom-box{position:relative;z-index:2;background:#0c1428;box-shadow:0 -7px 20px rgba(0,0,0,.5);}
      .sb-nudge{position:absolute;bottom:calc(100% + 30px);left:50%;transform:translateX(-50%);width:calc(100% - 16px);z-index:5;background:#163457;border:1px solid rgba(122,162,255,.42);border-radius:12px;padding:9px 11px;box-shadow:0 8px 24px rgba(0,0,0,.5);cursor:pointer;animation:sb-pop-in .22s ease;}
      .sb-nudge::after{content:'';position:absolute;top:100%;left:50%;width:13px;height:13px;background:#163457;border-right:1px solid rgba(122,162,255,.42);border-bottom:1px solid rgba(122,162,255,.42);transform:translate(-50%,-50%) rotate(45deg);}
      @keyframes sb-pop-in{from{opacity:0;transform:translateX(-50%) translateY(6px) scale(.96)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
      .sb-nudge-q{font-size:9px;font-weight:600;color:#9fb4e8;letter-spacing:.02em;margin-bottom:5px;}
      .sb-nudge-tag{display:inline-block;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:1px 6px;border-radius:6px;border:1px solid;margin-bottom:4px;}
      .sb-nudge-t{font-size:11px;font-weight:500;color:#eef0f5;line-height:1.4;word-break:break-word;}
      .sb-pop-ov{position:fixed;inset:0;z-index:600;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(3px);padding:24px;}
      .sb-pop{width:100%;max-width:860px;max-height:80vh;display:flex;flex-direction:column;background:#0e1324;border:1px solid rgba(122,162,255,.28);border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;}
      .sb-pop-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.08);font-size:13px;font-weight:700;color:#eef0f5;}
      .sb-pop-x{background:none;border:none;color:#687087;font-size:16px;cursor:pointer;line-height:1;}
      .sb-pop-grid{display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden;flex:1;min-height:0;}
      .sb-pop-col{display:flex;flex-direction:column;min-height:0;border-right:1px solid rgba(255,255,255,.06);padding:12px 12px 14px;overflow:hidden;}
      .sb-pop-col:last-child{border-right:none;}
      .sb-pop-ct{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px;}
      .sb-pop-cn{font-size:9px;font-weight:700;color:#687087;background:rgba(255,255,255,.06);padding:1px 6px;border-radius:8px;}
      .sb-pop-list{display:flex;flex-direction:column;gap:7px;overflow-y:auto;min-height:0;}
      .sb-pop-it{display:flex;align-items:flex-start;gap:7px;font-size:11.5px;color:#cbd2e0;line-height:1.45;}
      .sb-pop-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:4px;}
      .sb-pop-tag{font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#a3e635;background:rgba(163,230,53,.12);border:1px solid rgba(163,230,53,.3);padding:1px 5px;border-radius:5px;flex-shrink:0;margin-top:1px;}
      .sb-pop-empty{font-size:10.5px;color:#687087;font-style:italic;line-height:1.5;}
      @media(max-width:768px){.sb-pop-grid{grid-template-columns:1fr 1fr;}}
    `}</style>
    </>
  )
}
