import { create } from 'zustand'
import type { SaveStatus } from '../types/editor'
import {
  deleteEmptyFileIfExists,
  isTauriRuntime,
  readTextFile,
  writeTextFile,
} from '../services/tauriFileService'
import { mockFileContents } from '../utils/mockFileSystem'

export type PendingEmptyFile = {
  id: string
  path: string
  rootFolderId?: string
}

type EditorState = {
  activeFileId: string | null
  contents: Record<string, string>
  loadedPaths: Record<string, string>
  savedContents: Record<string, string>
  pendingEmptyFile: PendingEmptyFile | null
  saveStatus: SaveStatus
  savedAt: string | null
  openFile: (id: string) => void
  closeFile: () => void
  markPendingEmptyFile: (file: PendingEmptyFile) => void
  clearPendingEmptyFile: () => void
  discardPendingEmptyFile: () => Promise<boolean>
  runAfterPendingCleanup: (nextAction: () => void | Promise<void>) => Promise<void>
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
  pendingEmptyFile: null,
  saveStatus: 'idle',
  savedAt: null,
  openFile: (id) => set({ activeFileId: id, saveStatus: 'idle', savedAt: null }),
  closeFile: () => set({ activeFileId: null, saveStatus: 'idle', savedAt: null }),
  markPendingEmptyFile: (file) =>
    set((state) => ({
      pendingEmptyFile: file,
      contents: { ...state.contents, [file.id]: '' },
      savedContents: { ...state.savedContents, [file.id]: '' },
      loadedPaths: { ...state.loadedPaths, [file.id]: file.path },
      saveStatus: state.activeFileId === file.id ? 'idle' : state.saveStatus,
    })),
  clearPendingEmptyFile: () => set({ pendingEmptyFile: null }),
  discardPendingEmptyFile: async () => {
    const pending = get().pendingEmptyFile
    if (!pending) return false

    const content = get().contents[pending.id] ?? ''
    if (content.trim()) {
      set({ pendingEmptyFile: null })
      return false
    }

    set((state) => {
      const contents = { ...state.contents }
      const savedContents = { ...state.savedContents }
      const loadedPaths = { ...state.loadedPaths }
      delete contents[pending.id]
      delete savedContents[pending.id]
      delete loadedPaths[pending.id]
      return {
        contents,
        savedContents,
        loadedPaths,
        pendingEmptyFile: null,
        activeFileId: state.activeFileId === pending.id ? null : state.activeFileId,
        saveStatus: state.activeFileId === pending.id ? 'idle' : state.saveStatus,
      }
    })

    let deleted = true
    try {
      deleted = await deleteEmptyFileIfExists(pending.path)
    } catch {
      deleted = false
    }
    window.dispatchEvent(new CustomEvent('jsondown:pending-empty-file-cleared', {
      detail: { ...pending, deleted },
    }))
    return deleted
  },
  runAfterPendingCleanup: async (nextAction) => {
    try {
      await get().discardPendingEmptyFile()
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[Jsondown] pending empty file cleanup failed', error)
      set({ pendingEmptyFile: null })
    } finally {
      await nextAction()
    }
  },
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
      const pendingIsNowFormal = state.pendingEmptyFile?.id === id && Boolean(content.trim())
      const pendingStillEmpty = state.pendingEmptyFile?.id === id && !content.trim()
      return {
        contents: { ...state.contents, [id]: content },
        pendingEmptyFile: pendingIsNowFormal ? null : state.pendingEmptyFile,
        saveStatus: pendingStillEmpty ? state.saveStatus : 'dirty',
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
