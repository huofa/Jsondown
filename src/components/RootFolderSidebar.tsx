import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Upload,
} from 'lucide-react'
import { useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useFileTreeStore } from '../stores/fileTreeStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import {
  createRootFolder,
  isTauriRuntime,
  revealInFinder,
  selectParentFolder,
} from '../services/tauriFileService'
import type { RootFolder } from '../types/rootFolder'
import { flattenFiles } from '../utils/flattenFiles'
import { compactPath } from '../utils/formatDisplayTime'
import { countViewableFiles } from '../utils/folderSelection'
import { startWindowDrag } from '../utils/windowDrag'
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
    selectFolder,
    reorderFolders,
  } = useRootFolderStore()
  const expandedRootIds = useFileTreeStore((state) => state.expandedRootIds)
  const toggleRootExpanded = useFileTreeStore((state) => state.toggleRootExpanded)
  const requestOpenFile = useEditorStore((state) => state.requestOpenFile)
  const pendingEmptyFile = useEditorStore((state) => state.pendingEmptyFile)
  const contents = useEditorStore((state) => state.contents)
  const runAfterPendingCleanup = useEditorStore((state) => state.runAfterPendingCleanup)
  const draggedIdRef = useRef<string | null>(null)
  const suppressNextRootClickRef = useRef(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; folder: RootFolder } | null>(null)
  const [allMenu, setAllMenu] = useState<{ x: number; y: number } | null>(null)
  const ordered = useMemo(() => [...folders].sort((a, b) => a.order - b.order), [folders])
  const importTarget = ordered.find((folder) => folder.id === activeFolderId) ?? ordered[0]
  const allFiles = useMemo(
    () => ordered.flatMap((folder) => flattenFiles(folder.tree ?? [], folder.path, folder.id)),
    [ordered],
  )
  const allFilesCount = allFiles.length
  const newFileLocked = Boolean(pendingEmptyFile && !(contents[pendingEmptyFile.id] ?? '').trim())
  const newFileLockedTitle = '请先输入内容，或切换后自动清理当前空文件'

  const clearDragState = () => {
    draggedIdRef.current = null
    setDraggedId(null)
    setDropTarget(null)
  }

  const rootDropTargetAtPoint = (x: number, y: number): { id: string; position: 'before' | 'after' } | null => {
    for (const item of document.elementsFromPoint(x, y)) {
      if (!(item instanceof HTMLElement)) continue
      const root = item.closest<HTMLElement>('[data-root-folder-id]')
      if (!root?.dataset.rootFolderId) continue
      const row = root.querySelector<HTMLElement>('.root-folder-row')
      const rect = (row ?? root).getBoundingClientRect()
      const position = y > rect.top + rect.height / 2 ? 'after' : 'before'
      return { id: root.dataset.rootFolderId, position }
    }
    return null
  }

  const startRootFolderDrag = (event: ReactPointerEvent<HTMLElement>, folderId: string) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement | null
    if (target?.closest('.row-action, .root-expand')) return

    const startX = event.clientX
    const startY = event.clientY
    let didStartDrag = false

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
    const finish = () => {
      cleanup()
      clearDragState()
    }
    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const movedX = Math.abs(pointerEvent.clientX - startX)
      const movedY = Math.abs(pointerEvent.clientY - startY)
      if (!didStartDrag && Math.max(movedX, movedY) < 5) return

      if (!didStartDrag) {
        didStartDrag = true
        suppressNextRootClickRef.current = true
        draggedIdRef.current = folderId
        setDraggedId(folderId)
        setDropTarget(null)
      }

      pointerEvent.preventDefault()
      const target = rootDropTargetAtPoint(pointerEvent.clientX, pointerEvent.clientY)
      setDropTarget(target && target.id !== draggedIdRef.current ? target : null)
    }
    const handlePointerUp = (pointerEvent: PointerEvent) => {
      if (!didStartDrag) {
        cleanup()
        return
      }
      pointerEvent.preventDefault()
      const sourceId = draggedIdRef.current
      const target = rootDropTargetAtPoint(pointerEvent.clientX, pointerEvent.clientY)
      if (sourceId && target && sourceId !== target.id) reorderFolders(sourceId, target.id, target.position)
      finish()
      window.setTimeout(() => {
        suppressNextRootClickRef.current = false
      }, 120)
    }
    const handlePointerCancel = () => finish()

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp, { once: true })
    window.addEventListener('pointercancel', handlePointerCancel, { once: true })
  }

  const openFolderMenu = (event: MouseEvent, folder: RootFolder) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, folder })
  }

  return (
    <div className="sidebar-shell">
      <header className="sidebar-header" data-tauri-drag-region onPointerDownCapture={startWindowDrag}>
        <div className="sidebar-title-zone" data-tauri-drag-region>
          <span className="sidebar-brand-text" data-tauri-drag-region>JSONDOWN</span>
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
          onClick={() => {
            void runAfterPendingCleanup(() => selectFolder('all'))
          }}
        >
          <span className="system-folder-leading-spacer" />
          <span className="system-folder-expand-spacer" />
          <span className="system-folder-copy">
            <Folder size={15} fill="currentColor" />
            <strong>全部文件</strong>
          </span>
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
                data-root-folder-id={folder.id}
                className={[
                  'root-folder-group',
                  folder.id === activeFolderId ? 'is-active' : '',
                  draggedId === folder.id ? 'is-dragging' : '',
                  dropTarget?.id === folder.id ? 'is-drop-over' : '',
                  dropTarget?.id === folder.id && dropTarget.position === 'before' ? 'is-drop-before' : '',
                  dropTarget?.id === folder.id && dropTarget.position === 'after' ? 'is-drop-after' : '',
                ].filter(Boolean).join(' ')}
              >
                <div
                  className="root-folder-row"
                  onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => startRootFolderDrag(event, folder.id)}
                  onClickCapture={(event) => {
                    if (!suppressNextRootClickRef.current) return
                    event.preventDefault()
                    event.stopPropagation()
                    suppressNextRootClickRef.current = false
                  }}
                >
                  <span className="root-row-leading-spacer" aria-hidden="true" />
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
                      void runAfterPendingCleanup(() => {
                        selectFolder(folder.id)
                        if (!expanded) toggleRootExpanded(folder.id)
                      })
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
        locationHint={isTauriRuntime() ? '系统文件夹选择器' : '桌面 / Desktop（Mock）'}
        onCreate={(name) => {
          void (async () => {
            if (isTauriRuntime()) {
              const parentPath = await selectParentFolder()
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
            if (id) void requestOpenFile(id, allFiles)
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
          onNewFolder={() => {
            const name = window.prompt('新建文件夹名称', '新建文件夹')
            void createMockSubfolder(menu.folder.id, name ?? undefined)
              .then((id) => { if (id) showToast(`已在“${menu.folder.name}”下新建文件夹`) })
            setMenu(null)
          }}
          onNewFile={() => {
            void createMockFile(menu.folder.id).then((id) => {
              if (id) {
                void requestOpenFile(id, allFiles)
                showToast(`已在“${menu.folder.name}”下新建文件`)
              }
            })
            setMenu(null)
          }}
          newFileDisabled={newFileLocked}
          newFileDisabledTitle={newFileLockedTitle}
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
