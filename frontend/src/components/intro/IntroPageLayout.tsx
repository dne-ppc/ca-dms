/**
 * IntroPageLayout Component
 * Responsive grid layout for intro page sections
 */
import React from 'react'
import { cn } from '@/lib/utils'

interface IntroPageLayoutProps {
  children: React.ReactNode
  variant: 'desktop' | 'tablet' | 'mobile'
  className?: string
}

export const IntroPageLayout: React.FC<IntroPageLayoutProps> = ({
  children,
  variant,
  className
}) => {
  const layoutClasses = cn(
    'intro-page-layout',
    'min-h-screen',
    'bg-gray-50',
    'p-4',
    {
      'container mx-auto max-w-7xl': variant === 'desktop',
      'container mx-auto max-w-4xl': variant === 'tablet',
      'px-2': variant === 'mobile'
    },
    className // This includes theme and layout classes from parent
  )

  return (
    <div data-testid="intro-page-layout" className={layoutClasses}>
      {children}
    </div>
  )
}