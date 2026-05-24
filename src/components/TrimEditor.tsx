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

  if (!clip) return null

  const effectiveDuration = (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed

  return (
    <div className="absolute top-3 right-3 z-20 w-64 bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-lg p-3 space-y-2.5">
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
          <span>Trim Start</span>
          <span className="font-mono">{clip.trimStart.toFixed(1)}s</span>
        </div>
        <Slider min={0} max={clip.duration - clip.trimEnd - 0.1} step={0.05} value={[clip.trimStart]} onValueChange={([v]) => updateClip(clip.id, { trimStart: v ?? clip.trimStart })} />
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Trim End</span>
          <span className="font-mono">{clip.trimEnd.toFixed(1)}s</span>
        </div>
        <Slider min={0} max={clip.duration - clip.trimStart - 0.1} step={0.05} value={[clip.trimEnd]} onValueChange={([v]) => updateClip(clip.id, { trimEnd: v ?? clip.trimEnd })} />
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
    </div>
  )
}
