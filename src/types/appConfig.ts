import type { RootFolder } from './rootFolder'
import type { EditorTheme } from './editor'
import type { CustomEditorLayout, LayoutDensity } from './settings'

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
}
