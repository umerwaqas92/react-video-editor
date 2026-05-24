import type { Clip } from '@/types'
import type { Background } from '@/store/editorStore'

const videoCache = new Map<string, HTMLVideoElement>()
const imageCache = new Map<string, HTMLImageElement>()

let onSeeked: (() => void) | null = null
export function setOnSeeked(cb: (() => void) | null) {
  onSeeked = cb
}

export function getVideoElement(src: string): HTMLVideoElement {
  if (!videoCache.has(src)) {
    const video = document.createElement('video')
    video.src = src
    video.muted = true
    video.preload = 'auto'
    // Trigger redraw when video data is ready
    video.addEventListener('canplay', () => {
      onSeeked?.()
    }, { once: true })
    videoCache.set(src, video)
  }
  return videoCache.get(src)!
}

export function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (imageCache.has(src)) {
      resolve(imageCache.get(src)!)
      return
    }
    const img = new Image()
    img.src = src
    img.onload = () => { imageCache.set(src, img); resolve(img) }
    img.onerror = reject
  })
}

export async function preloadAssets(clips: Clip[], background: Background) {
  const promises: Promise<unknown>[] = []
  if (background.type === 'image') {
    promises.push(preloadImage(background.src))
  }
  for (const clip of clips) {
    if (clip.type === 'image') {
      promises.push(preloadImage(clip.src))
    }
  }
  await Promise.all(promises)
}

export function sizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const w = Math.round(rect.width * dpr)
  const h = Math.round(rect.height * dpr)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
}

// --- Playback engine ---

let activeVideo: HTMLVideoElement | null = null
let activeClipId: string | null = null

function findClipAtTime(clips: Clip[], time: number): Clip | null {
  for (const clip of clips) {
    const eff = (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed
    if (time >= clip.startTime && time < clip.startTime + eff) {
      return clip
    }
  }
  return null
}

export function syncPlayback(clips: Clip[], time: number, playbackRate = 1) {
  const clip = findClipAtTime(clips, time)
  if (!clip || clip.type !== 'video') {
    // No active video clip — pause any playing video
    if (activeVideo) {
      activeVideo.pause()
      activeVideo = null
      activeClipId = null
    }
    return
  }

  if (clip.id === activeClipId) {
    // Same clip — video already playing, make sure it hasn't paused on its own
    if (activeVideo && activeVideo.paused) {
      activeVideo.play().catch(() => {})
    }
    return
  }

  // Different clip — switch
  if (activeVideo) {
    activeVideo.pause()
  }

  const video = getVideoElement(clip.src)
  const sourceTime = clip.trimStart + (time - clip.startTime) * clip.speed
  video.currentTime = Math.min(sourceTime, clip.duration - clip.trimEnd - 0.05)
  video.playbackRate = Math.max(0.25, Math.min(16, clip.speed * playbackRate))
  video.play().catch(() => {})
  activeVideo = video
  activeClipId = clip.id
}

export function stopAllVideos() {
  if (activeVideo) {
    activeVideo.pause()
    activeVideo = null
    activeClipId = null
  }
  // Also pause any other cached videos
  for (const [, video] of videoCache) {
    video.pause()
  }
}

export function seekAllVideos(clips: Clip[], time: number, playbackRate = 1) {
  const clip = findClipAtTime(clips, time)
  if (clip && clip.type === 'video') {
    const video = getVideoElement(clip.src)
    const sourceTime = clip.trimStart + (time - clip.startTime) * clip.speed
    const targetTime = Math.min(sourceTime, clip.duration - clip.trimEnd - 0.05)
    video.playbackRate = Math.max(0.25, Math.min(16, clip.speed * playbackRate))
    activeVideo = video
    activeClipId = clip.id

    const needsSeek = Math.abs(video.currentTime - targetTime) > 0.02
    if (needsSeek) {
      // Draw immediately with the currently available frame to avoid blank flashes during fast scrubbing.
      onSeeked?.()
      video.currentTime = targetTime
      const onSeekDone = () => {
        video.removeEventListener('seeked', onSeekDone)
        onSeeked?.()
      }
      video.addEventListener('seeked', onSeekDone, { once: true })
    } else {
      // Already at the right frame — redraw immediately
      onSeeked?.()
    }
  } else {
    activeVideo = null
    activeClipId = null
  }
}

export function drawFrame(
  canvas: HTMLCanvasElement,
  clips: Clip[],
  background: Background,
  currentTime: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = devicePixelRatio || 1
  const cssW = canvas.width / dpr
  const cssH = canvas.height / dpr
  if (cssW === 0 || cssH === 0) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // Background
  if (background.type === 'color') {
    ctx.fillStyle = background.value
    ctx.fillRect(0, 0, cssW, cssH)
  } else {
    const bgImg = imageCache.get(background.src)
    if (bgImg) {
      const scale = Math.max(cssW / bgImg.width, cssH / bgImg.height)
      const sw = bgImg.width * scale
      const sh = bgImg.height * scale
      ctx.drawImage(bgImg, (cssW - sw) / 2, (cssH - sh) / 2, sw, sh)
    } else {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, cssW, cssH)
    }
  }

  // Draw each visible clip
  for (const clip of clips) {
    const eff = (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed
    const clipEnd = clip.startTime + eff
    if (currentTime < clip.startTime || currentTime > clipEnd) continue

    if (clip.type === 'video') {
      const video = getVideoElement(clip.src)
      if (video.readyState >= 2) {
        const vw = video.videoWidth || cssW
        const vh = video.videoHeight || cssH
        const scale = Math.min(cssW / vw, cssH / vh)
        const sw = vw * scale
        const sh = vh * scale
        ctx.drawImage(video, (cssW - sw) / 2, (cssH - sh) / 2, sw, sh)
      }
    } else {
      const img = imageCache.get(clip.src)
      if (img) {
        const scale = Math.min(cssW / img.width, cssH / img.height)
        const sw = img.width * scale
        const sh = img.height * scale
        ctx.drawImage(img, (cssW - sw) / 2, (cssH - sh) / 2, sw, sh)
      }
    }
  }
}
