import { Trash2 } from 'lucide-react'
import { useRecentlyDeletedStore } from '../stores/recentlyDeletedStore'
import { useRootFolderStore } from '../stores/rootFolderStore'

export function RecentlyDeletedEntry() {
  const selected = useRootFolderStore((state) => state.activeFolderId) === 'recently-deleted'
  const selectFolder = useRootFolderStore((state) => state.selectFolder)
  const count = useRecentlyDeletedStore((state) => state.recentlyDeletedFiles.length)
  return (
    <button
      className={`system-folder-row recently-deleted-entry ${selected ? 'is-active' : ''}`}
      onClick={() => selectFolder('recently-deleted')}
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
