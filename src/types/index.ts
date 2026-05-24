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
}

export interface EditorState {
  clips: Clip[]
  selectedClipId: string | null
  background: { type: 'color'; value: string } | { type: 'image'; src: string; mediaStorageKey?: string; originalPath?: string }
  currentTime: number
  isPlaying: boolean
}
