import { Trash2 } from 'lucide-react'
import { useEditorStore } from '../stores/editorStore'
import { useRecentlyDeletedStore } from '../stores/recentlyDeletedStore'
import { useRootFolderStore } from '../stores/rootFolderStore'

export function RecentlyDeletedEntry() {
  const selected = useRootFolderStore((state) => state.activeFolderId) === 'recently-deleted'
  const selectFolder = useRootFolderStore((state) => state.selectFolder)
  const folders = useRootFolderStore((state) => state.folders)
  const runAfterPendingCleanup = useEditorStore((state) => state.runAfterPendingCleanup)
  const count = useRecentlyDeletedStore((state) => state.recentlyDeletedFiles.length)
  const loadRecentlyDeleted = useRecentlyDeletedStore((state) => state.loadRecentlyDeleted)
  return (
    <button
      className={`system-folder-row recently-deleted-entry ${selected ? 'is-active' : ''}`}
      onClick={() => {
        void runAfterPendingCleanup(async () => {
          await loadRecentlyDeleted(folders.map((folder) => folder.path))
          selectFolder('recently-deleted')
        })
      }}
    >
      <span className="recently-deleted-drag-spacer" />
      <span className="system-folder-expand-spacer" />
      <span className="system-folder-copy recently-deleted-copy">
        <Trash2 size={15} />
        <strong>最近删除</strong>
      </span>
      <span className="row-action-spacer" />
      <em className="sidebar-count">{count}</em>
    </button>
  )
}
