import { RotateCcw, Trash2 } from 'lucide-react'
import { useEditorStore } from '../stores/editorStore'
import { useRecentlyDeletedStore } from '../stores/recentlyDeletedStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import { extractMarkdownSummary } from '../utils/extractMarkdownSummary'
import { showToast } from './Toast'

export function RecentlyDeletedPane() {
  const files = useRecentlyDeletedStore((state) => state.recentlyDeletedFiles)
  const restoreDeletedFile = useRecentlyDeletedStore((state) => state.restoreDeletedFile)
  const permanentlyDeleteFile = useRecentlyDeletedStore((state) => state.permanentlyDeleteFile)
  const restoreFile = useRootFolderStore((state) => state.restoreFile)
  const addContent = useEditorStore((state) => state.addContent)

  return (
    <div className="deleted-list">
      {files.map((file) => (
        <article key={file.id} className="deleted-card">
          <strong>{file.name}</strong>
          <p>{file.kind === 'directory' ? `文件夹 · 原位置 ${file.originalPath}` : extractMarkdownSummary(file.content)}</p>
          <time>{new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(file.deletedAt))}</time>
          <div>
            <button
              onClick={() => {
                const restored = restoreDeletedFile(file.id)
                if (!restored) return
                restoreFile(restored.originalRootFolderId, restored.originalParentId, restored.node)
                addContent(restored.id, restored.content)
                showToast('已恢复到原资料夹（Mock）')
              }}
            >
              <RotateCcw size={12} />恢复
            </button>
            <button
              className="danger"
              onClick={() => {
                permanentlyDeleteFile(file.id)
                showToast('已永久删除 Mock 项目')
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
