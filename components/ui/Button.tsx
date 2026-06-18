import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  children: ReactNode
}

const variantClasses = {
  primary: 'bg-[#d12b2b] text-white border-transparent hover:bg-[#b32222] disabled:bg-[#d0cdc8]',
  secondary: 'bg-transparent text-[#1a1a1a] border-[#e4e2de] hover:border-[#1a1a1a]',
  ghost: 'bg-transparent text-[#4a4a4a] border-transparent hover:bg-[#f5f4f2]',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-[10px] rounded-[5px]',
  md: 'px-4 py-2 text-xs rounded-[8px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'border font-semibold tracking-[.04em] cursor-pointer transition-all duration-150 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
