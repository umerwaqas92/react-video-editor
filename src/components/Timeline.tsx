import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'
import type { Clip } from '@/types'
import { GripHorizontal, Film, ImageIcon, ZoomIn, ZoomOut, SkipBack, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { seekAllVideos } from '@/lib/canvasRenderer'

function getInterval(pps: number): number {
  const minPx = 55
  const raw = minPx / pps
  const nice = [0.5, 1, 2, 5, 10, 15, 30, 60, 120]
  for (const n of nice) {
    if (n >= raw) return n
  }
  return 60
}

export function Timeline() {
  const { clips, selectedClipId, selectClip, reorderClips, totalDuration, currentTime, setCurrentTime } = useEditorStore()
  const dragRef = useRef<{ clipId: string; fromIndex: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(20)

  const pixelsPerSecond = zoom
  const duration = totalDuration()
  const totalWidth = Math.max(duration * pixelsPerSecond, 200)
  const playheadX = currentTime * pixelsPerSecond

  const interval = getInterval(pixelsPerSecond)

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const viewLeft = el.scrollLeft
    const viewRight = viewLeft + el.clientWidth
    if (playheadX < viewLeft + 40 || playheadX > viewRight - 40) {
      el.scrollLeft = playheadX - el.clientWidth / 3
    }
  }, [playheadX])

  const seekTo = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(time, duration))
    setCurrentTime(clamped)
    const state = useEditorStore.getState()
    seekAllVideos(state.clips, clamped)
  }, [duration, setCurrentTime])

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left + el.scrollLeft
    seekTo(x / pixelsPerSecond)
  }, [pixelsPerSecond, seekTo])

  // Build time ruler labels
  const rulerLabels: { pos: number; label: string }[] = []
  const totalIntervals = Math.ceil(duration / interval)
  for (let i = 0; i <= totalIntervals; i++) {
    const t = i * interval
    if (t > duration + 0.01) break
    rulerLabels.push({
      pos: t * pixelsPerSecond,
      label: t >= 60
        ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
        : `${t % 1 !== 0 ? t.toFixed(1) : t}s`,
    })
  }

  return (
    <div className="bg-white border-t border-gray-200 p-3">
      {/* Zoom controls */}
      <div className="flex items-center gap-1 mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setZoom(z => Math.max(2, z - 5))}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <input
          type="range"
          min={2}
          max={200}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          className="w-20 h-1 accent-gray-600"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setZoom(z => Math.min(200, z + 5))}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <span className="text-[10px] text-gray-400 font-mono ml-2">{zoom}%</span>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => seekTo(0)}
          title="Go to start"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => seekTo(duration)}
          title="Go to end"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Clip track + ruler wrapped in single scrollable container */}
      <div ref={scrollRef} className="cursor-pointer" style={{ overflowX: 'auto', overflowY: 'clip' }} onClick={handleTrackClick}>
        {/* Time ruler — at the top */}
        {clips.length > 0 && (
          <div className="mb-1 pb-1 border-b border-gray-200" style={{ height: 24 }}>
            <div className="relative h-full" style={{ minWidth: totalWidth + 50 }}>
              {rulerLabels.map(({ pos, label }) => (
                <div
                  key={pos}
                  className="absolute bottom-0 text-[10px] text-gray-400 font-mono select-none"
                  style={{ left: pos }}
                >
                  <div className="w-px h-1.5 bg-gray-300 mt-0.5" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clip track */}
        <div
          className="flex items-center gap-1 relative"
          style={{ minWidth: totalWidth + 50, minHeight: 44 }}
        >
          {clips.map((clip, index) => (
            <TimelineClipItem
              key={clip.id}
              clip={clip}
              isSelected={clip.id === selectedClipId}
              onSelect={(e) => { e.stopPropagation(); selectClip(clip.id) }}
              pixelsPerSecond={pixelsPerSecond}
              onDragStart={() => {
                dragRef.current = { clipId: clip.id, fromIndex: index }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (!dragRef.current || dragRef.current.fromIndex === index) return
                const { fromIndex } = dragRef.current
                reorderClips(fromIndex, index)
                dragRef.current.fromIndex = index
              }}
              onDragEnd={() => { dragRef.current = null }}
            />
          ))}
          {clips.length === 0 && (
            <div className="flex items-center justify-center w-full text-gray-400 text-sm py-4">
              Add videos or images to start editing
            </div>
          )}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 z-20 pointer-events-none"
            style={{ left: playheadX }}
          >
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500 -mt-0.5 ml-[-6px]" />
            <div className="w-px bg-red-500 h-full ml-[-0.5px]" />
          </div>
        </div>
      </div>
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
        ${isSelected ? 'border-gray-800 shadow-[0_0_0_2px_rgba(0,0,0,0.15)]' : 'border-gray-200 hover:border-gray-400'}
      `}
      style={{ width }}
    >
      <div className={`h-full flex items-center justify-center ${
        clip.type === 'video'
          ? 'bg-gradient-to-br from-purple-700/80 to-orange-600/80'
          : 'bg-gradient-to-br from-emerald-700/80 to-teal-500/80'
      }`}>
        {clip.type === 'video' ? (
          <Film className="w-3.5 h-3.5 text-white/60" />
        ) : (
          <ImageIcon className="w-3.5 h-3.5 text-white/60" />
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-px flex items-center justify-between">
        <span className="text-[9px] text-white/80 truncate max-w-[55%]">{clip.name}</span>
        <span className="text-[9px] text-white/50 font-mono">{effectiveDuration.toFixed(1)}s</span>
      </div>
      <div className="absolute top-0.5 left-0.5 cursor-grab text-white/30 hover:text-white/60">
        <GripHorizontal className="w-2.5 h-2.5" />
      </div>
      {clip.speed !== 1 && (
        <div className="absolute top-0.5 right-0.5 bg-white/20 backdrop-blur text-[8px] text-white px-1 rounded-full font-mono">
          {clip.speed}x
        </div>
      )}
    </div>
  )
}
