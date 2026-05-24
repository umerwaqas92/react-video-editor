import { create } from 'zustand'
import type { Clip } from '@/types'

export type Background = { type: 'color'; value: string } | { type: 'image'; src: string }

interface EditorStore {
  clips: Clip[]
  selectedClipId: string | null
  background: Background
  devicePadding: number
  currentTime: number
  isPlaying: boolean

  addClip: (clip: Clip) => void
  removeClip: (id: string) => void
  updateClip: (id: string, updates: Partial<Clip>) => void
  selectClip: (id: string | null) => void
  setBackground: (bg: Background) => void
  setDevicePadding: (padding: number) => void
  setCurrentTime: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  getClipEndTime: (clip: Clip) => number
  getEffectiveDuration: (clip: Clip) => number
  totalDuration: () => number
  reorderClips: (fromIndex: number, toIndex: number) => void
}

let idCounter = 0
function generateId(): string {
  return `clip_${Date.now()}_${++idCounter}`
}

export function createClip(overrides: Partial<Clip> & { type: 'video' | 'image'; src: string; name: string; duration: number }): Clip {
  return {
    id: generateId(),
    startTime: 0,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    ...overrides,
  }
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  clips: [],
  selectedClipId: null,
  background: { type: 'color', value: '#000000' },
  devicePadding: 40,
  currentTime: 0,
  isPlaying: false,

  addClip: (clip) => {
    const state = get()
    const lastClip = state.clips[state.clips.length - 1]
    const startTime = lastClip ? lastClip.startTime + get().getEffectiveDuration(lastClip) : 0
    set({ clips: [...state.clips, { ...clip, startTime }] })
  },

  removeClip: (id) => {
    const state = get()
    const clip = state.clips.find(c => c.id === id)
    if (!clip) return
    const removedStart = clip.startTime
    const removedDuration = get().getEffectiveDuration(clip)
    const newClips = state.clips
      .filter(c => c.id !== id)
      .map(c => {
        if (c.startTime > removedStart) {
          return { ...c, startTime: c.startTime - removedDuration }
        }
        return c
      })
    set({
      clips: newClips,
      selectedClipId: state.selectedClipId === id ? null : state.selectedClipId,
    })
  },

  updateClip: (id, updates) => {
    set(state => ({
      clips: state.clips.map(c => c.id === id ? { ...c, ...updates } : c),
    }))
  },

  selectClip: (id) => set({ selectedClipId: id }),

  setBackground: (bg) => set({ background: bg }),

  setDevicePadding: (padding) => set({ devicePadding: padding }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  getClipEndTime: (clip) => clip.startTime + get().getEffectiveDuration(clip),

  getEffectiveDuration: (clip) => (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed,

  totalDuration: () => {
    const state = get()
    if (state.clips.length === 0) return 0
    const lastClip = state.clips[state.clips.length - 1]
    return lastClip.startTime + get().getEffectiveDuration(lastClip)
  },

  reorderClips: (fromIndex, toIndex) => {
    set(state => {
      const newClips = [...state.clips]
      const [removed] = newClips.splice(fromIndex, 1)
      newClips.splice(toIndex, 0, removed)

      let currentTime = 0
      const repositioned = newClips.map(clip => {
        const updated = { ...clip, startTime: currentTime }
        currentTime += get().getEffectiveDuration(clip)
        return updated
      })

      return { clips: repositioned }
    })
  },
}))
