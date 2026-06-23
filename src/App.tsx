import { useEffect } from 'react'
import { EditorPane } from './components/EditorPane'
import { FlatFileListPane } from './components/FlatFileListPane'
import { ResizablePanels } from './components/ResizablePanels'
import { RootFolderSidebar } from './components/RootFolderSidebar'
import { ToastHost } from './components/Toast'
import { useEditorStore } from './stores/editorStore'
import { useRootFolderStore } from './stores/rootFolderStore'
import { flattenFiles } from './utils/flattenFiles'

export default function App() {
  const folders = useRootFolderStore((state) => state.folders)
  const activeFolderId = useRootFolderStore((state) => state.activeFolderId)
  const activeFileId = useEditorStore((state) => state.activeFileId)
  const openFile = useEditorStore((state) => state.openFile)

  useEffect(() => {
    const folder = folders.find((item) => item.id === activeFolderId)
    const files = folder ? flattenFiles(folder.tree ?? [], folder.path) : []
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
      <ToastHost />
    </div>
  )
}
