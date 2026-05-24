import { useState, useRef, useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { Button } from '@/components/ui/button'
import { PaintBucket, X } from 'lucide-react'

const COLOR_PRESETS = [
  '#000000', '#ffffff', '#1a1a2e', '#16213e', '#0f3460',
  '#533483', '#e94560', '#f5f5f5', '#333333', '#ff6b6b',
  '#51cf66', '#339af0', '#fcc419', '#845ef7',
]

export function BackgroundPicker() {
  const [isOpen, setIsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { background, setBackground, devicePadding, setDevicePadding } = useEditorStore()

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setBackground({ type: 'image', src: url })
    e.target.value = ''
  }, [setBackground])

  if (!isOpen) {
    return (
      <div className="absolute top-3 left-3 z-20">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900/90 backdrop-blur border border-white/10 text-white/70 hover:text-white text-xs cursor-pointer shadow-lg"
        >
          <PaintBucket className="w-3.5 h-3.5" />
          Background
        </button>
      </div>
    )
  }

  return (
    <div className="absolute top-3 left-3 z-20 w-56 bg-neutral-900/95 backdrop-blur border border-white/10 rounded-lg shadow-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white flex items-center gap-1.5">
          <PaintBucket className="w-3.5 h-3.5" />
          Background
        </span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white/30 hover:text-white/60 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Color presets */}
      <div>
        <p className="text-[10px] text-white/40 mb-1">Color</p>
        <div className="flex gap-1 flex-wrap">
          {COLOR_PRESETS.map(color => (
            <button
              key={color}
              onClick={() => setBackground({ type: 'color', value: color })}
              className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-colors ${
                background.type === 'color' && background.value === color
                  ? 'border-white ring-1 ring-white/30'
                  : 'border-white/10 hover:border-white/40'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Custom color */}
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={background.type === 'color' ? background.value : '#000000'}
          onChange={(e) => setBackground({ type: 'color', value: e.target.value })}
          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
        />
        <input
          type="text"
          value={background.type === 'color' ? background.value : ''}
          onChange={(e) => {
            const v = e.target.value
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
              setBackground({ type: 'color', value: v || '#000000' })
            }
          }}
          placeholder="#000000"
          className="bg-neutral-800 text-white text-[11px] px-2 py-1 rounded border border-white/10 w-20 font-mono"
        />
      </div>

      {/* Image upload */}
      <div>
        <p className="text-[10px] text-white/40 mb-1">Image</p>
        <Button variant="outline" size="sm" className="h-7 text-[11px] w-full" onClick={() => fileInputRef.current?.click()}>
          Upload Image
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        {background.type === 'image' && (
          <div className="mt-1.5 flex items-center gap-2">
            <img src={background.src} alt="bg" className="w-8 h-8 object-cover rounded" />
            <button
              onClick={() => setBackground({ type: 'color', value: '#000000' })}
              className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Padding */}
      <div>
        <p className="text-[10px] text-white/40 mb-1">Padding <span className="font-mono">{devicePadding}px</span></p>
        <input
          type="range"
          min={0}
          max={120}
          value={devicePadding}
          onChange={e => setDevicePadding(Number(e.target.value))}
          className="w-full h-1 accent-white/60"
        />
      </div>
    </div>
  )
}
