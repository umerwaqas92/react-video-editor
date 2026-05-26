import { useRef, useEffect, useState, useCallback } from 'react'
import { drawFrame, preloadAssets, sizeCanvas, seekAllVideos, setOnSeeked, getVideoElement } from '@/lib/canvasRenderer'
import { useEditorStore, createClip } from '@/store/editorStore'
import { Upload, MousePointer2 } from 'lucide-react'
import { saveMediaAsset } from '@/lib/mediaStorage'

export function PhoneMockup({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const innerRef = useRef<HTMLCanvasElement>(null)
  const resolvedRef = canvasRef || innerRef
  const previewAreaRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const sizedRef = useRef(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [phoneWidth, setPhoneWidth] = useState(260)
  const { clips, background, currentTime, isPlaying, devicePadding, previewZoom, addClip, selectedClipId, setDeviceAspect, updateClip, deviceAspect, zoomMotions, selectedZoomMotionId, updateZoomMotion, focusEffects, selectedFocusEffectId, updateFocusEffect, cursorMotions, selectedCursorMotionId, updateCursorMotion } = useEditorStore()

  useEffect(() => {
    preloadAssets(clips, background)
  }, [clips, background])

  // Adapt device aspect ratio to selected or currently active clip
  useEffect(() => {
    const effectiveDuration = (clip: typeof clips[number]) => (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed
    const selectedClip = selectedClipId ? clips.find(c => c.id === selectedClipId) : undefined
    const activeClip = clips.find(c => currentTime >= c.startTime && currentTime < c.startTime + effectiveDuration(c))
    const clip = selectedClip ?? activeClip ?? clips[0]

    if (!clip) {
      if (deviceAspect !== '9/16') {
        setDeviceAspect('9/16')
      }
      return
    }

    const applyAspect = (w: number, h: number) => {
      const aspect = `${w}/${h}`
      if (aspect !== deviceAspect) {
        setDeviceAspect(aspect)
      }
    }

    if (clip.naturalWidth && clip.naturalHeight) {
      applyAspect(clip.naturalWidth, clip.naturalHeight)
      return
    }

    // Fallback: read from media element
    if (clip.type === 'video') {
      const video = getVideoElement(clip.src)
      if (video.videoWidth && video.videoHeight) {
        updateClip(clip.id, { naturalWidth: video.videoWidth, naturalHeight: video.videoHeight })
        applyAspect(video.videoWidth, video.videoHeight)
      }
    } else {
      const img = new Image()
      img.src = clip.src
      const done = () => {
        if (img.naturalWidth && img.naturalHeight) {
          updateClip(clip.id, { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })
          applyAspect(img.naturalWidth, img.naturalHeight)
        }
      }
      if (img.complete && img.naturalWidth) done()
      else img.onload = done
    }
  }, [selectedClipId, clips, currentTime, deviceAspect, setDeviceAspect, updateClip])

  useEffect(() => {
    if (isPlaying) return
    const s = useEditorStore.getState()
    seekAllVideos(s.clips, s.currentTime, s.playbackRate)
  }, [clips, isPlaying])

  useEffect(() => {
    const canvas = resolvedRef.current
    if (!canvas) return

    const doSize = () => {
      const wasUnsized = canvas.width === 0 || canvas.height === 0
      sizeCanvas(canvas)
      sizedRef.current = true
      if (wasUnsized && canvas.width > 0) {
        const s = useEditorStore.getState()
        if (!s.isPlaying) {
          seekAllVideos(s.clips, s.currentTime, s.playbackRate)
          drawFrame(canvas, s.clips, s.background, s.currentTime)
        }
      }
    }

    const observer = new ResizeObserver(doSize)
    observer.observe(canvas)
    doSize()
    return () => observer.disconnect()
  }, [resolvedRef])


  useEffect(() => {
    setOnSeeked(() => {
      const canvas = resolvedRef.current
      if (!canvas || canvas.width === 0 || canvas.height === 0) return
      const s = useEditorStore.getState()
      if (!s.isPlaying) {
        drawFrame(canvas, s.clips, s.background, s.currentTime)
      }
    })
    return () => setOnSeeked(null)
  }, [resolvedRef])

  useEffect(() => {
    if (isPlaying) return
    const canvas = resolvedRef.current
    if (!canvas || canvas.width === 0 || canvas.height === 0) return
    drawFrame(canvas, clips, background, currentTime)
  }, [clips, background, currentTime, isPlaying, resolvedRef])

  useEffect(() => {
    const host = previewAreaRef.current
    if (!host) return

    const parseAspect = (value: string) => {
      const [w, h] = value.split('/').map(Number)
      if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return 9 / 16
      return w / h
    }

    const updatePhoneSize = () => {
      const rect = host.getBoundingClientRect()
      const availableWidth = Math.max(0, rect.width)
      const availableHeight = Math.max(0, rect.height)
      if (availableWidth === 0 || availableHeight === 0) return

      const ratio = parseAspect(deviceAspect)
      let width = Math.min(340, availableWidth)
      let height = width / ratio
      if (height > availableHeight) {
        height = availableHeight
        width = height * ratio
      }

      setPhoneWidth(Math.max(140, width))
    }

    const observer = new ResizeObserver(updatePhoneSize)
    observer.observe(host)
    updatePhoneSize()
    requestAnimationFrame(updatePhoneSize)
    return () => observer.disconnect()
  }, [deviceAspect])

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set false if leaving the drop zone itself
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const processFile = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file)

    if (file.type.startsWith('video/')) {
      const video = document.createElement('video')
      video.src = url
      video.onloadedmetadata = async () => {
        const clip = createClip({ type: 'video', src: url, name: file.name, duration: video.duration, naturalWidth: video.videoWidth || 1920, naturalHeight: video.videoHeight || 1080 })
        const persisted = await saveMediaAsset(file, clip.id)
        addClip({ ...clip, mediaStorageKey: persisted.mediaStorageKey, originalPath: persisted.originalPath })
      }
    } else if (file.type.startsWith('image/')) {
      const img = new Image()
      img.src = url
      img.onload = async () => {
        const clip = createClip({ type: 'image', src: url, name: file.name, duration: 5, naturalWidth: img.naturalWidth || 1920, naturalHeight: img.naturalHeight || 1080 })
        const persisted = await saveMediaAsset(file, clip.id)
        addClip({ ...clip, mediaStorageKey: persisted.mediaStorageKey, originalPath: persisted.originalPath })
      }
    }
  }, [addClip])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      processFile(file)
    }
  }, [processFile])

  const handleMediaSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      processFile(file)
    }
    e.target.value = ''
  }, [processFile])

  // Compute zoom from active zoom motions
  // Fixed timing: 0.5s zoom-in, hold at peak, 0.5s zoom-out
  const ZOOM_IN = 0.2
  const ZOOM_OUT = 0.2
  let motionZoom = 1
  let zoomOriginX = 0.5
  let zoomOriginY = 0.5
  for (const m of zoomMotions) {
    const elapsed = currentTime - m.startTime
    if (elapsed < 0 || elapsed > m.duration) continue
    const holdDuration = m.duration - ZOOM_IN - ZOOM_OUT

    let p: number
    if (holdDuration <= 0) {
      // Very short duration: simple in-out with midpoint at half
      const progress = elapsed / m.duration
      p = (m.peakScale - 1) * (progress <= 0.5 ? progress / 0.5 : (1 - progress) / 0.5)
    } else if (elapsed <= ZOOM_IN) {
      p = (m.peakScale - 1) * (elapsed / ZOOM_IN)
    } else if (elapsed <= ZOOM_IN + holdDuration) {
      p = m.peakScale - 1
    } else {
      p = (m.peakScale - 1) * ((m.duration - elapsed) / ZOOM_OUT)
    }

    const scale = 1 + p
    motionZoom *= scale
    if (scale > 1.01) {
      zoomOriginX = m.targetX
      zoomOriginY = m.targetY
    }
  }

  // Computed transform for zoom-to-position effect
  const zoomTransform = motionZoom > 1.01
    ? `scale(${motionZoom})`
    : undefined
  const zoomOrigin = motionZoom > 1.01
    ? `${zoomOriginX * 100}% ${zoomOriginY * 100}%`
    : 'center center'

  // Cursor animation logic
  const activeCursorMotion = cursorMotions.find(m => currentTime >= m.startTime && currentTime <= m.startTime + m.duration)
  let cursorStyle: React.CSSProperties | null = null
  if (activeCursorMotion) {
    const elapsed = currentTime - activeCursorMotion.startTime
    const progress = elapsed / activeCursorMotion.duration // 0 to 1

    // Smooth move in, hold, move out
    // 0.0 -> 0.3: Move in
    // 0.3 -> 0.7: Hold / Click
    // 0.7 -> 1.0: Move out
    let p: number
    if (progress < 0.3) {
      p = progress / 0.3 // 0 to 1
    } else if (progress < 0.7) {
      p = 1
    } else {
      p = 1 - (progress - 0.7) / 0.3 // 1 to 0
    }

    // Ease in/out
    const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    const ep = ease(p)

    let startX = 0.5, startY = 0.5
    if (activeCursorMotion.startSide === 'top') { startX = activeCursorMotion.targetX; startY = -0.2 }
    else if (activeCursorMotion.startSide === 'bottom') { startX = activeCursorMotion.targetX; startY = 1.2 }
    else if (activeCursorMotion.startSide === 'left') { startX = -0.2; startY = activeCursorMotion.targetY }
    else if (activeCursorMotion.startSide === 'right') { startX = 1.2; startY = activeCursorMotion.targetY }

    const curX = startX + (activeCursorMotion.targetX - startX) * ep
    const curY = startY + (activeCursorMotion.targetY - startY) * ep

    const isClicking = progress >= 0.3 && progress <= 0.7

    cursorStyle = {
      left: `${curX * 100}%`,
      top: `${curY * 100}%`,
      transform: `translate(-50%, -50%) scale(${isClicking ? 0.8 : 1})`,
      transition: isPlaying ? 'none' : 'all 0.1s ease',
    }
  }

  return (
    <div
      ref={previewAreaRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      style={{ padding: `${devicePadding}px` }}
    >
      <div
        className="flex items-center justify-center w-full h-full"
        style={{
          transform: zoomTransform ? `scale(${previewZoom * motionZoom})` : `scale(${previewZoom})`,
          transformOrigin: zoomOrigin,
          transition: 'transform 0.1s ease',
        }}
      >
        <div className="relative" style={{ width: `${phoneWidth}px` }}>
          <div className={`relative bg-neutral-900 rounded-[3rem] p-2.5 border-[3px] shadow-2xl transition-colors ${
            isDragOver ? 'border-blue-400 shadow-blue-500/20' : 'border-neutral-700'
          }`}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-2xl z-10" />
            <div
              ref={containerRef}
              className="relative bg-black rounded-[2.5rem] overflow-hidden"
              style={{ aspectRatio: deviceAspect }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <canvas
                ref={resolvedRef}
                className="w-full h-full block bg-black"
              />
              {clips.length === 0 && !isDragOver && (
                <button
                  onClick={() => mediaInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black cursor-pointer hover:bg-black/80 transition-colors"
                >
                  <div className="text-center text-white/60">
                    <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs">Tap to add videos or images</p>
                  </div>
                </button>
              )}
              <input
                ref={mediaInputRef}
                type="file"
                accept="video/*,image/*"
                multiple
                className="hidden"
                onChange={handleMediaSelect}
              />

              {/* Zoom motion indicator — only when selected AND active */}
              {selectedZoomMotionId && motionZoom > 1.01 && (
                <div className="absolute inset-0 pointer-events-none z-10">
                  <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-amber-400 rounded-tl" />
                  <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-amber-400 rounded-tr" />
                  <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-amber-400 rounded-bl" />
                  <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-amber-400 rounded-br" />
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500/80 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {motionZoom.toFixed(1)}x
                  </div>
                </div>
              )}

              {/* Draggable zoom target box — shown when zoom motion is selected */}
              {selectedZoomMotionId && (() => {
                const zm = zoomMotions.find(m => m.id === selectedZoomMotionId)
                if (!zm) return null
                const boxW = (100 / zm.peakScale) + '%'
                const boxH = (100 / zm.peakScale) + '%'
                const left = `calc(${zm.targetX * 100}% - ${100 / zm.peakScale / 2}%)`
                const top = `calc(${zm.targetY * 100}% - ${100 / zm.peakScale / 2}%)`

                const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
                  e.stopPropagation()
                  e.preventDefault()
                  const screenEl = containerRef.current
                  if (!screenEl) return
                  const rect = screenEl.getBoundingClientRect()

                  const onMove = (ev: MouseEvent | TouchEvent) => {
                    const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
                    const clientY = 'touches' in ev ? ev.touches[0].clientY : ev.clientY
                    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
                    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
                    updateZoomMotion(zm.id, { targetX: nx, targetY: ny })
                  }
                  const onUp = () => {
                    document.removeEventListener('mousemove', onMove)
                    document.removeEventListener('mouseup', onUp)
                    document.removeEventListener('touchmove', onMove)
                    document.removeEventListener('touchend', onUp)
                  }
                  document.addEventListener('mousemove', onMove)
                  document.addEventListener('mouseup', onUp)
                  document.addEventListener('touchmove', onMove)
                  document.addEventListener('touchend', onUp)
                }

                return (
                  <div
                    className="absolute border-2 border-amber-400 border-dashed bg-amber-400/10 cursor-move z-20"
                    style={{ left, top, width: boxW, height: boxH }}
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                  >
                    {/* Center dot */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-amber-400 rounded-full" />
                    {/* Zoom label */}
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] px-1.5 py-px rounded-full font-mono whitespace-nowrap">
                      {zm.peakScale}x
                    </div>
                  </div>
                )
              })()}

              {/* Draggable Focus effect box — shown when focus effect is selected */}
              {selectedFocusEffectId && (() => {
                const fe = focusEffects.find(f => f.id === selectedFocusEffectId)
                if (!fe) return null
                const boxW = (fe.radiusX * 2 * 100) + '%'
                const boxH = (fe.radiusY * 2 * 100) + '%'
                const left = ((fe.centerX - fe.radiusX) * 100) + '%'
                const top = ((fe.centerY - fe.radiusY) * 100) + '%'

                const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
                  e.stopPropagation()
                  e.preventDefault()
                  const screenEl = containerRef.current
                  if (!screenEl) return
                  const rect = screenEl.getBoundingClientRect()

                  const onMove = (ev: MouseEvent | TouchEvent) => {
                    const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
                    const clientY = 'touches' in ev ? ev.touches[0].clientY : ev.clientY
                    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
                    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
                    updateFocusEffect(fe.id, { centerX: nx, centerY: ny })
                  }
                  const onUp = () => {
                    document.removeEventListener('mousemove', onMove)
                    document.removeEventListener('mouseup', onUp)
                    document.removeEventListener('touchmove', onMove)
                    document.removeEventListener('touchend', onUp)
                  }
                  document.addEventListener('mousemove', onMove)
                  document.addEventListener('mouseup', onUp)
                  document.addEventListener('touchmove', onMove)
                  document.addEventListener('touchend', onUp)
                }

                const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
                  e.stopPropagation()
                  e.preventDefault()
                  const screenEl = containerRef.current
                  if (!screenEl) return
                  const rect = screenEl.getBoundingClientRect()

                  const onMove = (ev: MouseEvent | TouchEvent) => {
                    const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
                    const clientY = 'touches' in ev ? ev.touches[0].clientY : ev.clientY
                    const currentX = (clientX - rect.left) / rect.width
                    const currentY = (clientY - rect.top) / rect.height
                    
                    const rx = Math.max(0.02, Math.min(0.48, Math.abs(currentX - fe.centerX)))
                    const ry = Math.max(0.02, Math.min(0.48, Math.abs(currentY - fe.centerY)))
                    updateFocusEffect(fe.id, { radiusX: rx, radiusY: ry })
                  }
                  const onUp = () => {
                    document.removeEventListener('mousemove', onMove)
                    document.removeEventListener('mouseup', onUp)
                    document.removeEventListener('touchmove', onMove)
                    document.removeEventListener('touchend', onUp)
                  }
                  document.addEventListener('mousemove', onMove)
                  document.addEventListener('mouseup', onUp)
                  document.addEventListener('touchmove', onMove)
                  document.addEventListener('touchend', onUp)
                }

                return (
                  <div
                    className={`absolute border-2 border-indigo-500 border-dashed bg-indigo-500/10 cursor-move z-20 ${
                      fe.shape === 'circle' ? 'rounded-full' : 'rounded-lg'
                    }`}
                    style={{ left, top, width: boxW, height: boxH }}
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                  >
                    {/* Center dot */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-indigo-500 rounded-full" />
                    
                    {/* Resize handle (bottom-right corner) */}
                    <div
                      className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize bg-indigo-500 border-l border-t border-white flex items-center justify-center rounded-tl-sm rounded-br-sm shadow"
                      onMouseDown={handleResizeStart}
                      onTouchStart={handleResizeStart}
                      style={{ transform: 'translate(4px, 4px)' }}
                    >
                      <div className="w-1.5 h-1.5 border-r border-b border-white rotate-45" />
                    </div>

                    {/* Effect type label */}
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] px-1.5 py-px rounded-full font-mono whitespace-nowrap">
                      {fe.type === 'blur' ? 'Privacy Blur' : `Magnify (${fe.intensity}x)`}
                    </div>
                  </div>
                )
              })()}

              {/* Animated Cursor */}
              {cursorStyle && (
                <div
                  className="absolute z-30 pointer-events-none drop-shadow-lg"
                  style={cursorStyle}
                >
                  <MousePointer2 className="w-6 h-6 text-white fill-black stroke-white stroke-2" />
                  {/* Visual click ripple */}
                  {currentTime - (activeCursorMotion?.startTime ?? 0) >= (activeCursorMotion?.duration ?? 0) * 0.3 &&
                   currentTime - (activeCursorMotion?.startTime ?? 0) <= (activeCursorMotion?.duration ?? 0) * 0.35 && (
                    <div className="absolute top-0 left-0 w-8 h-8 -translate-x-1/2 -translate-y-1/2 border-2 border-white/50 rounded-full animate-ping" />
                  )}
                </div>
              )}

              {/* Draggable Cursor target point — shown when cursor motion is selected */}
              {selectedCursorMotionId && (() => {
                const cm = cursorMotions.find(m => m.id === selectedCursorMotionId)
                if (!cm) return null
                const left = `${cm.targetX * 100}%`
                const top = `${cm.targetY * 100}%`

                const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
                  e.stopPropagation()
                  e.preventDefault()
                  const screenEl = containerRef.current
                  if (!screenEl) return
                  const rect = screenEl.getBoundingClientRect()

                  const onMove = (ev: MouseEvent | TouchEvent) => {
                    const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
                    const clientY = 'touches' in ev ? ev.touches[0].clientY : ev.clientY
                    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
                    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
                    updateCursorMotion(cm.id, { targetX: nx, targetY: ny })
                  }
                  const onUp = () => {
                    document.removeEventListener('mousemove', onMove)
                    document.removeEventListener('mouseup', onUp)
                    document.removeEventListener('touchmove', onMove)
                    document.removeEventListener('touchend', onUp)
                  }
                  document.addEventListener('mousemove', onMove)
                  document.addEventListener('mouseup', onUp)
                  document.addEventListener('touchmove', onMove)
                  document.addEventListener('touchend', onUp)
                }

                return (
                  <div
                    className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 cursor-move z-40 flex items-center justify-center"
                    style={{ left, top }}
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                  >
                    <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md animate-pulse" />
                    <div className="absolute -top-6 bg-blue-600 text-white text-[9px] px-1.5 py-px rounded-full font-mono whitespace-nowrap shadow-sm">
                      Target
                    </div>
                  </div>
                )
              })()}

              {/* Drag overlay */}
              {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20 border-2 border-blue-400 border-dashed rounded-[2.5rem] z-10">
                  <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto mb-1 text-blue-400" />
                    <p className="text-sm text-white font-medium">Drop to add</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
