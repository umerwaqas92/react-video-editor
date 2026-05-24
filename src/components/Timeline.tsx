import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'
import type { Clip } from '@/types'
import { GripHorizontal, Film, ImageIcon, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Timeline() {
  const { clips, selectedClipId, selectClip, reorderClips, totalDuration, currentTime, setCurrentTime } = useEditorStore()
  const dragRef = useRef<{ clipId: string; fromIndex: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const rulerScrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(60)

  const pixelsPerSecond = zoom
  const totalWidth = Math.max(totalDuration() * pixelsPerSecond, 200)
  const playheadX = currentTime * pixelsPerSecond

  // Auto-scroll to keep playhead visible during playback
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const viewLeft = el.scrollLeft
    const viewRight = viewLeft + el.clientWidth
    if (playheadX < viewLeft + 40 || playheadX > viewRight - 40) {
      el.scrollLeft = playheadX - el.clientWidth / 3
    }
  }, [playheadX])

  // Sync ruler scroll with track scroll
  useEffect(() => {
    const track = scrollRef.current
    const ruler = rulerScrollRef.current
    if (!track || !ruler) return
    const onScroll = () => { ruler.scrollLeft = track.scrollLeft }
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => track.removeEventListener('scroll', onScroll)
  }, [])

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left + el.scrollLeft
    const time = Math.max(0, x / pixelsPerSecond)
    setCurrentTime(Math.min(time, totalDuration()))
  }, [pixelsPerSecond, setCurrentTime, totalDuration])

  const handleDragStart = (clipId: string, fromIndex: number) => {
    dragRef.current = { clipId, fromIndex }
  }

  const handleDragOver = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    if (!dragRef.current || dragRef.current.fromIndex === toIndex) return
    const { fromIndex } = dragRef.current
    reorderClips(fromIndex, toIndex)
    dragRef.current.fromIndex = toIndex
  }

  const handleDragEnd = () => {
    dragRef.current = null
  }

  return (
    <div className="bg-neutral-900 border-t border-white/10 p-3">
      {/* Zoom controls */}
      <div className="flex items-center gap-1 mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setZoom(z => Math.max(20, z - 15))}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <input
          type="range"
          min={20}
          max={200}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          className="w-20 h-1 accent-white/60"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setZoom(z => Math.min(200, z + 15))}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <span className="text-[10px] text-white/40 font-mono ml-2">{zoom}%</span>
      </div>

      {/* Clip track with playhead */}
      <div ref={scrollRef} className="overflow-x-auto cursor-pointer" onClick={handleTrackClick}>
        <div
          className="flex items-center gap-1 min-h-[56px] relative"
          style={{ minWidth: totalWidth + 50 }}
        >
          {clips.map((clip, index) => (
            <TimelineClipItem
              key={clip.id}
              clip={clip}
              isSelected={clip.id === selectedClipId}
              onSelect={(e) => { e.stopPropagation(); selectClip(clip.id) }}
              pixelsPerSecond={pixelsPerSecond}
              onDragStart={() => handleDragStart(clip.id, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            />
          ))}
          {clips.length === 0 && (
            <div className="flex items-center justify-center w-full text-white/30 text-sm py-4">
              Add videos or images to start editing
            </div>
          )}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 z-20 pointer-events-none"
            style={{ left: playheadX }}
          >
            {/* Triangle handle */}
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500 -mt-0.5 ml-[-6px]" />
            {/* Vertical line */}
            <div className="w-px bg-red-500 h-full ml-[-0.5px]" />
          </div>
        </div>
      </div>

      {/* Time ruler with click-to-seek */}
      {clips.length > 0 && (
        <div ref={rulerScrollRef} className="overflow-hidden mt-2 border-t border-white/5 pt-2 cursor-pointer" onClick={handleTrackClick}>
          <div className="flex relative" style={{ minWidth: totalWidth + 50 }}>
            {Array.from({ length: Math.ceil(totalDuration()) + 1 }).map((_, i) => (
              <div
                key={i}
                className="text-[10px] text-white/30 font-mono flex-shrink-0 border-l border-white/5 pl-0.5 select-none"
                style={{ width: pixelsPerSecond }}
              >
                {i}s
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TimelineClipItem({
  clip,
  isSelected,
  onSelect,
  pixelsPerSecond,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  clip: Clip
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  pixelsPerSecond: number
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const effectiveDuration = (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed
  const width = Math.max(effectiveDuration * pixelsPerSecond, 50)

  return (
    <div
      draggable
      onClick={onSelect}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`
        relative flex-shrink-0 rounded-md overflow-hidden cursor-pointer border-2 transition-colors
        ${isSelected ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-white/10 hover:border-white/30'}
      `}
      style={{ width }}
    >
      <div className="bg-neutral-800 h-12 flex items-center justify-center">
        {clip.type === 'video' ? (
          <Film className="w-4 h-4 text-white/40" />
        ) : (
          <ImageIcon className="w-4 h-4 text-white/40" />
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-0.5 flex items-center justify-between">
        <span className="text-[10px] text-white/80 truncate max-w-[55%]">{clip.name}</span>
        <span className="text-[10px] text-white/50 font-mono">{effectiveDuration.toFixed(1)}s</span>
      </div>
      <div className="absolute top-1 left-1 cursor-grab text-white/30 hover:text-white/60">
        <GripHorizontal className="w-3 h-3" />
      </div>
      {clip.speed !== 1 && (
        <div className="absolute top-1 right-1 bg-yellow-600/80 text-[9px] text-white px-1 rounded font-mono">
          {clip.speed}x
        </div>
      )}
    </div>
  )
}
