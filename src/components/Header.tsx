import { useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useEditorStore, createClip } from '@/store/editorStore'
import { Plus, ImageIcon } from 'lucide-react'
import { saveMediaAsset } from '@/lib/mediaStorage'

export function Header() {
  const videoInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const { addClip, playbackRate, setPlaybackRate } = useEditorStore()

  const handleVideoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.src = url
    video.onloadedmetadata = async () => {
      console.log('[AddVideo] metadata:', { n: file.name, d: video.duration, w: video.videoWidth, h: video.videoHeight })
      const clip = createClip({
        type: 'video',
        src: url,
        name: file.name,
        duration: video.duration,
        naturalWidth: video.videoWidth || 1920,
        naturalHeight: video.videoHeight || 1080,
      })
      const persisted = await saveMediaAsset(file, clip.id)
      addClip({
        ...clip,
        mediaStorageKey: persisted.mediaStorageKey,
        originalPath: persisted.originalPath,
      })
    }
    e.target.value = ''
  }, [addClip])

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.src = url
    img.onload = async () => {
      console.log('[AddImage] loaded:', { n: file.name, w: img.naturalWidth, h: img.naturalHeight })
      const clip = createClip({
        type: 'image',
        src: url,
        name: file.name,
        duration: 5,
        naturalWidth: img.naturalWidth || 1920,
        naturalHeight: img.naturalHeight || 1080,
      })
      const persisted = await saveMediaAsset(file, clip.id)
      addClip({
        ...clip,
        mediaStorageKey: persisted.mediaStorageKey,
        originalPath: persisted.originalPath,
      })
    }
    e.target.value = ''
  }, [addClip])

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

        <div className="flex items-center gap-1">
          {[1, 2, 3].map(rate => (
            <button
              key={rate}
              onClick={() => setPlaybackRate(rate)}
              className={`px-1.5 py-0.5 text-[10px] rounded font-mono cursor-pointer transition-colors ${
                playbackRate === rate ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

      </div>
    </header>
  )
}
