import { useEffect, useMemo, useRef, useState } from 'react'
import { Header } from '@/components/Header'
import { PhoneMockup } from '@/components/PhoneMockup'
import { Timeline } from '@/components/Timeline'
import { TrimEditor } from '@/components/TrimEditor'
import { BackgroundPicker } from '@/components/BackgroundPicker'
import { usePlayer } from '@/hooks/usePlayer'
import { useEditorStore } from '@/store/editorStore'
import { loadMediaAssetUrl } from '@/lib/mediaStorage'
import { ZoomIn, ZoomOut } from 'lucide-react'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageHostRef = useRef<HTMLDivElement>(null)
  const restoredMediaRef = useRef(false)
  const { clips, currentTime, setCurrentTime, totalDuration, background, previewZoom, setPreviewZoom, stageAspect, devicePadding, setDevicePadding, isPlaying } = useEditorStore()
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const { togglePlay, seek } = usePlayer(canvasRef)

  const stageRatio = useMemo(() => {
    const [w, h] = stageAspect.split('/').map(Number)
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 16 / 9
    return w / h
  }, [stageAspect])
  const safePreviewZoom = Number.isFinite(previewZoom) ? Math.min(1, Math.max(0.25, previewZoom)) : 1

  useEffect(() => {
    if (restoredMediaRef.current) return
    restoredMediaRef.current = true

    const restoreMedia = async () => {
      const state = useEditorStore.getState()

      await Promise.all(state.clips.map(async (clip) => {
        if (!clip.mediaStorageKey) return
        const restoredUrl = await loadMediaAssetUrl(clip.mediaStorageKey)
        if (restoredUrl) {
          useEditorStore.getState().updateClip(clip.id, { src: restoredUrl })
        }
      }))

      const freshState = useEditorStore.getState()
      if (freshState.background.type === 'image' && freshState.background.mediaStorageKey) {
        const restoredBgUrl = await loadMediaAssetUrl(freshState.background.mediaStorageKey)
        if (restoredBgUrl) {
          useEditorStore.getState().setBackground({
            ...freshState.background,
            src: restoredBgUrl,
          })
        }
      }
    }

    void restoreMedia()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useEditorStore.getState()
        if (state.selectedClipId) {
          state.removeClip(state.selectedClipId)
        }
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        seek(currentTime - 1 / 30)
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        seek(currentTime + 1 / 30)
      }

      if (e.key === 'Home') {
        e.preventDefault()
        setCurrentTime(0)
      }

      if (e.key === 'End') {
        e.preventDefault()
        setCurrentTime(totalDuration())
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, seek, currentTime, totalDuration, setCurrentTime])

  useEffect(() => {
    if (previewZoom !== safePreviewZoom) {
      setPreviewZoom(safePreviewZoom)
    }
  }, [previewZoom, safePreviewZoom, setPreviewZoom])

  useEffect(() => {
    if (!Number.isFinite(devicePadding) || devicePadding < 0 || devicePadding > 80) {
      setDevicePadding(40)
    }
  }, [devicePadding, setDevicePadding])

  useEffect(() => {
    const host = stageHostRef.current
    if (!host) return

    const updateStageSize = () => {
      const rect = host.getBoundingClientRect()
      const availableWidth = Math.max(0, rect.width)
      const availableHeight = Math.max(0, rect.height)
      if (availableWidth === 0 || availableHeight === 0) return

      let width = availableWidth
      let height = width / stageRatio
      if (height > availableHeight) {
        height = availableHeight
        width = height * stageRatio
      }

      setStageSize({ width, height })
    }

    const observer = new ResizeObserver(updateStageSize)
    observer.observe(host)
    updateStageSize()
    return () => observer.disconnect()
  }, [stageRatio])

  const stageMotion = useMemo(() => {
    const activeClip = clips.find((clip) => {
      const effectiveDuration = (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed
      return currentTime >= clip.startTime && currentTime < clip.startTime + effectiveDuration
    })

    const motion = activeClip?.motion
    if (!activeClip || !motion?.enabled) {
      return {
        scale: 1,
        tx: 0,
        ty: 0,
        originX: 50,
        originY: 50,
      }
    }

    const effectiveDuration = (activeClip.duration - activeClip.trimStart - activeClip.trimEnd) / activeClip.speed
    const progress = effectiveDuration > 0
      ? Math.min(1, Math.max(0, (currentTime - activeClip.startTime) / effectiveDuration))
      : 0
    const lerp = (start: number, end: number) => start + (end - start) * progress

    const scale = Math.max(0.1, lerp(motion.startScale, motion.endScale))
    const slideXPercent = lerp(motion.startX, motion.endX)
    const slideYPercent = lerp(motion.startY, motion.endY)
    const tx = (stageSize.width * slideXPercent) / 100
    const ty = (stageSize.height * slideYPercent) / 100

    return {
      scale,
      tx,
      ty,
      originX: Math.min(100, Math.max(0, motion.anchorX)),
      originY: Math.min(100, Math.max(0, motion.anchorY)),
    }
  }, [clips, currentTime, stageSize.height, stageSize.width])

  const bgStyle = background.type === 'color'
    ? { backgroundColor: background.value }
    : { backgroundImage: `url(${background.src})`, backgroundSize: 'cover' as const, backgroundPosition: 'center' as const }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Header />
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 flex overflow-hidden gap-3 p-3">
          <div className="w-56 shrink-0">
            <BackgroundPicker />
          </div>
          <div className="flex-1 relative overflow-hidden rounded-xl border border-gray-200 bg-gray-200/60">
            <div ref={stageHostRef} className="absolute inset-0 flex items-center justify-center p-3">
              <div
                className="relative overflow-hidden rounded-xl border border-gray-300 shadow-lg"
                style={{
                  width: `${Math.max(stageSize.width, 220)}px`,
                  height: `${Math.max(stageSize.height, 220 / stageRatio)}px`,
                  transform: `translate3d(${stageMotion.tx}px, ${stageMotion.ty}px, 0) scale(${safePreviewZoom * stageMotion.scale})`,
                  transformOrigin: `${stageMotion.originX}% ${stageMotion.originY}%`,
                  transition: isPlaying ? 'none' : 'transform 0.15s ease',
                  ...bgStyle,
                }}
              >
                <PhoneMockup canvasRef={canvasRef} />
              </div>
            </div>
          </div>
          <div className="w-64 shrink-0 flex flex-col gap-2">
            <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-lg p-1.5 flex items-center justify-center gap-0.5">
              <button
                onClick={() => setPreviewZoom(Math.max(0.25, safePreviewZoom - 0.1))}
                className="p-1.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                title="Zoom out preview"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-gray-500 font-mono min-w-[36px] text-center select-none">
                {Math.round(safePreviewZoom * 100)}%
              </span>
              <button
                onClick={() => setPreviewZoom(Math.min(1, safePreviewZoom + 0.1))}
                className="p-1.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                title="Zoom in preview"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
            <TrimEditor />
          </div>
        </div>
        <Timeline />
      </div>
    </div>
  )
}

export default App
