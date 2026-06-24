import { create } from 'zustand'
import type { SaveStatus } from '../types/editor'
import { isTauriRuntime, readTextFile, writeTextFile } from '../services/tauriFileService'
import { mockFileContents } from '../utils/mockFileSystem'

type EditorState = {
  activeFileId: string | null
  contents: Record<string, string>
  loadedPaths: Record<string, string>
  savedContents: Record<string, string>
  saveStatus: SaveStatus
  savedAt: string | null
  openFile: (id: string) => void
  closeFile: () => void
  loadFileContent: (id: string, path: string, kind?: string) => Promise<void>
  saveFileContent: (id: string, path: string) => Promise<void>
  updateContent: (id: string, content: string) => void
  addContent: (id: string, content: string) => void
  removeContent: (id: string) => void
  setSaveStatus: (status: SaveStatus) => void
  markSaved: (savedAt?: string) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activeFileId: null,
  contents: { ...mockFileContents },
  loadedPaths: {},
  savedContents: { ...mockFileContents },
  saveStatus: 'idle',
  savedAt: null,
  openFile: (id) => set({ activeFileId: id, saveStatus: 'idle', savedAt: null }),
  closeFile: () => set({ activeFileId: null, saveStatus: 'idle', savedAt: null }),
  loadFileContent: async (id, path, kind) => {
    if (kind === 'image') {
      set((state) => ({
        contents: { ...state.contents, [id]: path },
        loadedPaths: { ...state.loadedPaths, [id]: path },
      }))
      return
    }
    if (get().loadedPaths[id] === path && get().contents[id] !== undefined) return
    try {
      const content = await readTextFile(path, id)
      set((state) => ({
        contents: { ...state.contents, [id]: content },
        savedContents: { ...state.savedContents, [id]: content },
        loadedPaths: { ...state.loadedPaths, [id]: path },
        saveStatus: state.activeFileId === id ? 'idle' : state.saveStatus,
      }))
    } catch {
      set({ saveStatus: 'error' })
    }
  },
  saveFileContent: async (id, path) => {
    const content = get().contents[id] ?? ''
    if (content === get().savedContents[id]) {
      set({ saveStatus: 'saved', savedAt: new Date().toISOString() })
      return
    }
    try {
      set({ saveStatus: 'saving' })
      const result = await writeTextFile(path, content)
      set((state) => ({
        saveStatus: result.ok ? 'saved' : 'error',
        savedAt: result.savedAt,
        savedContents: result.ok ? { ...state.savedContents, [id]: content } : state.savedContents,
      }))
    } catch {
      set({ saveStatus: 'error' })
    }
  },
  updateContent: (id, content) =>
    set((state) => {
      if (state.contents[id] === content) return state
      return {
        contents: { ...state.contents, [id]: content },
        saveStatus: 'dirty',
      }
    }),
  addContent: (id, content) =>
    set((state) => ({ contents: { ...state.contents, [id]: content } })),
  removeContent: (id) =>
    set((state) => {
      const contents = { ...state.contents }
      const savedContents = { ...state.savedContents }
      delete contents[id]
      delete savedContents[id]
      return {
        contents,
        savedContents,
        activeFileId: state.activeFileId === id ? null : state.activeFileId,
        saveStatus: state.activeFileId === id ? 'idle' : state.saveStatus,
      }
    }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  markSaved: (savedAt = new Date().toISOString()) =>
    set({ saveStatus: 'saved', savedAt }),
}))

void isTauriRuntime
