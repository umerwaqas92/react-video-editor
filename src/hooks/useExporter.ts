import { useState, useCallback, useRef } from 'react'
import { useEditorStore } from '@/store/editorStore'

export function useExporter(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startExport = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const state = useEditorStore.getState()
    const duration = state.totalDuration()
    if (duration <= 0) {
      alert('Nothing to export. Add clips first.')
      return
    }

    const stream = canvas.captureStream(30)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm'

    chunksRef.current = []
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 })
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'export.webm'
      a.click()
      URL.revokeObjectURL(url)
      setExporting(false)
      setProgress(100)
    }

    // Reset to start and play through
    state.setCurrentTime(0)
    state.setIsPlaying(false)

    // Start recording
    recorder.start()
    setExporting(true)
    setProgress(0)

    // Start playback
    const startTime = performance.now()
    const totalMs = duration * 1000

    // Use requestAnimationFrame for progress
    const trackProgress = () => {
      if (!recorderRef.current || recorderRef.current.state === 'inactive') return
      // Check if we should stop
      const state = useEditorStore.getState()
      if (state.currentTime >= duration - 0.05) {
        recorder.stop()
        state.setIsPlaying(false)
        return
      }
      setProgress(Math.round((state.currentTime / duration) * 100))
      requestAnimationFrame(trackProgress)
    }

    state.setIsPlaying(true)
    requestAnimationFrame(trackProgress)
  }, [canvasRef])

  const cancelExport = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop()
    }
    useEditorStore.getState().setIsPlaying(false)
    setExporting(false)
    setProgress(0)
  }, [])

  return { exporting, progress, startExport, cancelExport }
}
