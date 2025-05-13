import React from 'react'
import { Card } from './ui'

interface PageTemplateProps {
    title: string
    children: React.ReactNode
    footer?: React.ReactNode
    helpText?: string
    actions?: React.ReactNode
}

export function PageTemplate({
    title,
    children,
    footer,
    helpText,
    actions,
}: PageTemplateProps) {
    return (
        <Card
            title={
                <div className="flex justify-between items-center">
                    <span>{title}</span>
                    {helpText && (
                        <div className="help-tooltip">
                            <span className="help-tooltip-icon">?</span>
                            <span className="help-tooltip-text">{helpText}</span>
                        </div>
                    )}
                </div>
            }
            footer={footer}
        >
            {actions && <div className="page-actions">{actions}</div>}
            <div className="page-content">{children}</div>
        </Card>
    )
} 