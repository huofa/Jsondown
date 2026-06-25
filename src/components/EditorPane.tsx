import { FileQuestion, FolderOpen, MoreHorizontal, SquarePen } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useOpenedFileCacheStore } from '../stores/openedFileCacheStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import { useThemeStore } from '../stores/themeStore'
import { revealInFinder } from '../services/tauriFileService'
import type { EditorCommandApi } from '../types/editorCommand'
import { flattenFiles } from '../utils/flattenFiles'
import { formatDisplayTime } from '../utils/formatDisplayTime'
import { startWindowDrag } from '../utils/windowDrag'
import { ImagePreview } from './ImagePreview'
import { MilkdownEditor } from './MilkdownEditor'
import { ReadonlyChunkViewer } from './ReadonlyChunkViewer'
import { SaveStatus } from './SaveStatus'
import { ThemeSwitcher } from './ThemeSwitcher'
import { ToastHost, showToast } from './Toast'
import { TopEditorToolbar } from './TopEditorToolbar'
import { LayoutDensitySwitcher } from './LayoutDensitySwitcher'
import { SidebarCollapseButton } from './SidebarCollapseButton'

export function EditorPane() {
  const folders = useRootFolderStore((state) => state.folders)
  const activeFolderId = useRootFolderStore((state) => state.activeFolderId)
  const createMockDocument = useRootFolderStore((state) => state.createMockDocument)
  const { activeFileId, contents, pendingEmptyFile, saveStatus, openFile, updateContent } = useEditorStore()
  const loadFileContent = useEditorStore((state) => state.loadFileContent)
  const saveFileContent = useEditorStore((state) => state.saveFileContent)
  const readonlyEntries = useOpenedFileCacheStore((state) => state.entries)
  const openReadonlyFile = useOpenedFileCacheStore((state) => state.openReadonlyFile)
  const loadNextReadonlyChunk = useOpenedFileCacheStore((state) => state.loadNextReadonlyChunk)
  const updateReadonlyScrollTop = useOpenedFileCacheStore((state) => state.updateScrollTop)
  const getReadonlyKey = useOpenedFileCacheStore((state) => state.getCacheKey)
  const theme = useThemeStore((state) => state.theme)
  const [editorApi, setEditorApi] = useState<EditorCommandApi | null>(null)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const editorScrollRef = useRef<HTMLDivElement>(null)

  const allFiles = useMemo(
    () => folders.flatMap((folder) => flattenFiles(folder.tree ?? [], folder.path, folder.id)),
    [folders],
  )
  const file = allFiles.find((item) => item.id === activeFileId)
  const content = activeFileId ? (contents[activeFileId] ?? '') : ''
  const isNewFileLocked = Boolean(pendingEmptyFile && !(contents[pendingEmptyFile.id] ?? '').trim())
  const readonlyEntry = file ? readonlyEntries[getReadonlyKey(file)] : undefined
  const isEditing = Boolean(file?.editable && editingFileId === file.id)

  useEffect(() => {
    if (!file) return
    if (pendingEmptyFile?.id === file.id) {
      setEditingFileId(file.id)
      return
    }
    if (file.kind === 'image') {
      void loadFileContent(file.id, file.path, file.kind)
      return
    }
    if (!isEditing) void openReadonlyFile(file)
  }, [file, isEditing, loadFileContent, openReadonlyFile, pendingEmptyFile?.id])

  useEffect(() => {
    if (!file || isEditing || !readonlyEntry) return
    const scroll = editorScrollRef.current
    if (!scroll) return
    window.requestAnimationFrame(() => {
      scroll.scrollTop = readonlyEntry.scrollTop
    })
  }, [file?.id, isEditing, readonlyEntry?.path])

  useEffect(() => {
    if (!activeFileId) {
      setEditingFileId(null)
      return
    }
    if (pendingEmptyFile?.id === activeFileId) setEditingFileId(activeFileId)
    else setEditingFileId(null)
    setEditorApi(null)
  }, [activeFileId, pendingEmptyFile?.id])

  useEffect(() => {
    if (saveStatus !== 'dirty' || !file?.editable || !isEditing) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void saveFileContent(file.id, file.path)
    }, 2500)
    return () => window.clearTimeout(saveTimer.current)
  }, [content, file?.editable, file?.id, file?.path, isEditing, saveFileContent, saveStatus])

  useEffect(() => () => {
    window.clearTimeout(saveTimer.current)
  }, [])

  const createDocument = () => {
    void createMockDocument(activeFolderId).then((id) => {
      if (id) {
        openFile(id)
        showToast('已新建 Markdown 笔记')
      }
    })
  }

  const enterEditing = () => {
    if (!file?.editable) return
    void loadFileContent(file.id, file.path, file.kind).then(() => {
      setEditingFileId(file.id)
    })
  }

  const updateEditorContent = (id: string, markdown: string) => {
    const scroll = editorScrollRef.current
    const beforeTop = scroll?.scrollTop ?? 0
    const beforeHeight = scroll?.scrollHeight ?? 0

    updateContent(id, markdown)

    const restoreScroll = () => {
      const current = editorScrollRef.current
      if (!current) return
      const maxTop = Math.max(0, current.scrollHeight - current.clientHeight)
      const addedHeight = Math.max(0, current.scrollHeight - beforeHeight)

      // 只有在内容高度增长（按了 Enter 新建行）且用户原本位于底部时，才允许自然滚动跟随
      if (addedHeight > 0 && beforeTop + current.clientHeight >= beforeHeight - 80) {
        current.scrollTop = Math.min(maxTop, beforeTop + addedHeight)
      } else {
        // 否则始终精确恢复滚动位置，确保输入字符时画面不动
        current.scrollTop = Math.min(beforeTop, maxTop)
      }
    }

    window.requestAnimationFrame(restoreScroll)
  }

  const handleEditorScroll = () => {
    const scroll = editorScrollRef.current
    if (!scroll || !file || isEditing || file.kind === 'image') return
    updateReadonlyScrollTop(file, scroll.scrollTop)
    const distanceToBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight
    if (distanceToBottom < scroll.clientHeight * 1.5) {
      void loadNextReadonlyChunk(file)
    }
  }

  return (
    <div className={`editor-shell ${theme}`}>
      <header className="editor-header" data-tauri-drag-region onPointerDownCapture={startWindowDrag}>
        <SidebarCollapseButton />
        <button
          className="new-document-button"
          onClick={createDocument}
          title={isNewFileLocked ? '请先输入内容，或切换后自动清理当前空文件' : '新建文档'}
          aria-label="新建文档"
          disabled={isNewFileLocked}
        >
          <SquarePen size={15} />
        </button>
        <TopEditorToolbar api={editorApi} disabled={!file?.editable} />
        <div className="editor-actions">
          {file?.editable && <SaveStatus status={saveStatus} />}
          <LayoutDensitySwitcher />
          <ThemeSwitcher />
          <button
            className="icon-button"
            title="在访达中打开（Mock）"
            aria-label="在访达中打开"
            disabled={!file}
            onClick={() => file && void revealInFinder(file.path)
              .then(() => showToast('已在访达中显示'))
              .catch(() => showToast(`阶段 A Mock：在访达中显示 ${file.name}`))}
          >
            <FolderOpen size={15} />
          </button>
          <button className="icon-button" title="更多" aria-label="更多"><MoreHorizontal size={16} /></button>
        </div>
      </header>

      {!file ? (
        <div className="editor-empty">
          <div className="empty-mark"><FileQuestion size={27} /></div>
          <h2>选一篇笔记，开始写作</h2>
          <p>Markdown 文件可以直接编辑，代码、文本与图片会以只读方式打开。</p>
        </div>
      ) : (
        <div ref={editorScrollRef} className="editor-scroll" onScroll={handleEditorScroll}>
          <div className="note-created-time">{formatDisplayTime(file.createdAt ?? file.updatedAt ?? new Date().toISOString())}</div>
          {file.editable && isEditing ? (
            <article className="paper">
              <MilkdownEditor
                key={file.id}
                value={content}
                autoFocusStart={pendingEmptyFile?.id === file.id}
                onReady={setEditorApi}
                onChange={(markdown) => updateEditorContent(file.id, markdown)}
              />
            </article>
          ) : file.kind === 'image' ? (
            <ImagePreview src={content} name={file.name} />
          ) : (
            <ReadonlyChunkViewer
              file={file}
              entry={readonlyEntry}
              editable={file.editable}
              onEnterEdit={enterEditing}
            />
          )}
        </div>
      )}
      <ToastHost />
    </div>
  )
}
