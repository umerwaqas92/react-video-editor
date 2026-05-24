import { useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { drawFrame, syncPlayback, stopAllVideos, seekAllVideos } from '@/lib/canvasRenderer'

export function usePlayer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const isPlaying = useEditorStore(s => s.isPlaying)
  const playbackRate = useEditorStore(s => s.playbackRate)

  const animate = useCallback(function animateFrame(timestamp: number) {
    if (!useEditorStore.getState().isPlaying) return

    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp
    const delta = ((timestamp - lastTimeRef.current) / 1000) * playbackRate
    lastTimeRef.current = timestamp

    const state = useEditorStore.getState()
    const canvas = canvasRef.current
    if (!canvas || canvas.width === 0) {
      rafRef.current = requestAnimationFrame(animateFrame)
      return
    }

    const duration = state.totalDuration()
    const newTime = state.currentTime + delta

    if (duration > 0 && newTime >= duration) {
      state.setCurrentTime(0)
      state.setIsPlaying(false)
      stopAllVideos()
      drawFrame(canvas, state.clips, state.background, 0)
      return
    }

    state.setCurrentTime(Math.min(newTime, duration))
    syncPlayback(state.clips, state.currentTime, state.playbackRate)
    drawFrame(canvas, state.clips, state.background, state.currentTime)

    rafRef.current = requestAnimationFrame(animateFrame)
  }, [canvasRef, playbackRate])

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = 0
      const state = useEditorStore.getState()
      seekAllVideos(state.clips, state.currentTime, state.playbackRate)
      rafRef.current = requestAnimationFrame(animate)
    } else {
      stopAllVideos()
      cancelAnimationFrame(rafRef.current)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, animate])

  const togglePlay = useCallback(() => {
    const state = useEditorStore.getState()
    if (state.totalDuration() === 0) return
    if (state.isPlaying) {
      state.setIsPlaying(false)
    } else {
      if (state.currentTime >= state.totalDuration()) {
        state.setCurrentTime(0)
      }
      state.setIsPlaying(true)
    }
  }, [])

  const seek = useCallback((time: number) => {
    const state = useEditorStore.getState()
    const clamped = Math.max(0, Math.min(time, state.totalDuration()))
    state.setCurrentTime(clamped)
    seekAllVideos(state.clips, clamped, state.playbackRate)
  }, [])

  return { togglePlay, seek }
}
