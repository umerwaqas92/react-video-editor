import { useRef, useEffect, useState, useCallback } from 'react'
import { drawFrame, preloadAssets, sizeCanvas, seekAllVideos, setOnSeeked } from '@/lib/canvasRenderer'
import { useEditorStore, createClip } from '@/store/editorStore'
import { ZoomIn, ZoomOut, Upload } from 'lucide-react'

export function PhoneMockup({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const innerRef = useRef<HTMLCanvasElement>(null)
  const resolvedRef = canvasRef || innerRef
  const containerRef = useRef<HTMLDivElement>(null)
  const sizedRef = useRef(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const { clips, background, currentTime, isPlaying, devicePadding, previewZoom, setPreviewZoom, addClip } = useEditorStore()

  useEffect(() => {
    preloadAssets(clips, background)
  }, [clips, background])

  useEffect(() => {
    if (isPlaying) return
    const s = useEditorStore.getState()
    seekAllVideos(s.clips, s.currentTime)
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
          seekAllVideos(s.clips, s.currentTime)
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      const url = URL.createObjectURL(file)

      if (file.type.startsWith('video/')) {
        const video = document.createElement('video')
        video.src = url
        video.onloadedmetadata = () => {
          addClip(createClip({ type: 'video', src: url, name: file.name, duration: video.duration }))
        }
      } else if (file.type.startsWith('image/')) {
        const img = new Image()
        img.src = url
        img.onload = () => {
          addClip(createClip({ type: 'image', src: url, name: file.name, duration: 5 }))
        }
      }
    }
  }, [addClip])

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden" style={{ padding: `${devicePadding}px` }}>
      <div
        className="flex items-center justify-center"
        style={{
          transform: `scale(${previewZoom})`,
          transformOrigin: 'center center',
          transition: 'transform 0.15s ease',
        }}
      >
        <div className="relative" style={{ width: 340 }}>
          <div className={`relative bg-neutral-900 rounded-[3rem] p-2.5 border-[3px] shadow-2xl transition-colors ${
            isDragOver ? 'border-blue-400 shadow-blue-500/20' : 'border-neutral-700'
          }`}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-2xl z-10" />
            <div
              ref={containerRef}
              className="relative bg-black rounded-[2.5rem] overflow-hidden"
              style={{ aspectRatio: '9/16' }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <canvas
                ref={resolvedRef}
                className="w-full h-full block"
              />
              {clips.length === 0 && !isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center text-white/60">
                    <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs">Add media to preview</p>
                  </div>
                </div>
              )}

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

      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-0.5 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-lg">
        <button
          onClick={() => setPreviewZoom(Math.max(0.25, previewZoom - 0.1))}
          className="p-1.5 text-gray-400 hover:text-gray-700 cursor-pointer"
          title="Zoom out preview"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] text-gray-500 font-mono min-w-[36px] text-center select-none">
          {Math.round(previewZoom * 100)}%
        </span>
        <button
          onClick={() => setPreviewZoom(Math.min(2, previewZoom + 0.1))}
          className="p-1.5 text-gray-400 hover:text-gray-700 cursor-pointer"
          title="Zoom in preview"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
