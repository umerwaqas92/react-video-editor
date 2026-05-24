import { useState, useCallback, useRef } from 'react'
import { useEditorStore } from '@/store/editorStore'
import type { Clip, ZoomMotion } from '@/types'
import { drawFrame, seekAllVideos, getVideoElement } from '@/lib/canvasRenderer'

const EXPORT_FPS = 30
const EXPORT_LONG_EDGE = 1920
const DEFAULT_EXPORT_EXTENSION = 'webm'

type StageSize = { width: number; height: number }

function parseAspect(aspect: string, fallback = 16 / 9): number {
  const [w, h] = aspect.split('/').map(Number)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return fallback
  return w / h
}

function getExportSize(stageAspect: string): { width: number; height: number } {
  const ratio = parseAspect(stageAspect, 16 / 9)
  const width = ratio >= 1 ? EXPORT_LONG_EDGE : Math.round(EXPORT_LONG_EDGE * ratio)
  const height = ratio >= 1 ? Math.round(EXPORT_LONG_EDGE / ratio) : EXPORT_LONG_EDGE
  return {
    width: Math.max(2, Math.round(width / 2) * 2),
    height: Math.max(2, Math.round(height / 2) * 2),
  }
}

function getTargetBitrate(width: number, height: number, fps: number): number {
  // Bits-per-pixel-per-frame tuned for visually cleaner exports without huge files.
  const bpp = 0.16
  const estimate = Math.round(width * height * fps * bpp)
  return Math.min(45_000_000, Math.max(12_000_000, estimate))
}

function chooseRecorderFormat(): { mimeType: string; extension: string } {
  const formats = [
    { mimeType: 'video/mp4;codecs=h264', extension: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ]

  for (const format of formats) {
    if (MediaRecorder.isTypeSupported(format.mimeType)) return format
  }

  return { mimeType: '', extension: DEFAULT_EXPORT_EXTENSION }
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function drawCoverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = img.width * scale
  const sh = img.height * scale
  ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh)
}

function getClipAtTime(clips: Clip[], currentTime: number): Clip | null {
  for (const clip of clips) {
    const eff = (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed
    if (currentTime >= clip.startTime && currentTime < clip.startTime + eff) return clip
  }
  return null
}

function waitAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

async function waitForVideoFrameAtTime(clips: Clip[], currentTime: number): Promise<void> {
  const clip = getClipAtTime(clips, currentTime)
  if (!clip || clip.type !== 'video') return

  const video = getVideoElement(clip.src)
  const sourceTime = clip.trimStart + (currentTime - clip.startTime) * clip.speed
  const targetTime = Math.min(sourceTime, clip.duration - clip.trimEnd - 0.05)

  await new Promise<void>((resolve) => {
    let done = false
    const timeout = window.setTimeout(() => finish(), 700)

    const finish = () => {
      if (done) return
      done = true
      window.clearTimeout(timeout)
      resolve()
    }

    if (Math.abs(video.currentTime - targetTime) > 0.001) {
      const onSeeked = () => finish()
      video.addEventListener('seeked', onSeeked, { once: true })
      try {
        video.currentTime = targetTime
      } catch {
        finish()
      }
      return
    }

    if (video.readyState >= 2) {
      // Ensure compositor has pushed a decoded frame for drawImage.
      if ('requestVideoFrameCallback' in video) {
        ;(video as HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: (now: number, metadata: unknown) => void) => number
        }).requestVideoFrameCallback?.(() => finish())
      } else {
        requestAnimationFrame(() => finish())
      }
      return
    }

    const onCanPlay = () => finish()
    video.addEventListener('canplay', onCanPlay, { once: true })
  })
}

function getStageMotion(
  clips: Clip[],
  currentTime: number,
  stageWidth: number,
  stageHeight: number,
) {
  const activeClip = getClipAtTime(clips, currentTime)
  const motion = activeClip?.motion

  if (!activeClip || !motion?.enabled) {
    return { scale: 1, tx: 0, ty: 0, originX: 0.5, originY: 0.5 }
  }

  const eff = (activeClip.duration - activeClip.trimStart - activeClip.trimEnd) / activeClip.speed
  const progress = eff > 0 ? Math.min(1, Math.max(0, (currentTime - activeClip.startTime) / eff)) : 0
  const lerp = (start: number, end: number) => start + (end - start) * progress

  return {
    scale: Math.max(0.1, lerp(motion.startScale, motion.endScale)),
    tx: (stageWidth * lerp(motion.startX, motion.endX)) / 100,
    ty: (stageHeight * lerp(motion.startY, motion.endY)) / 100,
    originX: Math.min(1, Math.max(0, motion.anchorX / 100)),
    originY: Math.min(1, Math.max(0, motion.anchorY / 100)),
  }
}

