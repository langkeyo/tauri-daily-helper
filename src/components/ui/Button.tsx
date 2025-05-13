import React from 'react'

interface ButtonProps {
    children: React.ReactNode
    type?: 'button' | 'submit' | 'reset'
    onClick?: () => void
    className?: string
    disabled?: boolean
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
    size?: 'small' | 'medium' | 'large'
    fullWidth?: boolean
    icon?: React.ReactNode
    loading?: boolean
}

export function Button({
    children,
    type = 'button',
    onClick,
    className = '',
    disabled = false,
    variant = 'primary',
    size = 'medium',
    fullWidth = false,
    icon,
    loading = false,
}: ButtonProps) {
    const getButtonClass = () => {
        let buttonClass = 'flex items-center justify-center transition-all duration-200 font-medium rounded-md '

        // Variant styles
        switch (variant) {
            case 'primary':
                buttonClass += 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm '
                break
            case 'secondary':
                buttonClass += 'bg-gray-200 hover:bg-gray-300 text-gray-800 '
                break
            case 'danger':
                buttonClass += 'bg-red-600 hover:bg-red-700 text-white '
                break
            case 'ghost':
                buttonClass += 'bg-transparent hover:bg-gray-100 text-gray-700 '
                break
            case 'outline':
                buttonClass += 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 '
                break
            default:
                buttonClass += 'bg-blue-600 hover:bg-blue-700 text-white '
        }

        // Size styles
        switch (size) {
            case 'small':
                buttonClass += 'text-sm px-3 py-1.5 '
                break
            case 'large':
                buttonClass += 'text-base px-6 py-3 '
                break
            default:
                buttonClass += 'text-sm px-4 py-2 '
        }

        // Full width
        if (fullWidth) {
            buttonClass += 'w-full '
        }

        // Disabled
        if (disabled || loading) {
            buttonClass += 'opacity-60 cursor-not-allowed '
        }

        // Focus styles
        buttonClass += 'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 '

        // User-provided classes
        buttonClass += className

        return buttonClass.trim()
    }

    return (
        <button
            type={type}
            className={getButtonClass()}
            onClick={onClick}
            disabled={disabled || loading}
        >
            {loading ? (
                <span className="inline-block w-4 h-4 mr-2 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
            ) : (
                icon && <span className="mr-2">{icon}</span>
            )}
            <span>{children}</span>
        </button>
    )
} 