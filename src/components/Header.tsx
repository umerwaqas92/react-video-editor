import { useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useEditorStore, createClip } from '@/store/editorStore'
import { Plus, ImageIcon, RotateCcw, Download, X } from 'lucide-react'
import { saveMediaAsset } from '@/lib/mediaStorage'
import { createManagedBlobUrl } from '@/lib/blobRegistry'

export function Header({ exporting, exportProgress, onExport, onCancelExport }: {
  exporting?: boolean
  exportProgress?: number
  onExport?: () => void
  onCancelExport?: () => void
}) {
  const videoInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const { addClips, playbackRate, setPlaybackRate, resetAll } = useEditorStore()

  const handleVideoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const fileList = Array.from(files)

    const processVideos = async () => {
      const newClips = await Promise.all(
        fileList.map(async (file) => {
          const meta = await new Promise<{ duration: number; width: number; height: number; url: string }>((resolve) => {
            const url = createManagedBlobUrl(file)
            const video = document.createElement('video')
            video.src = url
            video.onloadedmetadata = () => {
              resolve({
                duration: video.duration,
                width: video.videoWidth || 1920,
                height: video.videoHeight || 1080,
                url,
              })
            }
          })

          const clip = createClip({
            type: 'video',
            src: meta.url,
            name: file.name,
            duration: meta.duration,
            naturalWidth: meta.width,
            naturalHeight: meta.height,
          })

          const persisted = await saveMediaAsset(file, clip.id)
          return {
            ...clip,
            mediaStorageKey: persisted.mediaStorageKey,
            originalPath: persisted.originalPath,
          }
        })
      )
      addClips(newClips)
    }

    void processVideos()
    e.target.value = ''
  }, [addClips])

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const fileList = Array.from(files)

    const processImages = async () => {
      const newClips = await Promise.all(
        fileList.map(async (file) => {
          const meta = await new Promise<{ width: number; height: number; url: string }>((resolve) => {
            const url = createManagedBlobUrl(file)
            const img = new Image()
            img.src = url
            img.onload = () => {
              resolve({
                width: img.naturalWidth || 1920,
                height: img.naturalHeight || 1080,
                url,
              })
            }
          })

          const clip = createClip({
            type: 'image',
            src: meta.url,
            name: file.name,
            duration: 5,
            naturalWidth: meta.width,
            naturalHeight: meta.height,
          })

          const persisted = await saveMediaAsset(file, clip.id)
          return {
            ...clip,
            mediaStorageKey: persisted.mediaStorageKey,
            originalPath: persisted.originalPath,
          }
        })
      )
      addClips(newClips)
    }

    void processImages()
    e.target.value = ''
  }, [addClips])

  return (
    <header className="flex items-center justify-between px-3 md:px-4 py-2 bg-white border-b border-gray-200 gap-1">
      <div className="flex items-center gap-2">
        <h1 className="text-sm md:text-base font-semibold text-gray-800 hidden md:block">Video Editor</h1>
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        <Button variant="ghost" size="sm" onClick={() => videoInputRef.current?.click()} title="Add Video">
          <Plus className="w-4 h-4" />
          <span className="hidden md:inline">Add Video</span>
        </Button>
        <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={handleVideoSelect} />

        <Button variant="ghost" size="sm" onClick={() => imageInputRef.current?.click()} title="Add Image">
          <ImageIcon className="w-4 h-4" />
          <span className="hidden md:inline">Add Image</span>
        </Button>
        <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />

        <div className="w-px h-6 bg-gray-200 mx-0.5 md:mx-1 hidden md:block" />

        <div className="hidden md:flex items-center gap-1">
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

        <div className="w-px h-6 bg-gray-200 mx-0.5 md:mx-1 hidden md:block" />

        {exporting ? (
          <div className="flex items-center gap-1 md:gap-2">
            <div className="h-1.5 w-16 md:w-24 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${exportProgress}%` }} />
            </div>
            <span className="text-[10px] text-gray-500 font-mono">{exportProgress}%</span>
            <button onClick={onCancelExport} className="text-gray-400 hover:text-gray-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={onExport} title="Export video">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export</span>
          </Button>
        )}

        <div className="w-px h-6 bg-gray-200 mx-0.5 md:mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => { if (confirm('Reset everything? This cannot be undone.')) resetAll() }}
          title="Reset project"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Reset</span>
        </Button>

      </div>
    </header>
  )
}
