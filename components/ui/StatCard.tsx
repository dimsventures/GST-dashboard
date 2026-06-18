interface StatCardProps {
  value: string | number
  label: string
  variant?: 'default' | 'gold' | 'muted'
  onClick?: () => void
}

const variantClasses = {
  default: 'text-white',
  gold: 'text-[#fde68a]',
  muted: 'text-[#fecaca]',
}

export function StatCard({ value, label, variant = 'default', onClick }: StatCardProps) {
  return (
    <div
      className={[
        'bg-white/12 border border-white/18 rounded-[5px] px-2.5 py-[9px] transition-all duration-150',
        onClick ? 'cursor-pointer hover:border-white/40 hover:-translate-y-px' : '',
      ].join(' ')}
      onClick={onClick}
    >
      <div className={`text-[20px] font-bold leading-none ${variantClasses[variant]}`}>
        {value}
      </div>
      <div className="text-[9px] font-semibold tracking-[.06em] text-white/60 mt-1 uppercase">
        {label}
      </div>
    </div>
  )
}
