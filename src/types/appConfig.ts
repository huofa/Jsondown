import type { RootFolder } from './rootFolder'
import type { EditorTheme } from './editor'
import type { LayoutDensity } from './settings'

export type AppConfig = {
  rootFolders: RootFolder[]
  selectedRootFolderId?: string
  selectedFolderPath?: string
  selectedFilePath?: string
  layoutDensity?: LayoutDensity
  editorTheme?: EditorTheme
  sidebarCollapsed?: boolean
}

