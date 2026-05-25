import { useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Copy, Trash2, X, ShieldAlert, Sparkles, Circle, Square } from 'lucide-react'

export function FocusEditor() {
  const { 
    selectedFocusEffectId, 
    focusEffects, 
    updateFocusEffect, 
    duplicateFocusEffect, 
    removeFocusEffect, 
    selectFocusEffect 
  } = useEditorStore()

  const effect = focusEffects.find(f => f.id === selectedFocusEffectId) ?? null

  const handleDuplicate = useCallback(() => {
    if (!effect) return
    duplicateFocusEffect(effect.id)
  }, [effect, duplicateFocusEffect])

  const handleDelete = useCallback(() => {
    if (!effect) return
    removeFocusEffect(effect.id)
    selectFocusEffect(null)
  }, [effect, removeFocusEffect, selectFocusEffect])

  if (!effect) {
    if (!focusEffects || focusEffects.length === 0) return null
    return (
      <div className="w-full md:w-64 bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
        <span className="text-xs font-semibold text-gray-800 flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
          Focus & Blur Areas
        </span>
        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
          {focusEffects.map(f => (
            <div key={f.id} className="flex items-center justify-between bg-gray-50 rounded-md px-2 py-1.5 hover:bg-gray-100/80 transition-colors">
              <button
                onClick={() => selectFocusEffect(f.id)}
                className="text-left text-xs text-gray-700 font-mono cursor-pointer hover:text-gray-900 truncate flex-grow"
              >
                <span className="font-semibold capitalize text-indigo-600 mr-1">
                  {f.type}
                </span>
                ({f.shape}) · {f.duration.toFixed(1)}s
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                onClick={() => removeFocusEffect(f.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const isBlur = effect.type === 'blur'

  return (
    <div className="w-full md:w-64 bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-lg p-3 space-y-3">
      <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
        <span className="text-xs font-semibold text-gray-800 flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
          Focus & Blur
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-gray-500 hover:text-gray-900 cursor-pointer" onClick={handleDuplicate} title="Duplicate">
            <Copy className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer" onClick={handleDelete}>
            <Trash2 className="w-3 h-3" />
          </Button>
          <button onClick={() => selectFocusEffect(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer pl-1.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Effect Type Toggle */}
      <div className="space-y-1">
        <span className="text-[10px] text-gray-400 font-medium">Effect Type</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => updateFocusEffect(effect.id, { type: 'blur', intensity: 15 })}
            className={`h-7 rounded text-xs font-medium cursor-pointer transition-all flex items-center justify-center gap-1 ${
              effect.type === 'blur' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            Privacy Blur
          </button>
          <button
            onClick={() => updateFocusEffect(effect.id, { type: 'magnify', intensity: 1.5 })}
            className={`h-7 rounded text-xs font-medium cursor-pointer transition-all flex items-center justify-center gap-1 ${
              effect.type === 'magnify' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Magnify Glass
          </button>
        </div>
      </div>

      {/* Shape Toggle */}
      <div className="space-y-1">
        <span className="text-[10px] text-gray-400 font-medium">Shape</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => updateFocusEffect(effect.id, { shape: 'circle' })}
            className={`h-7 rounded text-xs font-medium cursor-pointer transition-all flex items-center justify-center gap-1 ${
              effect.shape === 'circle' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Circle className="w-3 h-3" />
            Circle
          </button>
          <button
            onClick={() => updateFocusEffect(effect.id, { shape: 'rect' })}
            className={`h-7 rounded text-xs font-medium cursor-pointer transition-all flex items-center justify-center gap-1 ${
              effect.shape === 'rect' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Square className="w-3 h-3" />
            Rectangle
          </button>
        </div>
      </div>

      {/* Duration Slider */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Duration</span>
          <span className="font-mono">{effect.duration.toFixed(1)}s</span>
        </div>
        <Slider min={0.5} max={15} step={0.1} value={[effect.duration]}
          onValueChange={([v]) => updateFocusEffect(effect.id, { duration: v ?? effect.duration })} />
      </div>

      {/* Intensity / Scale Slider */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>{isBlur ? 'Blur Intensity' : 'Zoom Magnification'}</span>
          <span className="font-mono">{isBlur ? `${effect.intensity}px` : `${effect.intensity.toFixed(1)}x`}</span>
        </div>
        <Slider 
          min={isBlur ? 5 : 1.1} 
          max={isBlur ? 40 : 3} 
          step={isBlur ? 1 : 0.1} 
          value={[effect.intensity]}
          onValueChange={([v]) => updateFocusEffect(effect.id, { intensity: v ?? effect.intensity })} 
        />
      </div>

    </div>
  )
}
