import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Clip, ZoomMotion } from '@/types'
import { deleteMediaAsset } from '@/lib/mediaStorage'

export type Background =
  | { type: 'color'; value: string }
  | { type: 'image'; src: string; mediaStorageKey?: string; originalPath?: string }

interface EditorStore {
  clips: Clip[]
  zoomMotions: ZoomMotion[]
  selectedClipId: string | null
  selectedZoomMotionId: string | null
  background: Background
  devicePadding: number
  previewZoom: number
  timelineZoom: number
  isBackgroundPickerOpen: boolean
  stageAspect: string
  deviceAspect: string
  playbackRate: number
  currentTime: number
  isPlaying: boolean

  addClip: (clip: Clip) => void
  duplicateClip: (id: string) => void
  removeClip: (id: string) => void
  updateClip: (id: string, updates: Partial<Clip>) => void
  selectClip: (id: string | null) => void
  setBackground: (bg: Background) => void
  setDevicePadding: (padding: number) => void
  setPreviewZoom: (zoom: number) => void
  setTimelineZoom: (zoom: number) => void
  setBackgroundPickerOpen: (open: boolean) => void
  setStageAspect: (aspect: string) => void
  setDeviceAspect: (aspect: string) => void
  setPlaybackRate: (rate: number) => void
  setCurrentTime: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  getClipEndTime: (clip: Clip) => number
  getEffectiveDuration: (clip: Clip) => number
  totalDuration: () => number
  reorderClips: (fromIndex: number, toIndex: number) => void
  splitClipAtTime: (time: number) => boolean
  recalculateTimeline: () => void

  addZoomMotion: (motion: ZoomMotion) => void
  duplicateZoomMotion: (id: string) => void
  removeZoomMotion: (id: string) => void
  updateZoomMotion: (id: string, updates: Partial<ZoomMotion>) => void
  selectZoomMotion: (id: string | null) => void

  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  _history: string[]
  _future: string[]
  _pushSnapshot: () => void
  resetAll: () => void
}

let idCounter = 0
function generateId(): string {
  return `clip_${Date.now()}_${++idCounter}`
}

export function createZoomMotion(overrides?: Partial<ZoomMotion>): ZoomMotion {
  return {
    id: `zoom_${Date.now()}_${++idCounter}`,
    startTime: 0,
    duration: 5,
    peakScale: 1.5,
    targetX: 0.5,
    targetY: 0.5,
    ...overrides,
  }
}

function takeSnapshot(state: EditorStore): string {
  return JSON.stringify({
    clips: state.clips,
    zoomMotions: state.zoomMotions,
    background: state.background,
    devicePadding: state.devicePadding,
    stageAspect: state.stageAspect,
    deviceAspect: state.deviceAspect,
  })
}

