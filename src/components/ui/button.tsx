import * as React from "react"
import { cn } from "@/lib/utils"

function Button({ className, variant = "default", size = "md", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "destructive"
  size?: "sm" | "md" | "icon"
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        variant === "default" && "bg-gray-900 text-white hover:bg-gray-800",
        variant === "outline" && "border border-gray-300 bg-white hover:bg-gray-50 text-gray-700",
        variant === "ghost" && "hover:bg-gray-100 text-gray-600",
        variant === "destructive" && "bg-red-600 text-white hover:bg-red-700",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-9 px-4",
        size === "icon" && "h-9 w-9",
        className,
      )}
      {...props}
    />
  )
}

export { Button }
