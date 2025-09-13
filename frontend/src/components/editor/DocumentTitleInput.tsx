import React, { useState, useEffect, useRef } from 'react'

interface DocumentTitleInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  className?: string
}

export const DocumentTitleInput: React.FC<DocumentTitleInputProps> = ({
  value,
  onChange,
  placeholder = 'Untitled Document',
  maxLength = 100,
  className = ''
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleClick = () => {
    setIsEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  const handleSubmit = () => {
    const trimmedValue = localValue.trim()
    if (trimmedValue && trimmedValue !== value) {
      onChange(trimmedValue)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      setLocalValue(value)
      setIsEditing(false)
    }
  }

  const handleBlur = () => {
    handleSubmit()
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        data-testid="document-title-input"
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`
          document-title-input editing
          text-lg font-medium
          bg-white
          border border-blue-300
          rounded-md
          px-3 py-2
          focus:outline-none
          focus:ring-2
          focus:ring-blue-500
          focus:border-transparent
          ${className}
        `}
      />
    )
  }

  return (
    <button
      data-testid="document-title-input"
      onClick={handleClick}
      className={`
        document-title-input display
        text-lg font-medium
        text-left
        bg-transparent
        border border-transparent
        rounded-md
        px-3 py-2
        hover:bg-gray-50
        hover:border-gray-200
        transition-colors
        ${className}
      `}
    >
      {value || placeholder}
    </button>
  )
}