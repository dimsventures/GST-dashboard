import { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant: 'red' | 'green' | 'gold'
}

const variantClasses = {
  red: 'bg-[#fef2f2] text-[#d12b2b] border-[#fad4d4]',
  green: 'bg-[#f0fdf4] text-[#15a34a] border-[#bbf7d0]',
  gold: 'bg-[#fffbf0] text-[#c9841a] border-[#f0d88a]',
}

export function Badge({ children, variant }: BadgeProps) {
  return (
    <span
      className={`text-[9px] px-2 py-[2px] rounded-[20px] font-semibold tracking-[.03em] border ${variantClasses[variant]}`}
    >
      {children}
    </span>
  )
}
