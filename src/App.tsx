import { useEffect, useRef, type CSSProperties } from 'react'
import { EditorPane } from './components/EditorPane'
import { FlatFileListPane } from './components/FlatFileListPane'
import { ResizablePanels } from './components/ResizablePanels'
import { RootFolderSidebar } from './components/RootFolderSidebar'
import { useEditorStore } from './stores/editorStore'
import { useRecentlyDeletedStore } from './stores/recentlyDeletedStore'
import { useRootFolderStore } from './stores/rootFolderStore'
import { useSettingsStore } from './stores/settingsStore'
import { isRecentlySelfSaved, watchPaths } from './services/tauriFileService'
import { flattenFiles } from './utils/flattenFiles'
import { getDirectFilesForSelection } from './utils/folderSelection'

export default function App() {
  const folders = useRootFolderStore((state) => state.folders)
  const activeFolderId = useRootFolderStore((state) => state.activeFolderId)
  const initialize = useRootFolderStore((state) => state.initialize)
  const refreshAllRootFolders = useRootFolderStore((state) => state.refreshAllRootFolders)
  const refreshRootFolder = useRootFolderStore((state) => state.refreshRootFolder)
  const activeFileId = useEditorStore((state) => state.activeFileId)
  const openFile = useEditorStore((state) => state.openFile)
  const closeFile = useEditorStore((state) => state.closeFile)
  const setSaveStatus = useEditorStore((state) => state.setSaveStatus)
  const layoutDensity = useSettingsStore((state) => state.layoutDensity)
  const customEditorLayout = useSettingsStore((state) => state.customEditorLayout)
  const loadRecentlyDeleted = useRecentlyDeletedStore((state) => state.loadRecentlyDeleted)
  const watcherRefreshTimer = useRef<number | undefined>(undefined)
  const foldersRef = useRef(folders)
  const activeFileIdRef = useRef(activeFileId)
  foldersRef.current = folders
  activeFileIdRef.current = activeFileId
  const rootPathsKey = folders.map((folder) => folder.path).join('\n')

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    const refreshAfterPendingDelete = (event: Event) => {
      const detail = (event as CustomEvent<{ rootFolderId?: string }>).detail
      if (detail?.rootFolderId) void refreshRootFolder(detail.rootFolderId)
      else void refreshAllRootFolders()
    }
    window.addEventListener('jsondown:pending-empty-file-cleared', refreshAfterPendingDelete)
    return () => window.removeEventListener('jsondown:pending-empty-file-cleared', refreshAfterPendingDelete)
  }, [refreshAllRootFolders, refreshRootFolder])

  useEffect(() => {
    const rootPaths = rootPathsKey ? rootPathsKey.split('\n') : []
    void loadRecentlyDeleted(rootPaths)
    let cleanup: (() => void) | null = null
    void watchPaths(rootPaths, (event) => {
      const activeFile = foldersRef.current
        .flatMap((folder) => flattenFiles(folder.tree ?? [], folder.path, folder.id))
        .find((file) => file.id === activeFileIdRef.current)
      const selfSaveOnly = event.paths.length > 0 && event.paths.every((path) => isRecentlySelfSaved(path))
      if (activeFile && event.paths.includes(activeFile.path) && !selfSaveOnly) {
        setSaveStatus('external-changed')
      }
      if (selfSaveOnly) return
      window.clearTimeout(watcherRefreshTimer.current)
      watcherRefreshTimer.current = window.setTimeout(() => {
        void refreshAllRootFolders()
        void loadRecentlyDeleted(rootPaths)
      }, 500)
    }).then((unlisten) => { cleanup = unlisten })
    return () => {
      window.clearTimeout(watcherRefreshTimer.current)
      cleanup?.()
    }
  }, [loadRecentlyDeleted, refreshAllRootFolders, rootPathsKey, setSaveStatus])

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
    <div
      className={`app-frame density-${layoutDensity}`}
      style={{
        '--custom-editor-font-size': `${customEditorLayout.fontSize}px`,
        '--custom-editor-line-height': String(customEditorLayout.lineHeight),
        '--custom-editor-paragraph-spacing': `${customEditorLayout.paragraphSpacing}px`,
        '--custom-editor-letter-spacing': `${customEditorLayout.letterSpacing}px`,
        '--custom-editor-horizontal-padding': `${customEditorLayout.horizontalPadding}px`,
      } as CSSProperties}
    >
      <ResizablePanels
        left={<RootFolderSidebar />}
        middle={<FlatFileListPane />}
        right={<EditorPane />}
      />
    </div>
  )
}
