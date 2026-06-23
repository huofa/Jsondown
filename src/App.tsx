import { useEffect } from 'react'
import { EditorPane } from './components/EditorPane'
import { FlatFileListPane } from './components/FlatFileListPane'
import { ResizablePanels } from './components/ResizablePanels'
import { RootFolderSidebar } from './components/RootFolderSidebar'
import { useEditorStore } from './stores/editorStore'
import { useRootFolderStore } from './stores/rootFolderStore'
import { useSettingsStore } from './stores/settingsStore'
import { flattenFiles } from './utils/flattenFiles'
import { getDirectFilesForSelection } from './utils/folderSelection'

export default function App() {
  const folders = useRootFolderStore((state) => state.folders)
  const activeFolderId = useRootFolderStore((state) => state.activeFolderId)
  const activeFileId = useEditorStore((state) => state.activeFileId)
  const openFile = useEditorStore((state) => state.openFile)
  const closeFile = useEditorStore((state) => state.closeFile)
  const layoutDensity = useSettingsStore((state) => state.layoutDensity)

  useEffect(() => {
    if (activeFolderId === 'recently-deleted') {
      closeFile()
      return
    }
    const files = activeFolderId === 'all'
      ? folders.flatMap((folder) => flattenFiles(folder.tree ?? [], folder.path, folder.id))
      : getDirectFilesForSelection(folders, activeFolderId)
    if (!files.some((file) => file.id === activeFileId)) {
      const firstMarkdown = files.find((file) => file.editable) ?? files[0]
      if (firstMarkdown) openFile(firstMarkdown.id)
      else closeFile()
    }
  }, [activeFileId, activeFolderId, closeFile, folders, openFile])

  return (
    <div className={`app-frame density-${layoutDensity}`}>
      <div className="window-drag-strip" aria-hidden="true">
        <span /><span /><span />
      </div>
      <ResizablePanels
        left={<RootFolderSidebar />}
        middle={<FlatFileListPane />}
        right={<EditorPane />}
      />
    </div>
  )
}
