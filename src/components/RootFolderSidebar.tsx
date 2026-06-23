import {
  ChevronDown,
  ChevronRight,
  Files,
  Folder,
  FolderPlus,
  GripVertical,
  MoreHorizontal,
  Upload,
} from 'lucide-react'
import { useMemo, useState, type DragEvent, type MouseEvent } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useFileTreeStore } from '../stores/fileTreeStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import type { RootFolder } from '../types/rootFolder'
import { flattenFiles } from '../utils/flattenFiles'
import { compactPath } from '../utils/formatDisplayTime'
import { ContextMenu } from './ContextMenu'
import { FolderTree } from './FolderTree'
import { ImportFileDialog } from './ImportFileDialog'
import { NewFolderDialog } from './NewFolderDialog'
import { RecentlyDeletedEntry } from './RecentlyDeletedEntry'
import { showToast } from './Toast'

export function RootFolderSidebar() {
  const {
    folders,
    activeFolderId,
    addMockFolder,
    importMockFile,
    removeFolder,
    renameFolder,
    selectFolder,
    reorderFolders,
  } = useRootFolderStore()
  const expandedRootIds = useFileTreeStore((state) => state.expandedRootIds)
  const toggleRootExpanded = useFileTreeStore((state) => state.toggleRootExpanded)
  const openFile = useEditorStore((state) => state.openFile)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; folder: RootFolder } | null>(null)
  const ordered = useMemo(() => [...folders].sort((a, b) => a.order - b.order), [folders])
  const importTarget = ordered.find((folder) => folder.id === activeFolderId) ?? ordered[0]

  const dropOn = (event: DragEvent, targetId: string) => {
    event.preventDefault()
    if (draggedId) reorderFolders(draggedId, targetId)
    setDraggedId(null)
  }

  const openFolderMenu = (event: MouseEvent, folder: RootFolder) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, folder })
  }

  return (
    <div className="sidebar-shell">
      <header className="sidebar-header">
        <div>
          <span className="eyebrow">JSONDOWN</span>
          <h1>资料夹</h1>
        </div>
        <div className="sidebar-actions">
          <button className="icon-button" onClick={() => setNewFolderOpen(true)} title="新建资料夹">
            <FolderPlus size={17} />
          </button>
          <button className="icon-button" onClick={() => setImportOpen(true)} title="导入文件">
            <Upload size={16} />
          </button>
        </div>
      </header>

      <div className="sidebar-scroll">
        <button
          className={`system-folder-row all-files-row ${activeFolderId === 'all' ? 'is-active' : ''}`}
          onClick={() => selectFolder('all')}
        >
          <Files size={16} />
          <span>全部文件</span>
          <small>{ordered.reduce((sum, folder) => sum + flattenFiles(folder.tree ?? [], folder.path).length, 0)}</small>
        </button>

        <div className="root-folder-list">
          {ordered.map((folder) => {
            const expanded = expandedRootIds.has(folder.id)
            return (
              <section
                key={folder.id}
                className={`root-folder-group ${folder.id === activeFolderId ? 'is-active' : ''}`}
                draggable
                onDragStart={() => setDraggedId(folder.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropOn(event, folder.id)}
              >
                <div className="root-folder-row">
                  <GripVertical className="drag-handle" size={13} />
                  <button
                    className="root-expand"
                    onClick={() => toggleRootExpanded(folder.id)}
                    aria-label={`${expanded ? '收起' : '展开'} ${folder.name}`}
                  >
                    {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                  <button
                    className="root-folder-select"
                    onClick={() => {
                      selectFolder(folder.id)
                      if (!expanded) toggleRootExpanded(folder.id)
                    }}
                  >
                    <Folder size={15} fill="currentColor" />
                    <span className="root-folder-copy">
                      <strong>{folder.name}</strong>
                      <small title={folder.path}>{compactPath(folder.path)}</small>
                    </span>
                    <em>{flattenFiles(folder.tree ?? [], folder.path).length}</em>
                  </button>
                  <button className="row-action" title="资料夹菜单" onClick={(event) => openFolderMenu(event, folder)}>
                    <MoreHorizontal size={14} />
                  </button>
                </div>
                {expanded && <FolderTree nodes={folder.tree ?? []} rootFolderId={folder.id} />}
              </section>
            )
          })}
        </div>
        <RecentlyDeletedEntry />
      </div>

      <NewFolderDialog
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        onCreate={(name) => {
          addMockFolder(name)
          showToast(`已在桌面模拟创建“${name}”`)
        }}
      />
      <ImportFileDialog
        open={importOpen}
        folderName={importTarget?.name}
        onClose={() => setImportOpen(false)}
        onImport={() => {
          if (!importTarget) return
          const id = importMockFile(importTarget.id)
          if (id) openFile(id)
          showToast('已模拟导入文件')
        }}
      />
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onOpenInFinder={() => {
            showToast(`阶段 A Mock：在访达中打开 ${menu.folder.path}`)
            setMenu(null)
          }}
          onRename={() => {
            const name = window.prompt('重命名入口', menu.folder.name)
            if (name) renameFolder(menu.folder.id, name)
            setMenu(null)
          }}
          onDelete={() => {
            removeFolder(menu.folder.id)
            showToast('已移除文件夹入口，真实文件未受影响')
            setMenu(null)
          }}
        />
      )}
    </div>
  )
}
