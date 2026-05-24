import * as React from "react"
import { cn } from "@/lib/utils"

function Button({ className, variant = "default", size = "md", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "destructive"
  size?: "sm" | "md" | "icon"
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        variant === "default" && "bg-white text-black hover:bg-white/90",
        variant === "outline" && "border border-white/20 bg-transparent hover:bg-white/10 text-white",
        variant === "ghost" && "hover:bg-white/10 text-white",
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