function applySnapshot(json: string): Partial<EditorStore> {
  return JSON.parse(json) as Partial<EditorStore>
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
  zoomMotions: [],
  selectedClipId: null,
  selectedZoomMotionId: null,
  background: { type: 'color', value: '#000000' },
  devicePadding: 40,
  previewZoom: 1,
  timelineZoom: 20,
  isBackgroundPickerOpen: false,
  stageAspect: '16/9',
  deviceAspect: '9/16',
  playbackRate: 1,
  currentTime: 0,
  isPlaying: false,
  _history: [] as string[],
  _future: [] as string[],
  canUndo: false,
  canRedo: false,

  _pushSnapshot: () => {
    const state = get()
    const json = takeSnapshot(state)
    set({ _history: [...state._history.slice(-50), json], _future: [], canUndo: true, canRedo: false })
  },

  undo: () => {
    const state = get()
    if (state._history.length === 0) return
    const current = takeSnapshot(state)
    const prev = state._history[state._history.length - 1]
    set({
      ...applySnapshot(prev),
      _history: state._history.slice(0, -1),
      _future: [...state._future, current],
      canUndo: state._history.length > 1,
      canRedo: true,
    })
  },

  redo: () => {
    const state = get()
    if (state._future.length === 0) return
    const current = takeSnapshot(state)
    const next = state._future[state._future.length - 1]
    set({
      ...applySnapshot(next),
      _history: [...state._history, current],
      _future: state._future.slice(0, -1),
      canUndo: true,
      canRedo: state._future.length > 1,
    })
  },

  addClip: (clip) => {
    get()._pushSnapshot()
    const state = get()
    const lastClip = state.clips[state.clips.length - 1]
    const startTime = lastClip ? lastClip.startTime + get().getEffectiveDuration(lastClip) : 0
    set({ clips: [...state.clips, { ...clip, startTime }] })
  },

  duplicateClip: (id) => {
    get()._pushSnapshot()
    const state = get()
    const index = state.clips.findIndex(c => c.id === id)
    if (index === -1) return
    const original = state.clips[index]
    const duplicate: Clip = {
      ...original,
      id: generateId(),
      startTime: original.startTime + get().getEffectiveDuration(original),
    }
    const dupeDuration = get().getEffectiveDuration(duplicate)
    const newClips = [
      ...state.clips.slice(0, index + 1),
      duplicate,
      ...state.clips.slice(index + 1).map(c => ({
        ...c,
        startTime: c.startTime + dupeDuration,
      })),
    ]
    set({ clips: newClips, selectedClipId: duplicate.id, selectedZoomMotionId: null })
  },

  removeClip: (id) => {
    get()._pushSnapshot()
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
    get()._pushSnapshot()
    set(state => ({
      clips: state.clips.map(c => c.id === id ? { ...c, ...updates } : c),
    }))
  },

  selectClip: (id) => {
    if (id) {
      const clip = get().clips.find(c => c.id === id)
      if (clip?.naturalWidth && clip?.naturalHeight) {
        set({ selectedClipId: id, selectedZoomMotionId: null, deviceAspect: `${clip.naturalWidth}/${clip.naturalHeight}` })
      } else {
        set({ selectedClipId: id, selectedZoomMotionId: null })
      }
    } else {
      set({ selectedClipId: null, selectedZoomMotionId: null })
    }
  },

  setBackground: (bg) => { get()._pushSnapshot(); set({ background: bg }) },

  setDevicePadding: (padding) => { get()._pushSnapshot(); set({ devicePadding: padding }) },

  setPreviewZoom: (zoom) => set({ previewZoom: zoom }),

  setTimelineZoom: (zoom) => set({ timelineZoom: zoom }),

  setBackgroundPickerOpen: (open) => set({ isBackgroundPickerOpen: open }),

  setStageAspect: (aspect) => { get()._pushSnapshot(); set({ stageAspect: aspect }) },

  setDeviceAspect: (aspect) => { get()._pushSnapshot(); set({ deviceAspect: aspect }) },

  setPlaybackRate: (rate) => set({ playbackRate: Math.max(0.25, Math.min(4, rate)) }),

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
    get()._pushSnapshot()
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

  splitClipAtTime: (time) => {
    get()._pushSnapshot()
    const state = get()
    const minSegment = 1 / 30
    const index = state.clips.findIndex((clip) => {
      const effective = (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed
      return time > clip.startTime + minSegment && time < clip.startTime + effective - minSegment
    })
    if (index === -1) return false

    const original = state.clips[index]
    const sourceCut = original.trimStart + (time - original.startTime) * original.speed
    const firstClip: Clip = {
      ...original,
      trimEnd: Math.max(0, original.duration - sourceCut),
    }
    const secondClip: Clip = {
      ...original,
      id: generateId(),
      trimStart: Math.min(original.duration, sourceCut),
      startTime: time,
    }
    const newClips = [
      ...state.clips.slice(0, index),
      firstClip,
      secondClip,
      ...state.clips.slice(index + 1),
    ]
    set({ clips: newClips, selectedClipId: secondClip.id })
    return true
  },

  recalculateTimeline: () => {
    get()._pushSnapshot()
    set(state => {
      let t = 0
      const recalculated = state.clips.map(clip => {
        const updated = { ...clip, startTime: t }
        t += (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed
        return updated
      })
      return { clips: recalculated }
    })
  },

  addZoomMotion: (motion) => {
    get()._pushSnapshot()
    set(state => ({ zoomMotions: [...state.zoomMotions, motion] }))
  },

  duplicateZoomMotion: (id) => {
    get()._pushSnapshot()
    const state = get()
    const original = state.zoomMotions.find(m => m.id === id)
    if (!original) return
    const duplicate: ZoomMotion = {
      ...original,
      id: `zoom_${Date.now()}_${++idCounter}`,
      startTime: original.startTime + original.duration + 0.5,
    }
    set({ zoomMotions: [...state.zoomMotions, duplicate], selectedZoomMotionId: duplicate.id, selectedClipId: null })
  },

  removeZoomMotion: (id) => {
    get()._pushSnapshot()
    set(state => ({ zoomMotions: state.zoomMotions.filter(m => m.id !== id) }))
  },

  updateZoomMotion: (id, updates) => {
    get()._pushSnapshot()
    set(state => ({
      zoomMotions: state.zoomMotions.map(m => m.id === id ? { ...m, ...updates } : m),
    }))
  },

  selectZoomMotion: (id) => set({ selectedZoomMotionId: id, selectedClipId: null }),

  resetAll: () => {
    // Clear IndexedDB
    const state = get()
    for (const clip of state.clips) {
      if (clip.mediaStorageKey) {
        deleteMediaAsset(clip.mediaStorageKey).catch(() => {})
      }
    }
    set({
      clips: [],
      zoomMotions: [],
      selectedClipId: null,
      selectedZoomMotionId: null,
      background: { type: 'color', value: '#000000' },
      devicePadding: 40,
      previewZoom: 1,
      stageAspect: '16/9',
      deviceAspect: '9/16',
      playbackRate: 1,
      currentTime: 0,
      isPlaying: false,
      _history: [],
      _future: [],
      canUndo: false,
      canRedo: false,
    })
  },
}), {
  name: 'react-video-editor-state',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    clips: state.clips,
    zoomMotions: state.zoomMotions,
    selectedClipId: state.selectedClipId,
    selectedZoomMotionId: state.selectedZoomMotionId,
    background: state.background,
    devicePadding: state.devicePadding,
    previewZoom: state.previewZoom,
    timelineZoom: state.timelineZoom,
    isBackgroundPickerOpen: state.isBackgroundPickerOpen,
    stageAspect: state.stageAspect,
    deviceAspect: state.deviceAspect,
    playbackRate: state.playbackRate,
    currentTime: state.currentTime,
    isPlaying: state.isPlaying,
    _history: state._history,
    _future: state._future,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
  }),
}))