function getZoomTransform(zoomMotions: ZoomMotion[], currentTime: number) {
  const ZOOM_IN = 0.2
  const ZOOM_OUT = 0.2
  let zoomScale = 1
  let originX = 0.5
  let originY = 0.5

  for (const motion of zoomMotions) {
    if (motion.duration <= 0) continue
    const elapsed = currentTime - motion.startTime
    if (elapsed < 0 || elapsed > motion.duration) continue

    const holdDuration = motion.duration - ZOOM_IN - ZOOM_OUT
    let p: number
    if (holdDuration <= 0) {
      const progress = elapsed / motion.duration
      p = (motion.peakScale - 1) * (progress <= 0.5 ? progress / 0.5 : (1 - progress) / 0.5)
    } else if (elapsed <= ZOOM_IN) {
      p = (motion.peakScale - 1) * (elapsed / ZOOM_IN)
    } else if (elapsed <= ZOOM_IN + holdDuration) {
      p = motion.peakScale - 1
    } else {
      p = (motion.peakScale - 1) * ((motion.duration - elapsed) / ZOOM_OUT)
    }

    const scale = 1 + p
    zoomScale *= scale
    if (scale > 1.01) {
      originX = motion.targetX
      originY = motion.targetY
    }
  }

  return { zoomScale, originX, originY }
}

function getExportPaddingPx(devicePadding: number, stageWidth: number, stageHeight: number, previewStageSize: StageSize): number {
  const clampedPadding = Math.max(0, Math.min(120, devicePadding))
  const previewLongEdge = Math.max(previewStageSize.width, previewStageSize.height)
  if (!Number.isFinite(previewLongEdge) || previewLongEdge < 100) return clampedPadding
  const exportLongEdge = Math.max(stageWidth, stageHeight)
  const scaledPadding = clampedPadding * (exportLongEdge / previewLongEdge)
  return Math.max(0, Math.min(Math.min(stageWidth, stageHeight) / 2 - 1, scaledPadding))
}

