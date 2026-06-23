import {
  ChevronDown,
  ChevronRight,
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
import { createRootFolder, isTauriRuntime, revealInFinder } from '../services/tauriFileService'
import type { RootFolder } from '../types/rootFolder'
import { flattenFiles } from '../utils/flattenFiles'
import { compactPath } from '../utils/formatDisplayTime'
import { countViewableFiles } from '../utils/folderSelection'
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
    addRootFolder,
    addRootFolderFromDialog,
    addMockFolder,
    createMockFile,
    createMockSubfolder,
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
  const [allMenu, setAllMenu] = useState<{ x: number; y: number } | null>(null)
  const ordered = useMemo(() => [...folders].sort((a, b) => a.order - b.order), [folders])
  const importTarget = ordered.find((folder) => folder.id === activeFolderId) ?? ordered[0]
  const allFilesCount = ordered.reduce((sum, folder) => sum + flattenFiles(folder.tree ?? [], folder.path).length, 0)

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
          <button className="icon-button" onClick={() => { void addRootFolderFromDialog() }} title="导入文件夹">
            <Upload size={16} />
          </button>
        </div>
      </header>

      <div className="sidebar-scroll">
        <div
          className={`system-folder-row all-files-row ${activeFolderId === 'all' ? 'is-active' : ''}`}
        >
          <button className="system-folder-main" onClick={() => selectFolder('all')}>
            <span className="system-folder-chevron" />
            <Folder size={15} fill="currentColor" />
            <span className="system-folder-copy"><strong>全部文件</strong></span>
          </button>
          <button
            className="row-action"
            title="全部文件菜单"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setAllMenu({ x: event.clientX, y: event.clientY })
            }}
          >
            <MoreHorizontal size={14} />
          </button>
          <em className="sidebar-count">{allFilesCount}</em>
        </div>

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
                  </button>
                  <button className="row-action" title="资料夹菜单" onClick={(event) => openFolderMenu(event, folder)}>
                    <MoreHorizontal size={14} />
                  </button>
                  <em className="sidebar-count">{countViewableFiles(folder.tree ?? [])}</em>
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
          void (async () => {
            if (isTauriRuntime()) {
              const parentPath = window.prompt('请输入父文件夹路径（Tauri 后续可替换为选择位置对话框）')
              if (!parentPath) return
              const folder = await createRootFolder(parentPath, name)
              await addRootFolder(folder)
              showToast(`已创建并加入“${name}”`)
              return
            }
            addMockFolder(name)
            showToast(`已在桌面模拟创建“${name}”`)
          })()
        }}
      />
      <ImportFileDialog
        open={importOpen}
        folderName={importTarget?.name}
        onClose={() => setImportOpen(false)}
        onImport={() => {
          void (async () => {
            if (isTauriRuntime()) {
              await addRootFolderFromDialog()
              setImportOpen(false)
              return
            }
            if (!importTarget) return
            const id = importMockFile(importTarget.id)
            if (id) openFile(id)
            showToast('已模拟导入文件')
          })()
        }}
      />
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onOpenInFinder={() => {
            void revealInFinder(menu.folder.path)
              .then(() => showToast('已在访达中打开'))
              .catch(() => showToast(`阶段 A Mock：在访达中打开 ${menu.folder.path}`))
              .finally(() => setMenu(null))
          }}
          onRename={() => {
            const name = window.prompt('重命名入口', menu.folder.name)
            if (name) renameFolder(menu.folder.id, name)
            setMenu(null)
          }}
          renameLabel="重命名入口名"
          onNewFolder={() => {
            const name = window.prompt('新建文件夹名称', '新建文件夹')
            void createMockSubfolder(menu.folder.id, name ?? undefined)
              .then((id) => { if (id) showToast(`已在“${menu.folder.name}”下新建文件夹`) })
            setMenu(null)
          }}
          onNewFile={() => {
            const name = window.prompt('新建文件名称（不写后缀默认 .md）', '新建笔记.md')
            void createMockFile(menu.folder.id, name ?? undefined).then((id) => {
              if (id) {
                openFile(id)
                showToast(`已在“${menu.folder.name}”下新建文件`)
              }
            })
            setMenu(null)
          }}
          onDelete={() => {
            removeFolder(menu.folder.id)
            showToast('已移除文件夹入口，真实文件未受影响')
            setMenu(null)
          }}
          deleteLabel="移除入口"
        />
      )}
      {allMenu && (
        <ContextMenu
          x={allMenu.x}
          y={allMenu.y}
          onClose={() => setAllMenu(null)}
          onNewFolder={() => {
            setNewFolderOpen(true)
            setAllMenu(null)
          }}
          onImportFolder={() => {
            void addRootFolderFromDialog()
            setAllMenu(null)
          }}
          onRefresh={() => {
            void useRootFolderStore.getState().refreshAllRootFolders()
            showToast('已重新扫描全部文件')
            setAllMenu(null)
          }}
        />
      )}
    </div>
  )
}
