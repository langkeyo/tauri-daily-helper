import React, { ReactNode } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './Card'

interface DailyCardProps {
    title?: ReactNode
    children: ReactNode
    footer?: ReactNode
    className?: string
}

export function DailyCard({ title, children, footer, className = '' }: DailyCardProps) {
    return (
        <Card className={`max-w-4xl mx-auto my-4 shadow-md ${className}`}>
            {title && (
                <CardHeader className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    {typeof title === 'string' ? <CardTitle>{title}</CardTitle> : title}
                </CardHeader>
            )}
            <CardContent className="p-6">
                {children}
            </CardContent>
            {footer && (
                <CardFooter className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                    {footer}
                </CardFooter>
            )}
        </Card>
    )
} 