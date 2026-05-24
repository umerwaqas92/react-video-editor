import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore, createZoomMotion } from '@/store/editorStore'
import type { Clip } from '@/types'
import { GripHorizontal, Film, ImageIcon, ZoomIn, ZoomOut, SkipBack, SkipForward, Scissors, Play, Pause, Undo, Redo, AlignStartHorizontal } from 'lucide-react'
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
  const { clips, selectedClipId, selectClip, reorderClips, totalDuration, currentTime, setCurrentTime, timelineZoom, setTimelineZoom, splitClipAtTime, zoomMotions, addZoomMotion, removeZoomMotion, updateZoomMotion, selectedZoomMotionId, selectZoomMotion, isPlaying, setIsPlaying, playbackRate, setPlaybackRate, undo, redo, canUndo, canRedo, recalculateTimeline } = useEditorStore()
  const dragRef = useRef<{ clipId: string; fromIndex: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const seekRafRef = useRef<number | null>(null)
  const pendingSeekRef = useRef<number | null>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)

  const pixelsPerSecond = timelineZoom
  const duration = totalDuration()
  const totalWidth = Math.max(duration * pixelsPerSecond, 200)
  const playheadX = currentTime * pixelsPerSecond

  const interval = getInterval(pixelsPerSecond)
  const canSplitAtCurrentTime = clips.some((clip) => {
    const effective = (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed
    const minSegment = 1 / 30
    return currentTime > clip.startTime + minSegment && currentTime < clip.startTime + effective - minSegment
  })

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

  const seekToImmediate = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(time, duration))
    setCurrentTime(clamped)
    const state = useEditorStore.getState()
    seekAllVideos(state.clips, clamped, state.playbackRate)
  }, [duration, setCurrentTime])

  const seekTo = useCallback((time: number) => {
    pendingSeekRef.current = time
    if (seekRafRef.current !== null) return
    seekRafRef.current = requestAnimationFrame(() => {
      seekRafRef.current = null
      if (pendingSeekRef.current === null) return
      seekToImmediate(pendingSeekRef.current)
      pendingSeekRef.current = null
    })
  }, [seekToImmediate])

  const seekFromClientX = useCallback((clientX: number) => {
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left + el.scrollLeft
    seekTo(x / pixelsPerSecond)
  }, [pixelsPerSecond, seekTo])

  useEffect(() => {
    if (!isScrubbing) return

    const handleMove = (e: MouseEvent) => {
      seekFromClientX(e.clientX)
    }

    const handleUp = () => {
      setIsScrubbing(false)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [isScrubbing, seekFromClientX])

  useEffect(() => {
    return () => {
      if (seekRafRef.current !== null) {
        cancelAnimationFrame(seekRafRef.current)
      }
    }
  }, [])

  const startScrubbing = useCallback((clientX: number) => {
    setIsScrubbing(true)
    seekFromClientX(clientX)
  }, [seekFromClientX])

  const handleTrackMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-clip-item="true"]')) return
    e.preventDefault()
    startScrubbing(e.clientX)
  }, [startScrubbing])

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
      {/* Toolbar */}
      <div className="flex items-center gap-1 mb-2">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={undo} disabled={!canUndo} title="Undo">
          <Undo className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={redo} disabled={!canRedo} title="Redo">
          <Redo className="w-3.5 h-3.5" />
        </Button>

        <div className="w-px h-4 bg-gray-200 mx-0.5" />

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setTimelineZoom(Math.max(2, timelineZoom - 5))}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <input
          type="range"
          min={2}
          max={200}
          value={timelineZoom}
          onChange={e => setTimelineZoom(Number(e.target.value))}
          className="w-20 h-1 accent-gray-600"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setTimelineZoom(Math.min(200, timelineZoom + 5))}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <span className="text-[10px] text-gray-400 font-mono ml-2">{timelineZoom}%</span>

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
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => {
            const didSplit = splitClipAtTime(currentTime)
            if (didSplit) seekToImmediate(currentTime)
          }}
          title="Split at playhead"
          disabled={!canSplitAtCurrentTime}
        >
          <Scissors className="w-3.5 h-3.5" />
        </Button>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => addZoomMotion(createZoomMotion({ startTime: currentTime }))}
          title="Add zoom motion"
        >
          <ZoomIn className="w-3.5 h-3.5 text-amber-500" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={recalculateTimeline}
          title="Recalculate timeline (close gaps)"
        >
          <AlignStartHorizontal className="w-3.5 h-3.5" />
        </Button>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6"
          onClick={() => {
            const state = useEditorStore.getState()
            if (state.totalDuration() === 0) return
            if (state.isPlaying) {
              state.setIsPlaying(false)
            } else {
              if (state.currentTime >= state.totalDuration()) state.setCurrentTime(0)
              state.setIsPlaying(true)
            }
          }}
          title="Play / Pause"
        >
          {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </Button>

        <span className="text-[10px] text-gray-500 font-mono select-none tabular-nums">
          {formatTime(currentTime)} / {formatTime(totalDuration())}
        </span>
      </div>

      {/* Clip track + ruler wrapped in single scrollable container */}
      <div
        ref={scrollRef}
        className={isScrubbing ? 'cursor-ew-resize select-none' : 'cursor-pointer'}
        style={{ overflowX: 'auto', overflowY: 'clip' }}
        onMouseDown={handleTrackMouseDown}
      >
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
            className="absolute top-0 bottom-0 z-20 cursor-ew-resize"
            style={{ left: playheadX }}
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              startScrubbing(e.clientX)
            }}
          >
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500 -mt-0.5 ml-[-6px]" />
            <div className="w-px bg-red-500 h-full ml-[-0.5px]" />
          </div>
        </div>

        {/* Zoom motion track */}
        <div className="mt-1 border-t border-gray-100" style={{ minWidth: totalWidth + 50 }}>
          <div className="relative" style={{ minHeight: 20 }}>
            {zoomMotions.map(motion => {
              const left = motion.startTime * pixelsPerSecond
              const width = Math.max(motion.duration * pixelsPerSecond, 40)
              return (
                <div
                  key={motion.id}
                  className={`absolute top-1 rounded-full group ${
                    motion.id === selectedZoomMotionId ? 'ring-2 ring-amber-500 ring-offset-1' : ''
                  }`}
                  style={{ left, width, height: 12 }}
                >
                  {/* Left resize handle */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-amber-600/50 rounded-l-full"
                    onMouseDown={(e) => {
                      e.stopPropagation(); e.preventDefault()
                      const startX = e.clientX
                      const origStart = motion.startTime
                      const origEnd = motion.startTime + motion.duration
                      const onMove = (ev: MouseEvent) => {
                        const dx = (ev.clientX - startX) / pixelsPerSecond
                        const newStart = Math.max(0, origStart + dx)
                        const newDuration = Math.max(0.3, origEnd - newStart)
                        updateZoomMotion(motion.id, { startTime: newStart, duration: newDuration })
                      }
                      const onUp = () => {
                        document.removeEventListener('mousemove', onMove)
                        document.removeEventListener('mouseup', onUp)
                      }
                      document.addEventListener('mousemove', onMove)
                      document.addEventListener('mouseup', onUp)
                    }}
                  />
                  {/* Body — drag to move */}
                  <div
                    className="h-full rounded-full bg-amber-400/60 border border-amber-500/80 flex items-center justify-center text-[8px] text-amber-900 font-mono truncate px-1 cursor-grab active:cursor-grabbing mx-2"
                    onMouseDown={(e) => {
                      e.stopPropagation(); e.preventDefault()
                      const startX = e.clientX
                      const origStart = motion.startTime
                      let moved = false
                      const onMove = (ev: MouseEvent) => {
                        const dx = (ev.clientX - startX) / pixelsPerSecond
                        const newStart = Math.max(0, origStart + dx)
                        if (Math.abs(dx) > 0.05) moved = true
                        updateZoomMotion(motion.id, { startTime: newStart })
                      }
                      const onUp = () => {
                        document.removeEventListener('mousemove', onMove)
                        document.removeEventListener('mouseup', onUp)
                        if (!moved) selectZoomMotion(motion.id)
                      }
                      document.addEventListener('mousemove', onMove)
                      document.addEventListener('mouseup', onUp)
                    }}
                  >
                    {motion.peakScale}x
                  </div>
                  {/* Right resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-amber-600/50 rounded-r-full"
                    onMouseDown={(e) => {
                      e.stopPropagation(); e.preventDefault()
                      const startX = e.clientX
                      const origDuration = motion.duration
                      const onMove = (ev: MouseEvent) => {
                        const dx = (ev.clientX - startX) / pixelsPerSecond
                        updateZoomMotion(motion.id, { duration: Math.max(0.3, origDuration + dx) })
                      }
                      const onUp = () => {
                        document.removeEventListener('mousemove', onMove)
                        document.removeEventListener('mouseup', onUp)
                      }
                      document.addEventListener('mousemove', onMove)
                      document.addEventListener('mouseup', onUp)
                    }}
                  />
                </div>
              )
            })}
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
      data-clip-item="true"
      onClick={onSelect}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`
        relative flex-shrink-0 rounded-md overflow-hidden cursor-pointer border-2 transition-colors
        ${isSelected
          ? clip.type === 'video' ? 'border-violet-900 shadow-[0_0_0_2px_rgba(124,58,237,0.3)]' : 'border-emerald-900 shadow-[0_0_0_2px_rgba(5,150,105,0.3)]'
          : 'border-gray-200 hover:border-gray-400'
        }
      `}
      style={{ width }}
    >
      <div className={`h-full flex items-center justify-center transition-colors ${
        clip.type === 'video'
          ? isSelected ? 'bg-violet-700' : 'bg-violet-400'
          : isSelected ? 'bg-emerald-700' : 'bg-emerald-400'
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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
