import { useEffect, useMemo, useRef, useState } from 'react'
import { Header } from '@/components/Header'
import { PhoneMockup } from '@/components/PhoneMockup'
import { Timeline } from '@/components/Timeline'
import { TrimEditor } from '@/components/TrimEditor'
import { ZoomEditor } from '@/components/ZoomEditor'
import { BackgroundPicker } from '@/components/BackgroundPicker'
import { usePlayer } from '@/hooks/usePlayer'
import { useExporter } from '@/hooks/useExporter'
import { useEditorStore } from '@/store/editorStore'
import { loadMediaAssetUrl } from '@/lib/mediaStorage'
import { clearMediaCache } from '@/lib/canvasRenderer'
import { ZoomIn, ZoomOut, PaintBucket, Scissors } from 'lucide-react'
import type { Clip } from '@/types'

type MobilePanel = 'background' | 'trim' | 'zoom' | null

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageHostRef = useRef<HTMLDivElement>(null)
  const restoredMediaRef = useRef(false)
  const { clips, currentTime, setCurrentTime, totalDuration, background, previewZoom, setPreviewZoom, stageAspect, devicePadding, setDevicePadding, isPlaying, selectedClipId, selectedZoomMotionId, zoomMotions, isBackgroundPickerOpen, setBackgroundPickerOpen } = useEditorStore()
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null)
  const { togglePlay, seek } = usePlayer(canvasRef)
  const { exporting, progress: exportProgress, startExport, cancelExport } = useExporter(canvasRef, stageSize)

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

      // Clear stale cached media from previous session
      clearMediaCache()

      // Restore clip sources from IndexedDB
      const restoredClipsRaw = await Promise.all(state.clips.map(async (clip): Promise<Clip | null> => {
        if (!clip.mediaStorageKey) {
          // Stale object URLs from old sessions cannot be restored.
          if (clip.src.startsWith('blob:')) return null
          return clip
        }
        const restoredUrl = await loadMediaAssetUrl(clip.mediaStorageKey)
        return restoredUrl ? { ...clip, src: restoredUrl } : null
      }))
      const restoredClips = restoredClipsRaw.filter((clip): clip is Clip => clip !== null)

      // Restore background image
      let restoredBg = state.background
      if (state.background.type === 'image' && state.background.mediaStorageKey) {
        const restoredBgUrl = await loadMediaAssetUrl(state.background.mediaStorageKey)
        if (restoredBgUrl) {
          restoredBg = { ...state.background, src: restoredBgUrl }
        } else {
          restoredBg = { type: 'color', value: '#000000' }
        }
      } else if (state.background.type === 'image' && state.background.src.startsWith('blob:')) {
        restoredBg = { type: 'color', value: '#000000' }
      }

      // Apply all at once — bypasses undo snapshots
      useEditorStore.setState({ clips: restoredClips, background: restoredBg })
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
        if (state.selectedZoomMotionId) {
          state.removeZoomMotion(state.selectedZoomMotionId)
        } else if (state.selectedClipId) {
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
    if (!Number.isFinite(devicePadding) || devicePadding < 0 || devicePadding > 120) {
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

  const hasSelection = selectedClipId !== null || selectedZoomMotionId !== null

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Header exporting={exporting} exportProgress={exportProgress} onExport={startExport} onCancelExport={cancelExport} />
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 flex overflow-hidden gap-3 p-2 md:p-3">
          {/* Background Picker — Desktop sidebar */}
          <div className="hidden md:block w-56 shrink-0">
            <BackgroundPicker />
          </div>

          {/* Preview Stage */}
          <div className="flex-1 relative overflow-hidden rounded-xl border border-gray-200 bg-gray-200/60">
            <div ref={stageHostRef} className="absolute inset-0 flex items-center justify-center p-2 md:p-3">
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

          {/* Trim + Zoom Panels — Desktop sidebar */}
          <div className="hidden md:flex w-64 shrink-0 flex-col gap-2">
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
            <ZoomEditor />
          </div>
        </div>

        {/* Mobile actions area: buttons row + inline panel content */}
        <div className="flex md:hidden flex-col bg-white border-t border-gray-200 px-2 py-1.5 gap-1.5">
          {/* Row 1: action toggle buttons + zoom */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (!isBackgroundPickerOpen) setBackgroundPickerOpen(true)
                setMobilePanel(mobilePanel === 'background' ? null : 'background')
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                mobilePanel === 'background'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <PaintBucket className="w-3.5 h-3.5" />
              BG
            </button>
            <button
              onClick={() => setMobilePanel(mobilePanel === 'trim' ? null : 'trim')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                mobilePanel === 'trim'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } ${!hasSelection ? 'opacity-40' : ''}`}
            >
              <Scissors className="w-3.5 h-3.5" />
              Trim
            </button>
            <button
              onClick={() => setMobilePanel(mobilePanel === 'zoom' ? null : 'zoom')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                mobilePanel === 'zoom'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } ${zoomMotions.length === 0 ? 'opacity-40' : ''}`}
            >
              <ZoomIn className="w-3.5 h-3.5" />
              Zoom
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setPreviewZoom(Math.max(0.25, safePreviewZoom - 0.1))}
                className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-gray-500 font-mono min-w-[32px] text-center select-none">
                {Math.round(safePreviewZoom * 100)}%
              </span>
              <button
                onClick={() => setPreviewZoom(Math.min(1, safePreviewZoom + 0.1))}
                className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Row 2: active panel content (replaces dialog) */}
          {mobilePanel && (
            <div className="max-h-[40vh] overflow-y-auto">
              {mobilePanel === 'background' && <BackgroundPicker />}
              {mobilePanel === 'trim' && <TrimEditor />}
              {mobilePanel === 'zoom' && <ZoomEditor />}
            </div>
          )}
        </div>

        <Timeline />
      </div>

    </div>
  )
}

export default App
