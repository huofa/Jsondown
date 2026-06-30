import type { RootFolder } from './rootFolder'
import type { EditorTheme } from './editor'
import type { CustomEditorLayout, LayoutDensity } from './settings'

export type LastWorkspaceState = {
  rootFolderPath?: string
  selectedFolderPath?: string
  selectedFilePath?: string
  activeSystemFolder?: 'all-files' | 'recently-deleted' | null
  leftSidebarScrollTop?: number
  middleFileListScrollTop?: number
  rightEditorScrollTop?: number
  rightEditorScrollHeight?: number
  rightEditorClientHeight?: number
  sidebarCollapsed?: boolean
  leftPanelWidth?: number
  middlePanelWidth?: number
  sortMode?: string
  editorMode?: 'readonly' | 'editing'
  updatedAt: string
}

export type AppConfig = {
  rootFolders: RootFolder[]
  selectedRootFolderId?: string
  selectedFolderPath?: string
  selectedFilePath?: string
  pinnedFilePaths?: string[]
  layoutDensity?: LayoutDensity
  customEditorLayout?: CustomEditorLayout
  editorTheme?: EditorTheme
  sidebarCollapsed?: boolean
  lastWorkspaceState?: LastWorkspaceState
}
