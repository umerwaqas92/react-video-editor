import { useRef, useEffect } from 'react'
import { drawFrame, preloadAssets, sizeCanvas } from '@/lib/canvasRenderer'
import { useEditorStore } from '@/store/editorStore'

export function PhoneMockup({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const innerRef = useRef<HTMLCanvasElement>(null)
  const resolvedRef = canvasRef || innerRef
  const containerRef = useRef<HTMLDivElement>(null)
  const sizedRef = useRef(false)
  const { clips, background, currentTime, isPlaying, devicePadding } = useEditorStore()

  useEffect(() => {
    preloadAssets(clips, background)
  }, [clips, background])

  // Reliable canvas sizing via ResizeObserver
  useEffect(() => {
    const canvas = resolvedRef.current
    if (!canvas) return

    const observer = new ResizeObserver(() => {
      sizeCanvas(canvas)
      sizedRef.current = true
    })
    observer.observe(canvas)
    // Also try immediate sizing
    sizeCanvas(canvas)
    return () => observer.disconnect()
  }, [resolvedRef])

  // Redraw on state change when NOT playing
  useEffect(() => {
    if (isPlaying) return
    const canvas = resolvedRef.current
    if (!canvas || canvas.width === 0 || canvas.height === 0) return
    drawFrame(canvas, clips, background, currentTime)
  }, [clips, background, currentTime, isPlaying, resolvedRef])

  return (
    <div className="relative w-full h-full flex items-center justify-center" style={{ padding: `${devicePadding}px` }}>
      <div className="relative max-h-full" style={{ width: 280, maxWidth: '100%' }}>
        <div className="relative bg-neutral-900 rounded-[3rem] p-2.5 border-[3px] border-neutral-700 shadow-2xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-2xl z-10" />
          <div
            ref={containerRef}
            className="relative bg-black rounded-[2.5rem] overflow-hidden"
            style={{ aspectRatio: '9/16' }}
          >
            <canvas
              ref={resolvedRef}
              className="w-full h-full block"
            />
            {clips.length === 0 && (
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
          </div>
        </div>
      </div>
    </div>
  )
}
