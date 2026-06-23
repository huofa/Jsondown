import { create } from 'zustand'
import type { SortMode } from '../types/file'

type FileListState = {
  query: string
  sortMode: SortMode
  setQuery: (query: string) => void
  setSortMode: (sortMode: SortMode) => void
}

export const useFileListStore = create<FileListState>((set) => ({
  query: '',
  sortMode: 'updatedAt',
  setQuery: (query) => set({ query }),
  setSortMode: (sortMode) => set({ sortMode }),
}))
