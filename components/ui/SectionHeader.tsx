import { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  action?: ReactNode
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-[10px] font-bold tracking-[.1em] uppercase text-[#4a4a4a]">
        {title}
      </span>
      {action && <div>{action}</div>}
    </div>
  )
}
