import { create } from 'zustand'
import type { SaveStatus } from '../types/editor'
import { mockFileContents } from '../utils/mockFileSystem'

type EditorState = {
  activeFileId: string | null
  contents: Record<string, string>
  saveStatus: SaveStatus
  savedAt: string | null
  openFile: (id: string) => void
  closeFile: () => void
  updateContent: (id: string, content: string) => void
  addContent: (id: string, content: string) => void
  removeContent: (id: string) => void
  setSaveStatus: (status: SaveStatus) => void
  markSaved: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  activeFileId: null,
  contents: { ...mockFileContents },
  saveStatus: 'idle',
  savedAt: null,
  openFile: (id) => set({ activeFileId: id, saveStatus: 'idle', savedAt: null }),
  closeFile: () => set({ activeFileId: null, saveStatus: 'idle', savedAt: null }),
  updateContent: (id, content) =>
    set((state) => ({
      contents: { ...state.contents, [id]: content },
      saveStatus: 'dirty',
    })),
  addContent: (id, content) =>
    set((state) => ({ contents: { ...state.contents, [id]: content } })),
  removeContent: (id) =>
    set((state) => {
      const contents = { ...state.contents }
      delete contents[id]
      return {
        contents,
        activeFileId: state.activeFileId === id ? null : state.activeFileId,
        saveStatus: state.activeFileId === id ? 'idle' : state.saveStatus,
      }
    }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  markSaved: () => set({ saveStatus: 'saved', savedAt: new Date().toISOString() }),
}))
