import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Clip } from '@/types'
import { deleteMediaAsset } from '@/lib/mediaStorage'

export type Background =
  | { type: 'color'; value: string }
  | { type: 'image'; src: string; mediaStorageKey?: string; originalPath?: string }

interface EditorStore {
  clips: Clip[]
  selectedClipId: string | null
  background: Background
  devicePadding: number
  previewZoom: number
  timelineZoom: number
  isBackgroundPickerOpen: boolean
  deviceAspect: string
  currentTime: number
  isPlaying: boolean

  addClip: (clip: Clip) => void
  removeClip: (id: string) => void
  updateClip: (id: string, updates: Partial<Clip>) => void
  selectClip: (id: string | null) => void
  setBackground: (bg: Background) => void
  setDevicePadding: (padding: number) => void
  setPreviewZoom: (zoom: number) => void
  setTimelineZoom: (zoom: number) => void
  setBackgroundPickerOpen: (open: boolean) => void
  setDeviceAspect: (aspect: string) => void
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
    naturalWidth: 1920,
    naturalHeight: 1080,
    ...overrides,
  }
}

export const useEditorStore = create<EditorStore>()(persist((set, get) => ({
  clips: [],
  selectedClipId: null,
  background: { type: 'color', value: '#000000' },
  devicePadding: 40,
  previewZoom: 1,
  timelineZoom: 20,
  isBackgroundPickerOpen: false,
  deviceAspect: '9/16',
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
    const mediaStorageKey = clip.mediaStorageKey
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
    if (mediaStorageKey) {
      void deleteMediaAsset(mediaStorageKey)
    }
  },

  updateClip: (id, updates) => {
    set(state => ({
      clips: state.clips.map(c => c.id === id ? { ...c, ...updates } : c),
    }))
  },

  selectClip: (id) => {
    if (id) {
      const clip = get().clips.find(c => c.id === id)
      if (clip?.naturalWidth && clip?.naturalHeight) {
        set({ selectedClipId: id, deviceAspect: `${clip.naturalWidth}/${clip.naturalHeight}` })
      } else {
        set({ selectedClipId: id })
      }
    } else {
      set({ selectedClipId: null })
    }
  },

  setBackground: (bg) => set({ background: bg }),

  setDevicePadding: (padding) => set({ devicePadding: padding }),

  setPreviewZoom: (zoom) => set({ previewZoom: zoom }),

  setTimelineZoom: (zoom) => set({ timelineZoom: zoom }),

  setBackgroundPickerOpen: (open) => set({ isBackgroundPickerOpen: open }),

  setDeviceAspect: (aspect) => set({ deviceAspect: aspect }),

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
}), {
  name: 'react-video-editor-state',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    clips: state.clips,
    selectedClipId: state.selectedClipId,
    background: state.background,
    devicePadding: state.devicePadding,
    previewZoom: state.previewZoom,
    timelineZoom: state.timelineZoom,
    isBackgroundPickerOpen: state.isBackgroundPickerOpen,
    deviceAspect: state.deviceAspect,
    currentTime: state.currentTime,
    isPlaying: state.isPlaying,
  }),
}))
