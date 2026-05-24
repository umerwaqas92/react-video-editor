import { useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useEditorStore, createClip } from '@/store/editorStore'
import { Play, Pause, Plus, ImageIcon } from 'lucide-react'

export function Header() {
  const videoInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const { addClip, isPlaying, setIsPlaying, setCurrentTime, totalDuration, currentTime } = useEditorStore()

  const handleVideoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.src = url
    video.onloadedmetadata = () => {
      console.log('[AddVideo] metadata:', { n: file.name, d: video.duration, w: video.videoWidth, h: video.videoHeight })
      addClip(createClip({
        type: 'video',
        src: url,
        name: file.name,
        duration: video.duration,
        naturalWidth: video.videoWidth || 1920,
        naturalHeight: video.videoHeight || 1080,
      }))
    }
    e.target.value = ''
  }, [addClip])

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.src = url
    img.onload = () => {
      console.log('[AddImage] loaded:', { n: file.name, w: img.naturalWidth, h: img.naturalHeight })
      addClip(createClip({
        type: 'image',
        src: url,
        name: file.name,
        duration: 5,
        naturalWidth: img.naturalWidth || 1920,
        naturalHeight: img.naturalHeight || 1080,
      }))
    }
    e.target.value = ''
  }, [addClip])

  const togglePlay = useCallback(() => {
    const state = useEditorStore.getState()
    if (state.totalDuration() === 0) return
    if (state.isPlaying) {
      setIsPlaying(false)
    } else {
      if (state.currentTime >= state.totalDuration()) {
        setCurrentTime(0)
      }
      setIsPlaying(true)
    }
  }, [setIsPlaying, setCurrentTime])

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
      <div className="flex items-center gap-2">
        <h1 className="text-base font-semibold text-gray-800">Video Editor</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => videoInputRef.current?.click()}>
          <Plus className="w-4 h-4" />
          Add Video
        </Button>
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />

        <Button variant="ghost" size="sm" onClick={() => imageInputRef.current?.click()}>
          <ImageIcon className="w-4 h-4" />
          Add Image
        </Button>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

        <div className="w-px h-6 bg-gray-200 mx-1" />

        <Button variant="outline" size="icon" onClick={togglePlay}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>

        <span className="text-xs text-gray-500 font-mono min-w-[80px] text-right">
          {formatTime(currentTime)} / {formatTime(totalDuration())}
        </span>
      </div>
    </header>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}
