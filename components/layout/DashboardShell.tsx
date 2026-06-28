'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { JarvisChat } from '@/components/features/JarvisChat'
import { WelcomeModal } from '@/components/features/WelcomeModal'

interface DashboardShellProps {
  children: React.ReactNode
  title?: string
}

export function DashboardShell({ children, title = 'Dashboard' }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="relative min-h-screen bg-[#080a14]">
      {/* Galaxy background — global, di belakang semua konten (CSS/GPU, ringan) */}
      <div className="galaxy-bg" aria-hidden="true">
        <span className="gx-dot gx-d1" /><span className="gx-dot gx-d2" /><span className="gx-dot gx-d3" />
        <span className="gx-dot gx-d4" /><span className="gx-dot gx-d5" />
      </div>
      <style>{`
        .galaxy-bg{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:radial-gradient(ellipse 95% 75% at 50% 28%,#0e1430 0%,#080a14 72%);}
        .galaxy-bg::before,.galaxy-bg::after{content:'';position:absolute;inset:0;}
        .galaxy-bg::before{background-image:
          radial-gradient(1px 1px at 24px 32px,rgba(255,255,255,.6),transparent),
          radial-gradient(1px 1px at 88px 120px,rgba(255,255,255,.45),transparent),
          radial-gradient(1.4px 1.4px at 140px 60px,rgba(180,205,255,.6),transparent),
          radial-gradient(1px 1px at 182px 158px,rgba(255,255,255,.4),transparent),
          radial-gradient(1px 1px at 52px 180px,rgba(255,255,255,.45),transparent);
          background-size:240px 240px;animation:gx-twinkle 6s ease-in-out infinite;}
        .galaxy-bg::after{background-image:
          radial-gradient(1px 1px at 60px 20px,rgba(255,255,255,.35),transparent),
          radial-gradient(1px 1px at 12px 92px,rgba(170,200,255,.45),transparent),
          radial-gradient(1.6px 1.6px at 124px 142px,rgba(255,255,255,.5),transparent),
          radial-gradient(1px 1px at 150px 42px,rgba(255,255,255,.3),transparent);
          background-size:320px 320px;animation:gx-twinkle 8s ease-in-out infinite reverse;opacity:.65;}
        @keyframes gx-twinkle{0%,100%{opacity:.4}50%{opacity:.8}}
        .gx-dot{position:absolute;width:2.5px;height:2.5px;border-radius:50%;background:rgba(200,218,255,.9);box-shadow:0 0 6px 1px rgba(160,190,255,.5);opacity:0;}
        .gx-d1{top:14%;left:16%;--dx:32vw;--dy:40vh;animation:gx-wander 18s ease-in-out infinite;animation-delay:1s;}
        .gx-d2{top:70%;left:80%;--dx:-30vw;--dy:-34vh;animation:gx-wander 23s ease-in-out infinite;animation-delay:6s;}
        .gx-d3{top:30%;left:60%;--dx:18vw;--dy:-28vh;animation:gx-wander 20s ease-in-out infinite;animation-delay:11s;}
        .gx-d4{top:82%;left:30%;--dx:-22vw;--dy:-40vh;animation:gx-wander 25s ease-in-out infinite;animation-delay:3s;}
        .gx-d5{top:20%;left:74%;--dx:-26vw;--dy:36vh;animation:gx-wander 21s ease-in-out infinite;animation-delay:14s;}
        @keyframes gx-wander{0%{opacity:0;transform:translate(0,0)}12%{opacity:.9}50%{opacity:.55}88%{opacity:0;transform:translate(var(--dx),var(--dy))}100%{opacity:0;transform:translate(var(--dx),var(--dy))}}
      `}</style>

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
        className="max-md:!pl-0 min-h-screen relative z-10"
      >
        <TopBar
          title={title}
          onHamburgerClick={() => setMobileOpen(o => !o)}
        />
        {children}
      </div>

      <JarvisChat />
      <WelcomeModal />
    </div>
  )
}