export function useExporter(canvasRef: React.RefObject<HTMLCanvasElement | null>, previewStageSize: StageSize) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)

  const drawComposedFrame = useCallback((screenCanvas: HTMLCanvasElement) => {
    const exportCanvas = exportCanvasRef.current
    if (!exportCanvas) return
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return

    const state = useEditorStore.getState()
    const stageWidth = exportCanvas.width
    const stageHeight = exportCanvas.height
    const { scale, tx, ty, originX, originY } = getStageMotion(state.clips, state.currentTime, stageWidth, stageHeight)
    const zoom = getZoomTransform(state.zoomMotions, state.currentTime)

    // Outer app area background (gray) so stage motion offset matches preview edges.
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(0, 0, stageWidth, stageHeight)

    ctx.save()
    const ox = stageWidth * originX
    const oy = stageHeight * originY
    ctx.translate(ox, oy)
    ctx.translate(tx, ty)
    ctx.scale(scale, scale)
    ctx.translate(-ox, -oy)

    if (state.background.type === 'color') {
      ctx.fillStyle = state.background.value
      ctx.fillRect(0, 0, stageWidth, stageHeight)
    } else if (bgImageRef.current) {
      drawCoverImage(ctx, bgImageRef.current, 0, 0, stageWidth, stageHeight)
    } else {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, stageWidth, stageHeight)
    }

    const padding = getExportPaddingPx(state.devicePadding, stageWidth, stageHeight, previewStageSize)
    const availableWidth = Math.max(1, stageWidth - padding * 2)
    const availableHeight = Math.max(1, stageHeight - padding * 2)
    const deviceRatio = parseAspect(state.deviceAspect, 9 / 16)
    const phoneWidth = Math.min(availableWidth, availableHeight * deviceRatio)
    const phoneHeight = phoneWidth / deviceRatio
    const phoneX = (stageWidth - phoneWidth) / 2
    const phoneY = (stageHeight - phoneHeight) / 2

    const zoomOriginX = phoneX + phoneWidth * zoom.originX
    const zoomOriginY = phoneY + phoneHeight * zoom.originY
    ctx.translate(zoomOriginX, zoomOriginY)
    ctx.scale(zoom.zoomScale, zoom.zoomScale)
    ctx.translate(-zoomOriginX, -zoomOriginY)

    const outerRadius = phoneWidth * 0.16
    const frameInset = Math.max(6, phoneWidth * 0.026)
    const screenRadius = Math.max(4, phoneWidth * 0.12)
    const screenX = phoneX + frameInset
    const screenY = phoneY + frameInset
    const screenW = phoneWidth - frameInset * 2
    const screenH = phoneHeight - frameInset * 2

    roundedRectPath(ctx, phoneX, phoneY, phoneWidth, phoneHeight, outerRadius)
    ctx.fillStyle = '#171717'
    ctx.fill()
    ctx.strokeStyle = '#3f3f46'
    ctx.lineWidth = Math.max(2, phoneWidth * 0.01)
    ctx.stroke()

    ctx.save()
    roundedRectPath(ctx, screenX, screenY, screenW, screenH, screenRadius)
    ctx.clip()
    ctx.drawImage(screenCanvas, screenX, screenY, screenW, screenH)
    ctx.restore()

    const notchW = screenW * 0.28
    const notchH = Math.max(6, screenH * 0.032)
    const notchX = screenX + (screenW - notchW) / 2
    const notchY = screenY
    roundedRectPath(ctx, notchX, notchY, notchW, notchH, notchH / 2)
    ctx.fillStyle = '#000000'
    ctx.fill()

    ctx.restore()
  }, [previewStageSize])

  const startExport = useCallback(async () => {
    if (exporting) return
    const screenCanvas = canvasRef.current
    if (!screenCanvas) return

    const state = useEditorStore.getState()
    const duration = state.totalDuration()
    if (duration <= 0) {
      alert('Nothing to export. Add clips first.')
      return
    }

    if (state.background.type === 'image') {
      if (!bgImageRef.current || bgImageRef.current.src !== state.background.src) {
        const img = new Image()
        img.src = state.background.src
        await new Promise<void>((resolve) => {
          img.onload = () => resolve()
          img.onerror = () => resolve()
        })
        bgImageRef.current = img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null
      }
    } else {
      bgImageRef.current = null
    }

    const { width, height } = getExportSize(state.stageAspect)
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = width
    exportCanvas.height = height
    exportCanvasRef.current = exportCanvas

    const stream = exportCanvas.captureStream(EXPORT_FPS)
    streamRef.current = stream
    const { mimeType, extension } = chooseRecorderFormat()
    const videoBitsPerSecond = getTargetBitrate(width, height, EXPORT_FPS)

    chunksRef.current = []
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond })
      : new MediaRecorder(stream, { videoBitsPerSecond })
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blobType = mimeType || 'video/webm'
      const blob = new Blob(chunksRef.current, { type: blobType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-preview.${extension}`
      a.click()
      URL.revokeObjectURL(url)
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
      exportCanvasRef.current = null
      recorderRef.current = null
      useEditorStore.getState().setIsPlaying(false)
      setExporting(false)
      setProgress(100)
    }

    // Prime frame 0 before recording so exported video starts with visible media.
    state.setIsPlaying(false)
    state.setCurrentTime(0)
    seekAllVideos(state.clips, 0, state.playbackRate)
    await waitForVideoFrameAtTime(state.clips, 0)
    drawFrame(screenCanvas, state.clips, state.background, 0)
    drawComposedFrame(screenCanvas)
    await waitAnimationFrame()

    recorder.start()
    setExporting(true)
    setProgress(0)

    state.setCurrentTime(0)
    state.setIsPlaying(true)

    const trackProgress = () => {
      if (!recorderRef.current || recorderRef.current.state === 'inactive') return
      const s = useEditorStore.getState()
      drawComposedFrame(screenCanvas)
      if (s.currentTime >= duration - 0.05) {
        recorderRef.current.stop()
        return
      }
      setProgress(Math.round((s.currentTime / duration) * 100))
      requestAnimationFrame(trackProgress)
    }
    requestAnimationFrame(trackProgress)
  }, [canvasRef, drawComposedFrame, exporting])

  const cancelExport = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    exportCanvasRef.current = null
    recorderRef.current = null
    useEditorStore.getState().setIsPlaying(false)
    setExporting(false)
    setProgress(0)
  }, [])

  return { exporting, progress, startExport, cancelExport }
}
