import { useState } from 'react'

interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

let toastCount = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = ({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
    const id = `toast-${toastCount++}`
    const newToast: Toast = { id, title, description, variant }
    
    setToasts(prev => [...prev, newToast])
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
    
    return id
  }

  const dismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  // Simple console.log for now - in a real app you'd render these
  const actualToast = ({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
    console.log(`Toast [${variant}]: ${title}${description ? ` - ${description}` : ''}`)
    return toast({ title, description, variant })
  }

  return {
    toast: actualToast,
    toasts,
    dismiss
  }
}