import * as React from "react"
import { cn } from "@/lib/utils"

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "destructive"
}

export function Alert({ className, variant = "default", ...props }: AlertProps) {
    return (
        <div
            className={cn(
                "rounded-lg border p-4",
                {
                    "bg-blue-50 text-blue-700 border-blue-200": variant === "default",
                    "bg-red-50 text-red-700 border-red-200": variant === "destructive",
                },
                className
            )}
            {...props}
        />
    )
}

export interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> { }

export function AlertTitle({ className, ...props }: AlertTitleProps) {
    return (
        <h5
            className={cn("mb-1 font-medium leading-none tracking-tight", className)}
            {...props}
        />
    )
}

export interface AlertDescriptionProps
    extends React.HTMLAttributes<HTMLParagraphElement> { }

export function AlertDescription({ className, ...props }: AlertDescriptionProps) {
    return (
        <div
            className={cn("text-sm", className)}
            {...props}
        />
    )
} 