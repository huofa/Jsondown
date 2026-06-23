import { useEffect } from 'react'
import { EditorPane } from './components/EditorPane'
import { FlatFileListPane } from './components/FlatFileListPane'
import { ResizablePanels } from './components/ResizablePanels'
import { RootFolderSidebar } from './components/RootFolderSidebar'
import { useEditorStore } from './stores/editorStore'
import { useRootFolderStore } from './stores/rootFolderStore'
import { flattenFiles } from './utils/flattenFiles'

export default function App() {
  const folders = useRootFolderStore((state) => state.folders)
  const activeFolderId = useRootFolderStore((state) => state.activeFolderId)
  const activeFileId = useEditorStore((state) => state.activeFileId)
  const openFile = useEditorStore((state) => state.openFile)

  useEffect(() => {
    const files = activeFolderId === 'all'
      ? folders.flatMap((folder) => flattenFiles(folder.tree ?? [], folder.path, folder.id))
      : (() => {
          const folder = folders.find((item) => item.id === activeFolderId)
          return folder ? flattenFiles(folder.tree ?? [], folder.path, folder.id) : []
        })()
    if (!files.some((file) => file.id === activeFileId)) {
      const firstMarkdown = files.find((file) => file.editable) ?? files[0]
      if (firstMarkdown) openFile(firstMarkdown.id)
    }
  }, [activeFileId, activeFolderId, folders, openFile])

  return (
    <div className="app-frame">
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
