/**
 * Tests for lib/utils.ts utility functions
 * Tests the cn() function for className merging
 */
import { describe, it, expect } from 'vitest'
import { cn } from '../../lib/utils'

describe('lib/utils', () => {
  describe('cn function', () => {
    it('should merge simple class names', () => {
      const result = cn('class1', 'class2', 'class3')
      expect(result).toBe('class1 class2 class3')
    })

    it('should handle conditional classes', () => {
      const isActive = true
      const isDisabled = false

      const result = cn(
        'base-class',
        isActive && 'active',
        isDisabled && 'disabled'
      )

      expect(result).toBe('base-class active')
    })

    it('should handle undefined and null values', () => {
      const result = cn('class1', undefined, 'class2', null, 'class3')
      expect(result).toBe('class1 class2 class3')
    })

    it('should handle empty strings', () => {
      const result = cn('class1', '', 'class2')
      expect(result).toBe('class1 class2')
    })

    it('should merge Tailwind CSS classes with conflicts', () => {
      // When there are conflicting Tailwind classes, twMerge should handle them
      const result = cn('px-2 py-1', 'px-4')

      // twMerge should remove conflicting classes and keep the last one
      expect(result).toBe('py-1 px-4')
    })

    it('should handle complex Tailwind CSS conflicts', () => {
      const result = cn(
        'bg-red-500 text-white',
        'bg-blue-500',
        'hover:bg-green-500'
      )

      // Should merge properly, removing conflicting bg colors
      expect(result).toBe('text-white bg-blue-500 hover:bg-green-500')
    })

    it('should handle responsive Tailwind classes', () => {
      const result = cn(
        'text-sm md:text-base lg:text-lg',
        'text-xs md:text-sm'
      )

      // Should handle responsive breakpoint conflicts
      expect(result).toContain('lg:text-lg')
      expect(result).toContain('text-xs')
      expect(result).toContain('md:text-sm')
    })

    it('should work with clsx object syntax', () => {
      const result = cn({
        'class1': true,
        'class2': false,
        'class3': true
      })

      expect(result).toBe('class1 class3')
    })

    it('should work with clsx array syntax', () => {
      const result = cn([
        'class1',
        'class2',
        ['class3', 'class4']
      ])

      expect(result).toBe('class1 class2 class3 class4')
    })

    it('should handle mixed input types', () => {
      const isActive = true
      const theme = 'dark'

      const result = cn(
        'base',
        {
          'active': isActive,
          'inactive': !isActive
        },
        theme === 'dark' && 'dark-theme',
        ['additional', 'classes']
      )

      expect(result).toBe('base active dark-theme additional classes')
    })

    it('should handle component variant patterns', () => {
      const variant = 'primary'
      const size = 'lg'
      const disabled = false

      const result = cn(
        'btn',
        {
          'btn-primary': variant === 'primary',
          'btn-secondary': variant === 'secondary',
          'btn-sm': size === 'sm',
          'btn-lg': size === 'lg',
          'btn-disabled': disabled
        }
      )

      expect(result).toBe('btn btn-primary btn-lg')
    })

    it('should handle Tailwind CSS prefix conflicts correctly', () => {
      const result = cn(
        'm-2 mx-4 my-6',
        'mx-8'
      )

      // Should handle margin conflicts properly
      expect(result).toContain('my-6')
      expect(result).toContain('mx-8')
      expect(result).not.toContain('m-2')
      expect(result).not.toContain('mx-4')
    })

    it('should handle spacing conflicts', () => {
      const result = cn(
        'p-4 px-2 py-3',
        'px-6'
      )

      expect(result).toContain('py-3')
      expect(result).toContain('px-6')
      expect(result).not.toContain('p-4')
      expect(result).not.toContain('px-2')
    })

    it('should handle color conflicts', () => {
      const result = cn(
        'text-red-500 bg-blue-200',
        'text-green-600',
        'bg-yellow-300'
      )

      expect(result).toBe('text-green-600 bg-yellow-300')
    })

    it('should preserve non-conflicting classes', () => {
      const result = cn(
        'font-bold underline cursor-pointer',
        'text-lg bg-red-500',
        'hover:bg-red-600'
      )

      expect(result).toBe('font-bold underline cursor-pointer text-lg bg-red-500 hover:bg-red-600')
    })

    it('should handle component state classes', () => {
      const isLoading = true
      const hasError = false
      const isSuccess = false

      const result = cn(
        'btn',
        'bg-blue-500 text-white',
        {
          'opacity-50 cursor-not-allowed': isLoading,
          'bg-red-500': hasError,
          'bg-green-500': isSuccess
        }
      )

      expect(result).toBe('btn text-white opacity-50 cursor-not-allowed bg-blue-500')
    })

    it('should handle dark mode classes', () => {
      const isDark = true

      const result = cn(
        'bg-white text-black',
        isDark && 'dark:bg-gray-900 dark:text-white'
      )

      expect(result).toBe('bg-white text-black dark:bg-gray-900 dark:text-white')
    })

    it('should work with complex component scenarios', () => {
      interface ButtonProps {
        variant: 'primary' | 'secondary' | 'ghost'
        size: 'sm' | 'md' | 'lg'
        disabled?: boolean
        loading?: boolean
        className?: string
      }

      const createButtonClasses = (props: ButtonProps) => {
        return cn(
          // Base classes
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',

          // Variant classes
          {
            'bg-primary text-primary-foreground hover:bg-primary/90': props.variant === 'primary',
            'bg-secondary text-secondary-foreground hover:bg-secondary/80': props.variant === 'secondary',
            'hover:bg-accent hover:text-accent-foreground': props.variant === 'ghost'
          },

          // Size classes
          {
            'h-8 px-3 text-xs': props.size === 'sm',
            'h-10 px-4 py-2': props.size === 'md',
            'h-11 px-8': props.size === 'lg'
          },

          // State classes
          {
            'pointer-events-none opacity-50': props.disabled || props.loading,
            'cursor-wait': props.loading
          },

          // Custom className
          props.className
        )
      }

      const classes = createButtonClasses({
        variant: 'primary',
        size: 'lg',
        loading: true,
        className: 'shadow-lg'
      })

      expect(classes).toContain('inline-flex')
      expect(classes).toContain('bg-primary')
      expect(classes).toContain('h-11')
      expect(classes).toContain('pointer-events-none')
      expect(classes).toContain('shadow-lg')
    })

    it('should handle empty inputs', () => {
      expect(cn()).toBe('')
      expect(cn('')).toBe('')
      expect(cn(undefined)).toBe('')
      expect(cn(null)).toBe('')
    })

    it('should handle boolean false values', () => {
      const result = cn('class1', false, 'class2')
      expect(result).toBe('class1 class2')
    })

    it('should handle numeric values', () => {
      const result = cn('class1', 0, 'class2', 1)
      expect(result).toBe('class1 class2 1')
    })

    it('should be performant with many classes', () => {
      const start = performance.now()

      const result = cn(
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
        'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
        'u', 'v', 'w', 'x', 'y', 'z'
      )

      const end = performance.now()

      expect(end - start).toBeLessThan(10) // Should be very fast
      expect(result).toContain('a')
      expect(result).toContain('z')
    })

    it('should handle edge case with duplicate classes', () => {
      const result = cn('class1', 'class2', 'class1', 'class3')

      // Should remove duplicates
      const classes = result.split(' ')
      const uniqueClasses = [...new Set(classes)]

      expect(classes.filter(c => c === 'class1')).toHaveLength(1)
    })
  })
})