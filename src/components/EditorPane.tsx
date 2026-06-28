import { FileQuestion, FolderOpen, MoreHorizontal, SquarePen } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useEditorStore } from '../stores/editorStore'
import { useOpenedFileCacheStore } from '../stores/openedFileCacheStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import { useThemeStore } from '../stores/themeStore'
import { backupTextFile, revealInFinder, writeTextFile } from '../services/tauriFileService'
import type { EditorCommandApi } from '../types/editorCommand'
import { flattenFiles } from '../utils/flattenFiles'
import { formatDisplayTime } from '../utils/formatDisplayTime'
import { normalizeMarkdownForJsondown, type MarkdownNormalizeResult } from '../utils/markdownNormalize'
import { startWindowDrag } from '../utils/windowDrag'
import { ImagePreview } from './ImagePreview'
import { MilkdownEditor } from './MilkdownEditor'
import { ReadonlyChunkViewer, type ReadonlyEditAnchor } from './ReadonlyChunkViewer'
import { SaveStatus } from './SaveStatus'
import { ThemeSwitcher } from './ThemeSwitcher'
import { ToastHost, showToast } from './Toast'
import { TopEditorToolbar } from './TopEditorToolbar'
import { LayoutDensitySwitcher } from './LayoutDensitySwitcher'
import { MarkdownOrganizeDialog } from './MarkdownOrganizeDialog'
import { SidebarCollapseButton } from './SidebarCollapseButton'

