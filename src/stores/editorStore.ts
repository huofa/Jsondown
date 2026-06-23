import { create } from 'zustand'
import type { SaveStatus } from '../types/editor'
import { mockFileContents } from '../utils/mockFileSystem'

type EditorState = {
  activeFileId: string | null
  contents: Record<string, string>
  saveStatus: SaveStatus
  savedAt: string | null
  openFile: (id: string) => void
  updateContent: (id: string, content: string) => void
  setSaveStatus: (status: SaveStatus) => void
  markSaved: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  activeFileId: null,
  contents: { ...mockFileContents },
  saveStatus: 'idle',
  savedAt: null,
  openFile: (id) => set({ activeFileId: id, saveStatus: 'idle', savedAt: null }),
  updateContent: (id, content) =>
    set((state) => ({
      contents: { ...state.contents, [id]: content },
      saveStatus: 'dirty',
    })),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  markSaved: () => set({ saveStatus: 'saved', savedAt: new Date().toISOString() }),
}))
