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
      <Trash2 size={15} />
      <span>最近删除</span>
      <small>{count}</small>
    </button>
  )
}
