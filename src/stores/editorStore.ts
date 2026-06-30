import { create } from 'zustand'
import type { SaveStatus } from '../types/editor'
import {
  deleteEmptyFileIfExists,
  isTauriRuntime,
  readTextFile,
  writeTextFile,
} from '../services/tauriFileService'
import { useFilePreviewStore } from './filePreviewStore'
import { useFullFileCacheStore } from './fullFileCacheStore'
import { useOpenedFileCacheStore } from './openedFileCacheStore'
import type { EditableFile } from '../types/file'
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
  requestOpenFile: (nextId: string, files: EditableFile[]) => Promise<boolean>
  closeFile: () => void
  markPendingEmptyFile: (file: PendingEmptyFile) => void
  clearPendingEmptyFile: () => void
  discardPendingEmptyFile: () => Promise<boolean>
  runAfterPendingCleanup: (nextAction: () => void | Promise<void>) => Promise<void>
  loadFileContent: (id: string, path: string, kind?: string) => Promise<void>
  reloadFileContent: (id: string, path: string, kind?: string) => Promise<void>
  saveFileContent: (id: string, path: string) => Promise<boolean>
  updateContent: (id: string, content: string) => void
  addContent: (id: string, content: string) => void
  hydrateContentAsSaved: (id: string, path: string, content: string) => void
  replaceContentAsSaved: (id: string, path: string, content: string, savedAt?: string) => void
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
  openFile: (id) => {
    const content = get().contents[id]
    const savedContent = get().savedContents[id]
    set({
      activeFileId: id,
      saveStatus: content !== undefined && savedContent !== undefined && content !== savedContent ? 'dirty' : 'idle',
      savedAt: null,
    })
  },
  requestOpenFile: async (nextId, files) => {
    const state = get()
    const currentId = state.activeFileId
    if (import.meta.env.DEV) console.debug('[open:request]', { currentId, nextId, saveStatus: state.saveStatus })

    if (currentId && currentId !== nextId) {
      const currentFile = files.find((file) => file.id === currentId || file.path === currentId)
      const currentContent = state.contents[currentId] ?? ''
      const savedContent = state.savedContents[currentId] ?? ''
      if (currentFile?.editable && currentContent !== savedContent) {
        if (import.meta.env.DEV) {
          console.debug('[open:flush-before-switch]', {
            currentId,
            path: currentFile.path,
            bytes: new Blob([currentContent]).size,
            preview: currentContent.slice(0, 80),
          })
        }
        const ok = await get().saveFileContent(currentId, currentFile.path)
        if (!ok) return false
      }
    }

    if (import.meta.env.DEV) console.debug('[open:commit]', { nextId })
    get().openFile(nextId)
    return true
  },
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
      const cachedEntry = Object.values(useFullFileCacheStore.getState().entries)
        .find((entry) => entry.path === path && entry.content !== undefined && !entry.error)
      const content = cachedEntry?.content ?? await readTextFile(path, id)
      if (!cachedEntry) {
        useFullFileCacheStore.getState().upsertContent({ path }, content)
      }
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
  reloadFileContent: async (id, path, kind) => {
    useFullFileCacheStore.getState().invalidatePath(path)
    set((state) => {
      const contents = { ...state.contents }
      const loadedPaths = { ...state.loadedPaths }
      delete contents[id]
      delete loadedPaths[id]
      return {
        contents,
        loadedPaths,
        saveStatus: state.activeFileId === id ? 'idle' : state.saveStatus,
      }
    })
    await get().loadFileContent(id, path, kind)
  },
  saveFileContent: async (id, path) => {
    const content = get().contents[id] ?? ''
    if (content === get().savedContents[id]) {
      set({ saveStatus: 'saved', savedAt: new Date().toISOString() })
      return true
    }
    try {
      set({ saveStatus: 'saving' })
      if (import.meta.env.DEV) {
        console.debug('[save:start]', {
          id,
          path,
          bytes: new Blob([content]).size,
          preview: content.slice(0, 80),
        })
      }
      const result = await writeTextFile(path, content)
      set((state) => ({
        saveStatus: result.ok ? 'saved' : 'error',
        savedAt: result.savedAt,
        savedContents: result.ok ? { ...state.savedContents, [id]: content } : state.savedContents,
      }))
      if (result.ok) {
        useFullFileCacheStore.getState().upsertContent({ path, updatedAt: result.updatedAt ?? result.savedAt, size: content.length }, content)
        useOpenedFileCacheStore.getState().invalidatePath(path)
        useFilePreviewStore.getState().removePreview(path)
        window.dispatchEvent(new CustomEvent('jsondown:file-saved', {
          detail: { path, updatedAt: result.updatedAt ?? result.savedAt, size: content.length },
        }))
        if (import.meta.env.DEV) console.debug('[save:success]', { id, path, updatedAt: result.updatedAt })
      }
      return result.ok
    } catch {
      set({ saveStatus: 'error' })
      return false
    }
  },
  updateContent: (id, content) =>
    set((state) => {
      if (state.contents[id] === content) return state
      const pendingIsNowFormal = state.pendingEmptyFile?.id === id && Boolean(content.trim())
      const pendingStillEmpty = state.pendingEmptyFile?.id === id && !content.trim()
      if (pendingIsNowFormal && import.meta.env.DEV) {
        console.debug('[new-file:formalized-keep-editing]', { id, path: state.pendingEmptyFile?.path })
      }
      return {
        contents: { ...state.contents, [id]: content },
        pendingEmptyFile: pendingIsNowFormal ? null : state.pendingEmptyFile,
        saveStatus: pendingStillEmpty ? state.saveStatus : 'dirty',
      }
    }),
  addContent: (id, content) =>
    set((state) => ({ contents: { ...state.contents, [id]: content } })),
  hydrateContentAsSaved: (id, path, content) =>
    set((state) => ({
      contents: { ...state.contents, [id]: content },
      savedContents: { ...state.savedContents, [id]: content },
      loadedPaths: { ...state.loadedPaths, [id]: path },
      saveStatus: state.activeFileId === id && state.saveStatus !== 'dirty' ? 'idle' : state.saveStatus,
    })),
  replaceContentAsSaved: (id, path, content, savedAt = new Date().toISOString()) => {
    set((state) => ({
      contents: { ...state.contents, [id]: content },
      savedContents: { ...state.savedContents, [id]: content },
      loadedPaths: { ...state.loadedPaths, [id]: path },
      saveStatus: state.activeFileId === id ? 'saved' : state.saveStatus,
      savedAt: state.activeFileId === id ? savedAt : state.savedAt,
    }))
    useOpenedFileCacheStore.getState().invalidatePath(path)
    useFullFileCacheStore.getState().upsertContent({ path, updatedAt: savedAt, size: content.length }, content)
    useFilePreviewStore.getState().removePreview(path)
    window.dispatchEvent(new CustomEvent('jsondown:file-saved', {
      detail: { path, updatedAt: savedAt, size: content.length },
    }))
  },
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
