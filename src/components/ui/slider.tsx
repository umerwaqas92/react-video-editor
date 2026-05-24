import * as React from "react"
import { cn } from "@/lib/utils"

function Slider({ className, min = 0, max = 100, step = 1, value, onValueChange, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number[]
  onValueChange: (value: number[]) => void
}) {
  const singleValue = value[0] ?? 0
  const percentage = ((singleValue - min) / (max - min)) * 100

  return (
    <div className={cn("relative flex w-full touch-none select-none items-center", className)} {...props}>
      <div className="relative h-1.5 w-full grow rounded-full bg-white/10">
        <div
          className="absolute h-full rounded-full bg-white"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={singleValue}
        onChange={(e) => onValueChange([parseFloat(e.target.value)])}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
      />
      <div
        className="absolute top-1/2 block h-3.5 w-3.5 rounded-full border border-white/20 bg-white -translate-y-1/2 shadow"
        style={{ left: `calc(${percentage}% - ${percentage > 50 ? 14 : 0}px)` }}
      />
    </div>
  )
}

export { Slider }
