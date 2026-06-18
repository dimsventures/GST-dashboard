interface PageWrapperProps {
  children: React.ReactNode
  className?: string
}

export function PageWrapper({ children, className = '' }: PageWrapperProps) {
  return (
    <main className={`p-5 md:p-6 ${className}`}>
      {children}
    </main>
  )
}
