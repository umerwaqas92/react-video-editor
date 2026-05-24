import { useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Trash2 } from 'lucide-react'

export function ZoomEditor() {
  const { selectedZoomMotionId, zoomMotions, updateZoomMotion, removeZoomMotion, selectZoomMotion } = useEditorStore()
  const motion = zoomMotions.find(m => m.id === selectedZoomMotionId) ?? null

  const handleDelete = useCallback(() => {
    if (!motion) return
    removeZoomMotion(motion.id)
    selectZoomMotion(null)
  }, [motion, removeZoomMotion, selectZoomMotion])

  if (!motion) return null

  return (
    <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-lg p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-800">Zoom Motion</span>
        <Button variant="destructive" size="sm" className="h-6 px-2 text-[10px]" onClick={handleDelete}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Duration</span>
          <span className="font-mono">{motion.duration.toFixed(1)}s</span>
        </div>
        <Slider min={0.5} max={15} step={0.1} value={[motion.duration]}
          onValueChange={([v]) => updateZoomMotion(motion.id, { duration: v ?? motion.duration })} />
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Zoom Level</span>
          <span className="font-mono">{motion.peakScale.toFixed(1)}x</span>
        </div>
        <Slider min={1.1} max={4} step={0.1} value={[motion.peakScale]}
          onValueChange={([v]) => updateZoomMotion(motion.id, { peakScale: v ?? motion.peakScale })} />
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Start Time</span>
          <span className="font-mono">{motion.startTime.toFixed(1)}s</span>
        </div>
        <Slider min={0} max={Math.max(30, motion.startTime + 10)} step={0.1} value={[motion.startTime]}
          onValueChange={([v]) => updateZoomMotion(motion.id, { startTime: v ?? motion.startTime })} />
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Target X</span>
          <span className="font-mono">{(motion.targetX * 100).toFixed(0)}%</span>
        </div>
        <Slider min={0} max={1} step={0.01} value={[motion.targetX]}
          onValueChange={([v]) => updateZoomMotion(motion.id, { targetX: v ?? motion.targetX })} />
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Target Y</span>
          <span className="font-mono">{(motion.targetY * 100).toFixed(0)}%</span>
        </div>
        <Slider min={0} max={1} step={0.01} value={[motion.targetY]}
          onValueChange={([v]) => updateZoomMotion(motion.id, { targetY: v ?? motion.targetY })} />
      </div>

      <p className="text-[10px] text-gray-400 leading-tight">
        Drag the box on the preview to position the zoom target.
      </p>
    </div>
  )
}
