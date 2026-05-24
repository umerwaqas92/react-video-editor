import { useEffect, useRef } from 'react'
import { Header } from '@/components/Header'
import { PhoneMockup } from '@/components/PhoneMockup'
import { Timeline } from '@/components/Timeline'
import { TrimEditor } from '@/components/TrimEditor'
import { BackgroundPicker } from '@/components/BackgroundPicker'
import { usePlayer } from '@/hooks/usePlayer'
import { useEditorStore } from '@/store/editorStore'
import { loadMediaAssetUrl } from '@/lib/mediaStorage'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const restoredMediaRef = useRef(false)
  const { currentTime, setCurrentTime, totalDuration, background } = useEditorStore()
  const { togglePlay, seek } = usePlayer(canvasRef)

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

  const bgStyle = background.type === 'color'
    ? { backgroundColor: background.value }
    : { backgroundImage: `url(${background.src})`, backgroundSize: 'cover' as const, backgroundPosition: 'center' as const }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Header />
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Preview area — shows background behind device */}
        <div className="flex-1 relative overflow-hidden" style={bgStyle}>
          {/* Checkerboard when background is transparent/white */}
          <PhoneMockup canvasRef={canvasRef} />
          <TrimEditor />
          <BackgroundPicker />
        </div>
        <Timeline />
      </div>
    </div>
  )
}

export default App
