import { useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { useEditorStore } from '../stores/editorStore'
import { useRecentlyDeletedStore } from '../stores/recentlyDeletedStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import { isTauriRuntime } from '../services/tauriFileService'
import { extractMarkdownSummary } from '../utils/extractMarkdownSummary'
import { showToast } from './Toast'

export function RecentlyDeletedPane() {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const files = useRecentlyDeletedStore((state) => state.recentlyDeletedFiles)
  const restoreDeletedFile = useRecentlyDeletedStore((state) => state.restoreDeletedFile)
  const permanentlyDeleteFile = useRecentlyDeletedStore((state) => state.permanentlyDeleteFile)
  const restoreFile = useRootFolderStore((state) => state.restoreFile)
  const folders = useRootFolderStore((state) => state.folders)
  const refreshRootFolder = useRootFolderStore((state) => state.refreshRootFolder)
  const addContent = useEditorStore((state) => state.addContent)

  const rootFor = (originalPath: string) =>
    folders.find((folder) => originalPath.startsWith(folder.path))

  const rootForDeleted = (file: { originalPath: string; originalRootFolderId?: string; trashPath?: string }) =>
    folders.find((folder) => folder.id === file.originalRootFolderId)
    ?? rootFor(file.originalPath)
    ?? folders.find((folder) => Boolean(file.trashPath?.startsWith(`${folder.path}/.jsondown-trash/`)))

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
                  const root = rootForDeleted(file)
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
              disabled={deletingId === file.id}
              onClick={() => {
                const root = rootForDeleted(file)
                const rootPaths = folders.map((folder) => folder.path)
                setDeletingId(file.id)
                void permanentlyDeleteFile(file.id, root?.path, rootPaths)
                  .then(async () => {
                    if (isTauriRuntime()) await useRecentlyDeletedStore.getState().loadRecentlyDeleted(rootPaths)
                    showToast('已移到系统废纸篓')
                  })
                  .catch((error) => {
                    if (import.meta.env.DEV) console.warn('[recently-deleted:permanent-delete-failed]', error)
                    showToast('永久删除失败')
                  })
                  .finally(() => setDeletingId((current) => (current === file.id ? null : current)))
              }}
            >
              <Trash2 size={12} />{deletingId === file.id ? '删除中' : '永久删除'}
            </button>
          </div>
        </article>
      ))}
      {files.length === 0 && <div className="list-empty">最近删除为空</div>}
    </div>
  )
}
