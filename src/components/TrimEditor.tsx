import { useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Trash2, X } from 'lucide-react'
const SPEED_PRESETS = [0.25, 0.5, 1, 1.5, 2, 3, 4]

export function TrimEditor() {
  const { selectedClipId, clips, updateClip, removeClip, selectClip } = useEditorStore()
  const clip = clips.find(c => c.id === selectedClipId) ?? null

  const handleDelete = useCallback(() => {
    if (!clip) return
    removeClip(clip.id)
  }, [clip, removeClip])

  const handleRemoveMotion = useCallback(() => {
    if (!clip) return
    updateClip(clip.id, { motion: undefined })
  }, [clip, updateClip])

  if (!clip) {
    return (
      <div className="w-full md:w-64 bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="text-xs text-gray-500">Select a clip to edit trim and speed.</p>
      </div>
    )
  }

  const effectiveDuration = (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed

  return (
    <div className="w-full md:w-64 bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-lg p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-gray-800 truncate">{clip.name}</span>
          <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">{effectiveDuration.toFixed(1)}s</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="destructive" size="sm" className="h-6 px-2 text-[10px]" onClick={handleDelete}>
            <Trash2 className="w-3 h-3" />
          </Button>
          <button onClick={() => selectClip(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Speed</span>
          <span className="font-mono">{clip.speed}x</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {SPEED_PRESETS.map(s => (
            <button
              key={s}
              onClick={() => updateClip(clip.id, { speed: s })}
              className={`px-1.5 py-0.5 text-[10px] rounded font-mono cursor-pointer transition-colors ${
                clip.speed === s
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {clip.motion && (
        <div className="space-y-2 border border-gray-200 rounded-md p-2 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-gray-700">Zoom + Slide</span>
            <button
              onClick={handleRemoveMotion}
              className="text-[10px] text-red-500 hover:text-red-400 cursor-pointer"
            >
              Remove
            </button>
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>Zoom Value</span>
              <span className="font-mono">{clip.motion.endScale.toFixed(2)}x</span>
            </div>
            <Slider
              min={1}
              max={3}
              step={0.05}
              value={[clip.motion.endScale]}
              onValueChange={([v]) => updateClip(clip.id, { motion: { ...clip.motion!, endScale: v ?? clip.motion!.endScale } })}
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>Zoom Point X</span>
              <span className="font-mono">{Math.round(clip.motion.anchorX)}%</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[clip.motion.anchorX]}
              onValueChange={([v]) => updateClip(clip.id, { motion: { ...clip.motion!, anchorX: v ?? clip.motion!.anchorX } })}
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>Zoom Point Y</span>
              <span className="font-mono">{Math.round(clip.motion.anchorY)}%</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[clip.motion.anchorY]}
              onValueChange={([v]) => updateClip(clip.id, { motion: { ...clip.motion!, anchorY: v ?? clip.motion!.anchorY } })}
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>Slide X</span>
              <span className="font-mono">{clip.motion.endX.toFixed(1)}%</span>
            </div>
            <Slider
              min={-30}
              max={30}
              step={0.5}
              value={[clip.motion.endX]}
              onValueChange={([v]) => updateClip(clip.id, { motion: { ...clip.motion!, endX: v ?? clip.motion!.endX } })}
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>Slide Y</span>
              <span className="font-mono">{clip.motion.endY.toFixed(1)}%</span>
            </div>
            <Slider
              min={-30}
              max={30}
              step={0.5}
              value={[clip.motion.endY]}
              onValueChange={([v]) => updateClip(clip.id, { motion: { ...clip.motion!, endY: v ?? clip.motion!.endY } })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
