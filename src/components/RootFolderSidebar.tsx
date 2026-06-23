import { ExternalLink, Folder, FolderPlus, GripVertical, MoreHorizontal, Trash2 } from 'lucide-react'
import { useMemo, useState, type DragEvent } from 'react'
import { useRootFolderStore } from '../stores/rootFolderStore'
import { countFiles } from '../utils/fileTreeUtils'
import { FolderTree } from './FolderTree'
import { showToast } from './Toast'

export function RootFolderSidebar() {
  const { folders, activeFolderId, addMockFolder, removeFolder, selectFolder, reorderFolders } =
    useRootFolderStore()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const ordered = useMemo(() => [...folders].sort((a, b) => a.order - b.order), [folders])
  const activeFolder = ordered.find((folder) => folder.id === activeFolderId)

  const dropOn = (event: DragEvent, targetId: string) => {
    event.preventDefault()
    if (draggedId) reorderFolders(draggedId, targetId)
    setDraggedId(null)
  }

  return (
    <div className="sidebar-shell">
      <header className="sidebar-header">
        <div>
          <span className="eyebrow">JSONDOWN</span>
          <h1>资料夹</h1>
        </div>
        <button className="icon-button" onClick={addMockFolder} title="添加本地主文件夹（Mock）">
          <FolderPlus size={18} />
        </button>
      </header>

      <div className="root-folder-list">
        {ordered.map((folder) => (
          <div
            key={folder.id}
            className={`root-folder-row ${folder.id === activeFolderId ? 'is-active' : ''}`}
            draggable
            onDragStart={() => setDraggedId(folder.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => dropOn(event, folder.id)}
          >
            <GripVertical className="drag-handle" size={14} />
            <button className="root-folder-select" onClick={() => selectFolder(folder.id)}>
              <Folder size={16} fill="currentColor" />
              <span>{folder.name}</span>
              <small>{countFiles(folder.tree ?? [])}</small>
            </button>
            <button
              className="row-action"
              title="删除应用入口"
              onClick={() => {
                removeFolder(folder.id)
                showToast('已移除文件夹入口，真实文件未受影响')
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {activeFolder ? (
        <>
          <div className="folder-context">
            <div className="folder-context-title">
              <span>当前位置</span>
              <button className="tiny-icon-button" title="更多"><MoreHorizontal size={15} /></button>
            </div>
            <p title={activeFolder.path}>{activeFolder.path}</p>
            <button
              className="finder-button"
              onClick={() => showToast(`阶段 A Mock：在访达中打开 ${activeFolder.path}`)}
            >
              <ExternalLink size={13} />
              在访达中打开
            </button>
          </div>
          <div className="tree-section">
            <div className="section-label">文件树</div>
            <FolderTree nodes={activeFolder.tree ?? []} />
          </div>
        </>
      ) : (
        <div className="sidebar-empty">添加一个资料夹开始使用</div>
      )}
    </div>
  )
}
