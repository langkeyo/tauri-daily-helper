import React from 'react'

interface InputProps {
    label?: string
    type?: 'text' | 'number' | 'email' | 'password' | 'date'
    value: string
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
    className?: string
    disabled?: boolean
    required?: boolean
    maxLength?: number
    min?: number | string
    max?: number | string
    readOnly?: boolean
    helpText?: string
}

export function Input({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    className = '',
    disabled = false,
    required = false,
    maxLength,
    min,
    max,
    readOnly = false,
    helpText,
}: InputProps) {
    return (
        <div className="w-full mb-4">
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {label}
                    {required && <span className="ml-1 text-red-500">*</span>}
                </label>
            )}
            <input
                type={type}
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
                disabled={disabled}
                required={required}
                maxLength={maxLength}
                min={min}
                max={max}
                readOnly={readOnly}
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