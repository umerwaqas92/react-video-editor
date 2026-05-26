export interface ClipMotion {
  enabled: boolean
  startScale: number
  endScale: number
  startX: number
  startY: number
  endX: number
  endY: number
  anchorX: number
  anchorY: number
}

export interface Clip {
  id: string
  type: 'video' | 'image'
  src: string
  mediaStorageKey?: string
  originalPath?: string
  name: string
  startTime: number
  duration: number
  trimStart: number
  trimEnd: number
  speed: number
  naturalWidth: number
  naturalHeight: number
  motion?: ClipMotion
}

export interface ZoomMotion {
  id: string
  startTime: number
  duration: number
  peakScale: number  // max zoom, e.g. 1.5 = 150%
  targetX: number   // center x as fraction 0-1, default 0.5
  targetY: number   // center y as fraction 0-1, default 0.5
}

export interface EditorState {
  clips: Clip[]
  zoomMotions: ZoomMotion[]
  selectedClipId: string | null
  background: { type: 'color'; value: string } | { type: 'image'; src: string; mediaStorageKey?: string; originalPath?: string }
  currentTime: number
  isPlaying: boolean
}

export interface FocusEffect {
  id: string
  startTime: number
  duration: number
  type: 'blur' | 'magnify'
  shape: 'circle' | 'rect'
  centerX: number
  centerY: number
  radiusX: number
  radiusY: number
  intensity: number
}

export interface CursorMotion {
  id: string
  startTime: number
  duration: number
  targetX: number   // click position x (0-1)
  targetY: number   // click position y (0-1)
  startSide: 'top' | 'bottom' | 'left' | 'right'
  size: number
  iconType: 'arrow' | 'hand'
}
