import React from 'react'

interface TextAreaProps {
    label?: string
    value: string
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    placeholder?: string
    className?: string
    rows?: number
    maxLength?: number
    disabled?: boolean
    required?: boolean
    helpText?: string
}

export function TextArea({
    label,
    value,
    onChange,
    placeholder,
    className = '',
    rows = 4,
    maxLength,
    disabled = false,
    required = false,
    helpText,
}: TextAreaProps) {
    return (
        <div className="w-full mb-4">
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {label}
                    {required && <span className="ml-1 text-red-500">*</span>}
                </label>
            )}
            <textarea
                className={`
                    w-full px-3 py-2 border rounded-md
                    border-gray-300 dark:border-gray-600
                    bg-white dark:bg-gray-700
                    text-gray-900 dark:text-gray-100
                    placeholder-gray-400 dark:placeholder-gray-500
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    disabled:opacity-60 disabled:cursor-not-allowed
                    transition duration-150 ease-in-out
                    ${className}
                `}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                rows={rows}
                maxLength={maxLength}
                disabled={disabled}
                required={required}
                style={{ minHeight: `${rows * 24}px`, resize: 'vertical' }}
            />
            {helpText && (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {helpText}
                </div>
            )}
            {maxLength && (
                <div className="mt-1 text-xs text-right text-gray-500 dark:text-gray-400">
                    {value.length}/{maxLength}
                </div>
            )}
        </div>
    )
} 