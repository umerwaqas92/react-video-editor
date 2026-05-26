import { useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'
import type { CursorMotion } from '@/types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Copy, Trash2, X, MousePointer2, Pointer } from 'lucide-react'

export function CursorEditor() {
  const {
    selectedCursorMotionId,
    cursorMotions,
    updateCursorMotion,
    duplicateCursorMotion,
    removeCursorMotion,
    selectCursorMotion
  } = useEditorStore()

  const motion = cursorMotions.find(m => m.id === selectedCursorMotionId) ?? null

  const handleDuplicate = useCallback(() => {
    if (!motion) return
    duplicateCursorMotion(motion.id)
  }, [motion, duplicateCursorMotion])

  const handleDelete = useCallback(() => {
    if (!motion) return
    removeCursorMotion(motion.id)
    selectCursorMotion(null)
  }, [motion, removeCursorMotion, selectCursorMotion])

  if (!motion) {
    if (!cursorMotions || cursorMotions.length === 0) return null
    return (
      <div className="w-full md:w-64 bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
        <span className="text-xs font-semibold text-gray-800 flex items-center gap-1">
          <MousePointer2 className="w-3.5 h-3.5 text-blue-500" />
          Cursor Motions
        </span>
        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
          {cursorMotions.map(m => (
            <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-md px-2 py-1.5 hover:bg-gray-100/80 transition-colors">
              <button
                onClick={() => selectCursorMotion(m.id)}
                className="text-left text-xs text-gray-700 font-mono cursor-pointer hover:text-gray-900 truncate flex-grow"
              >
                Click at {(m.targetX ?? 0).toFixed(2)}, {(m.targetY ?? 0).toFixed(2)} · {(m.duration ?? 0).toFixed(1)}s
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                onClick={() => removeCursorMotion(m.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full md:w-64 bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-lg p-3 space-y-3">
      <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
        <span className="text-xs font-semibold text-gray-800 flex items-center gap-1">
          <MousePointer2 className="w-3.5 h-3.5 text-blue-500" />
          Cursor Motion
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-gray-500 hover:text-gray-900 cursor-pointer" onClick={handleDuplicate} title="Duplicate">
            <Copy className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer" onClick={handleDelete}>
            <Trash2 className="w-3 h-3" />
          </Button>
          <button onClick={() => selectCursorMotion(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer pl-1.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Icon Type Toggle */}
      <div className="space-y-1">
        <span className="text-[10px] text-gray-400 font-medium">Icon Type</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => updateCursorMotion(motion.id, { iconType: 'arrow' })}
            className={`h-7 rounded text-xs font-medium cursor-pointer transition-all flex items-center justify-center gap-1 ${
              motion.iconType === 'arrow'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <MousePointer2 className="w-3 h-3" />
            Arrow
          </button>
          <button
            onClick={() => updateCursorMotion(motion.id, { iconType: 'hand' })}
            className={`h-7 rounded text-xs font-medium cursor-pointer transition-all flex items-center justify-center gap-1 ${
              motion.iconType === 'hand'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Pointer className="w-3 h-3" />
            Hand
          </button>
        </div>
      </div>

      {/* Start Side/Corner Toggle */}
      <div className="space-y-1">
        <span className="text-[10px] text-gray-400 font-medium">Start Position</span>
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: 'top-left', label: '↖' },
            { id: 'top', label: '↑' },
            { id: 'top-right', label: '↗' },
            { id: 'left', label: '←' },
            { id: 'center', label: '·', disabled: true },
            { id: 'right', label: '→' },
            { id: 'bottom-left', label: '↙' },
            { id: 'bottom', label: '↓' },
            { id: 'bottom-right', label: '↘' },
          ].map(pos => (
            <button
              key={pos.id}
              disabled={pos.disabled}
              onClick={() => !pos.disabled && updateCursorMotion(motion.id, { startSide: pos.id as CursorMotion['startSide'] })}
              className={`h-8 rounded text-sm font-medium transition-all ${
                pos.disabled ? 'opacity-0 pointer-events-none' :
                motion.startSide === pos.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer'
              }`}
              title={pos.id}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </div>

      {/* Size Slider */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Cursor Size</span>
          <span className="font-mono">{(motion.size ?? 0).toFixed(1)}x</span>
        </div>
        <Slider min={0.5} max={3} step={0.1} value={[motion.size]}
          onValueChange={([v]) => updateCursorMotion(motion.id, { size: v ?? motion.size })} />
      </div>

      {/* Duration Slider */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Duration</span>
          <span className="font-mono">{(motion.duration ?? 0).toFixed(1)}s</span>
        </div>
        <Slider min={0.5} max={10} step={0.1} value={[motion.duration]}
          onValueChange={([v]) => updateCursorMotion(motion.id, { duration: v ?? motion.duration })} />
      </div>

      <div className="pt-1">
        <p className="text-[10px] text-gray-400 italic">Tip: Drag the target point on the preview to set click position.</p>
      </div>

    </div>
  )
}
