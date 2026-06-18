import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

interface CardHeaderProps {
  title: string
  tag?: ReactNode
  action?: ReactNode
}

interface CardBodyProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-white border border-[#e4e2de] rounded-[8px] shadow-[0_1px_3px_rgba(0,0,0,.06)] overflow-hidden ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, tag, action }: CardHeaderProps) {
  return (
    <div className="px-4 py-3 border-b border-[#e4e2de] flex items-center justify-between">
      <span className="text-[10px] font-bold tracking-[.1em] uppercase text-[#4a4a4a]">
        {title}
      </span>
      {(tag || action) && (
        <div className="flex items-center gap-2">
          {tag}
          {action}
        </div>
      )}
    </div>
  )
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return (
    <div className={`p-4 ${className}`}>
      {children}
    </div>
  )
}