export function EditorPane() {
  const folders = useRootFolderStore((state) => state.folders)
  const activeFolderId = useRootFolderStore((state) => state.activeFolderId)
  const createMockDocument = useRootFolderStore((state) => state.createMockDocument)
  const {
    activeFileId,
    contents,
    loadedPaths,
    pendingEmptyFile,
    saveStatus,
    requestOpenFile,
    updateContent,
    replaceContentAsSaved,
    reloadFileContent,
  } = useEditorStore()
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
  const [jsonMenuOpen, setJsonMenuOpen] = useState(false)
  const [organizeResult, setOrganizeResult] = useState<MarkdownNormalizeResult | null>(null)
  const [organizing, setOrganizing] = useState(false)
  const [editorVisualReadyFileId, setEditorVisualReadyFileId] = useState<string | null>(null)
  const jsonMenuRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const editorScrollRef = useRef<HTMLDivElement>(null)
  const pendingEditAnchorRef = useRef<ReadonlyEditAnchor | null>(null)
  const previousActiveFileIdRef = useRef<string | null>(null)
  const lastUserScrollIntentAtRef = useRef(0)

  const allFiles = useMemo(
    () => folders.flatMap((folder) => flattenFiles(folder.tree ?? [], folder.path, folder.id)),
    [folders],
  )
  const file = allFiles.find((item) => item.id === activeFileId)
  const content = activeFileId ? (contents[activeFileId] ?? '') : ''
  const fullContentLoaded = Boolean(file && loadedPaths[file.id] === file.path && contents[file.id] !== undefined)
  const isNewFileLocked = Boolean(pendingEmptyFile && !(contents[pendingEmptyFile.id] ?? '').trim())
  const readonlyEntry = file ? readonlyEntries[getReadonlyKey(file)] : undefined
  const isEditing = Boolean(file?.editable && editingFileId === file.id)
  const editorVisualReady = Boolean(file?.editable && editorVisualReadyFileId === file.id)
  const isMarkdownFile = Boolean(file && ['md', 'markdown'].includes(file.extension.toLowerCase()))
  const isJsonFile = Boolean(file && file.extension.toLowerCase() === 'json')

  useEffect(() => {
    if (!file) return
    if (pendingEmptyFile?.id === file.id) {
      setEditingFileId(file.id)
      void loadFileContent(file.id, file.path, file.kind)
      return
    }
    if (file.kind === 'image') {
      void loadFileContent(file.id, file.path, file.kind)
      return
    }
    if (file.editable && isMarkdownFile) {
      void loadFileContent(file.id, file.path, file.kind)
      return
    }
    void openReadonlyFile(file)
  }, [file, isMarkdownFile, loadFileContent, openReadonlyFile, pendingEmptyFile?.id])

  useEffect(() => {
    if (!file || file.editable || isEditing || !readonlyEntry) return
    const scroll = editorScrollRef.current
    if (!scroll) return
    window.requestAnimationFrame(() => {
      scroll.scrollTop = readonlyEntry.scrollTop
    })
  }, [file?.id, isEditing, readonlyEntry?.path, readonlyEntry?.readonlyLoadedBytes])

  useEffect(() => {
    document.body.classList.toggle('jsondown-editor-mode-editing', isEditing)
    return () => {
      document.body.classList.remove('jsondown-editor-mode-editing')
    }
  }, [isEditing])

  useEffect(() => {
    const exitEditing = () => {
      if (!file?.editable || !isEditing) return
      if (saveStatus === 'dirty') {
        void saveFileContent(file.id, file.path).finally(() => {
          setEditingFileId(null)
          setEditorApi(null)
        })
        return
      }
      setEditingFileId(null)
      setEditorApi(null)
    }
    window.addEventListener('jsondown:exit-editing', exitEditing)
    return () => window.removeEventListener('jsondown:exit-editing', exitEditing)
  }, [file?.editable, file?.id, file?.path, isEditing, saveFileContent, saveStatus])

  useEffect(() => {
    const previousActiveFileId = previousActiveFileIdRef.current
    previousActiveFileIdRef.current = activeFileId

    if (!activeFileId) {
      setEditingFileId(null)
      setEditorApi(null)
      return
    }

    if (previousActiveFileId !== activeFileId) {
      setEditingFileId(pendingEmptyFile?.id === activeFileId ? activeFileId : null)
      setEditorApi(null)
      setEditorVisualReadyFileId(null)
    }
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

  useEffect(() => {
    if (!jsonMenuOpen) return
    const close = (event: MouseEvent) => {
      if (!jsonMenuRef.current?.contains(event.target as Node)) setJsonMenuOpen(false)
    }
    const closeOnBlur = () => setJsonMenuOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('blur', closeOnBlur)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('blur', closeOnBlur)
    }
  }, [jsonMenuOpen])

  const createDocument = () => {
    void createMockDocument(activeFolderId).then((id) => {
      if (id) {
        void requestOpenFile(id, allFiles)
        showToast('已新建 Markdown 笔记')
      }
    })
  }

  const enterEditing = (anchor?: ReadonlyEditAnchor) => {
    if (!file?.editable) return
    pendingEditAnchorRef.current = anchor ?? null
    setEditorVisualReadyFileId(null)
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

  const handleJsonButton = () => {
    if (!file) return
    if (!isJsonFile) {
      showToast('仅 JSON 文件可用')
      return
    }
    setJsonMenuOpen((open) => !open)
  }

  const handleJsonPlaceholder = (label: string) => {
    setJsonMenuOpen(false)
    showToast(`${label} 后续开发中`)
  }

  const handleOrganizeMarkdown = async () => {
    if (!file || !isMarkdownFile) return
    if (saveStatus === 'dirty') {
      const ok = await saveFileContent(file.id, file.path)
      if (!ok) {
        showToast('保存失败，暂不能整理')
        return
      }
    }

    await reloadFileContent(file.id, file.path, file.kind)
    const latestContent = useEditorStore.getState().contents[file.id] ?? contents[file.id] ?? ''
    const result = normalizeMarkdownForJsondown(latestContent)
    if (!result.changed) {
      setEditingFileId(null)
      setEditorApi(null)
      showToast('当前文档已符合 Jsondown 格式，已重新加载')
      return
    }
    setOrganizeResult(result)
  }

  const applyMarkdownOrganize = async () => {
    if (!file || !organizeResult) return
    setOrganizing(true)
    try {
      await backupTextFile(file.path)
      const result = await writeTextFile(file.path, organizeResult.markdown)
      if (!result.ok) throw new Error('write failed')
      replaceContentAsSaved(file.id, file.path, organizeResult.markdown, result.updatedAt ?? result.savedAt)
      setEditingFileId(null)
      setEditorApi(null)
      await reloadFileContent(file.id, file.path, file.kind)
      setOrganizeResult(null)
      showToast('已整理 Markdown，原文件已备份')
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[markdown:organize-failed]', error)
      showToast('整理失败，原文件未被覆盖')
    } finally {
      setOrganizing(false)
    }
  }

  const handleEditorScroll = () => {
    const scroll = editorScrollRef.current
    if (!scroll || !file || isEditing || file.kind === 'image') return
    updateReadonlyScrollTop(file, scroll.scrollTop)

    const isUserScroll = Date.now() - lastUserScrollIntentAtRef.current < 1500
    if (!isUserScroll) return

    const distanceToBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight
    if (distanceToBottom < scroll.clientHeight * 3) {
      void loadNextReadonlyChunk(file)
    }
  }

  const markUserScrollIntent = () => {
    lastUserScrollIntentAtRef.current = Date.now()
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
        <TopEditorToolbar api={editorApi} disabled={!file?.editable || !isEditing} />
        <div className="editor-actions">
          <div className="density-switcher json-tools" ref={jsonMenuRef}>
            <button title="JSON 工具" aria-label="JSON 工具" disabled={!file} onClick={handleJsonButton}>
              <span>JSON</span>
            </button>
            {jsonMenuOpen && (
              <div className="density-menu json-tools-menu">
                <button onClick={() => handleJsonPlaceholder('JSON 格式化')}>JSON 格式化</button>
                <button onClick={() => handleJsonPlaceholder('JSON 校验')}>JSON 校验</button>
                <button onClick={() => handleJsonPlaceholder('JSON 压缩')}>JSON 压缩</button>
                <button disabled>后续开发中</button>
              </div>
            )}
          </div>
          {file?.editable && <SaveStatus status={saveStatus} />}
          <div className="density-switcher markdown-organize-button">
            <button
              title="整理当前 Markdown 格式，不改写正文内容"
              aria-label="整理当前 Markdown"
              disabled={!file || !isMarkdownFile || organizing}
              onClick={() => void handleOrganizeMarkdown()}
            >
              <span>整理</span>
            </button>
          </div>
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
        <div
          ref={editorScrollRef}
          className="editor-scroll"
          onScroll={handleEditorScroll}
          onWheelCapture={markUserScrollIntent}
          onTouchMoveCapture={markUserScrollIntent}
          onPointerDownCapture={markUserScrollIntent}
        >
          <div className="note-created-time">{formatDisplayTime(file.createdAt ?? file.updatedAt ?? new Date().toISOString())}</div>
          {file.kind === 'image' ? (
            <ImagePreview src={content} name={file.name} />
          ) : (
            <article className="paper">
              {file.editable && isMarkdownFile ? (
                fullContentLoaded ? (
                  <div
                    className={[
                      'milkdown-mode-shell',
                      isEditing ? 'is-editing' : 'is-readonly',
                      editorVisualReady ? 'is-visual-ready' : 'is-visual-loading',
                    ].join(' ')}
                    onMouseDownCapture={() => {
                      if (isEditing || !file.editable) return
                      pendingEditAnchorRef.current = null
                      flushSync(() => {
                        setEditingFileId(file.id)
                      })
                    }}
                  >
                    {!editorVisualReady && (
                      <div className="readonly-skeleton milkdown-visual-skeleton">正在加载文档…</div>
                    )}
                    <MilkdownEditor
                      key={file.id}
                      value={content}
                      readOnly={!isEditing}
                      autoFocusStart={pendingEmptyFile?.id === file.id}
                      initialSelectionCoords={pendingEditAnchorRef.current}
                      onReady={setEditorApi}
                      onVisualReady={() => setEditorVisualReadyFileId(file.id)}
                      onInitialSelectionApplied={() => {
                        pendingEditAnchorRef.current = null
                      }}
                      onChange={(markdown) => updateEditorContent(file.id, markdown)}
                    />
                  </div>
                ) : (
                  <div className="readonly-skeleton">正在加载文档…</div>
                )
              ) : (
                <ReadonlyChunkViewer
                  file={file}
                  entry={readonlyEntry}
                  editable={file.editable}
                  onEnterEdit={enterEditing}
                />
              )}
            </article>
          )}
        </div>
      )}
      {organizeResult && (
        <MarkdownOrganizeDialog
          changes={organizeResult.changes}
          warnings={organizeResult.warnings}
          onCancel={() => setOrganizeResult(null)}
          onApply={() => void applyMarkdownOrganize()}
        />
      )}
      <ToastHost />
    </div>
  )
}
