import { RotateCcw, Trash2 } from 'lucide-react'
import { useEditorStore } from '../stores/editorStore'
import { useRecentlyDeletedStore } from '../stores/recentlyDeletedStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import { isTauriRuntime } from '../services/tauriFileService'
import { extractMarkdownSummary } from '../utils/extractMarkdownSummary'
import { showToast } from './Toast'

export function RecentlyDeletedPane() {
  const files = useRecentlyDeletedStore((state) => state.recentlyDeletedFiles)
  const restoreDeletedFile = useRecentlyDeletedStore((state) => state.restoreDeletedFile)
  const permanentlyDeleteFile = useRecentlyDeletedStore((state) => state.permanentlyDeleteFile)
  const restoreFile = useRootFolderStore((state) => state.restoreFile)
  const folders = useRootFolderStore((state) => state.folders)
  const refreshRootFolder = useRootFolderStore((state) => state.refreshRootFolder)
  const addContent = useEditorStore((state) => state.addContent)

  const rootFor = (originalPath: string) =>
    folders.find((folder) => originalPath.startsWith(folder.path))

  return (
    <div className="deleted-list">
      {files.map((file) => (
        <article key={file.id} className="deleted-card">
          <strong>{file.name}</strong>
          <p>{file.kind === 'directory' ? `文件夹 · 原位置 ${file.originalPath}` : extractMarkdownSummary(file.content ?? '')}</p>
          <time>{new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(file.deletedAt))}</time>
          <div>
            <button
              onClick={() => {
                void (async () => {
                  const root = rootFor(file.originalPath)
                  const restored = await restoreDeletedFile(file.id, root?.path)
                  if (!restored) return
                  if (isTauriRuntime()) {
                    if (root) await refreshRootFolder(root.id)
                    showToast('已恢复到原资料夹')
                    return
                  }
                  if (restored.originalRootFolderId && restored.node) {
                    restoreFile(restored.originalRootFolderId, restored.originalParentId, restored.node)
                    addContent(restored.id, restored.content ?? '')
                  }
                  showToast('已恢复到原资料夹（Mock）')
                })()
              }}
            >
              <RotateCcw size={12} />恢复
            </button>
            <button
              className="danger"
              onClick={() => {
                if (!window.confirm(`永久删除“${file.name}”？此操作不可撤销。`)) return
                void permanentlyDeleteFile(file.id, rootFor(file.originalPath)?.path)
                  .then(() => showToast('已永久删除项目'))
              }}
            >
              <Trash2 size={12} />永久删除
            </button>
          </div>
        </article>
      ))}
      {files.length === 0 && <div className="list-empty">最近删除为空</div>}
    </div>
  )
}
