import { FileQuestion, FolderOpen, MoreHorizontal, SquarePen } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { ReadonlyChunkViewer } from './ReadonlyChunkViewer'
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
  const jsonMenuRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const editorScrollRef = useRef<HTMLDivElement>(null)
  const pendingEditScrollTopRef = useRef<number | null>(null)
  const previousActiveFileIdRef = useRef<string | null>(null)

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
  const isMarkdownFile = Boolean(file && ['md', 'markdown'].includes(file.extension.toLowerCase()))
  const isJsonFile = Boolean(file && file.extension.toLowerCase() === 'json')

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
    if (file.editable) {
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

  const logScrollMetrics = (label: string) => {
    if (!import.meta.env.DEV) return
    const scroll = editorScrollRef.current
    if (!scroll) return
    console.debug(`[scroll:${label}]`, {
      scrollTop: scroll.scrollTop,
      scrollHeight: scroll.scrollHeight,
      clientHeight: scroll.clientHeight,
      distanceToBottom: scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight,
    })
  }

  const enterEditing = () => {
    if (!file?.editable) return
    logScrollMetrics('before-enter-editing')
    pendingEditScrollTopRef.current = editorScrollRef.current?.scrollTop ?? null
    void loadFileContent(file.id, file.path, file.kind).then(() => {
      setEditingFileId(file.id)
      window.requestAnimationFrame(() => {
        logScrollMetrics('after-editing-raf-1')
        window.requestAnimationFrame(() => {
          logScrollMetrics('after-editing-raf-2')
        })
      })
    })
  }

  useEffect(() => {
    if (!isEditing) return
    const scrollTop = pendingEditScrollTopRef.current
    if (scrollTop === null) return
    pendingEditScrollTopRef.current = null
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const scroll = editorScrollRef.current
        if (!scroll) return
        scroll.scrollTop = Math.min(scrollTop, Math.max(0, scroll.scrollHeight - scroll.clientHeight))
      })
    })
  }, [isEditing, file?.id])

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
    if (!file || !isMarkdownFile || !fullContentLoaded) return
    if (saveStatus === 'dirty') {
      const ok = await saveFileContent(file.id, file.path)
      if (!ok) {
        showToast('保存失败，暂不能整理')
        return
      }
    }

    const result = normalizeMarkdownForJsondown(contents[file.id] ?? '')
    if (!result.changed) {
      showToast('当前文档已符合 Jsondown 格式')
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
              disabled={!file || !isMarkdownFile || !fullContentLoaded || organizing}
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
        <div ref={editorScrollRef} className="editor-scroll" onScroll={handleEditorScroll}>
          <div className="note-created-time">{formatDisplayTime(file.createdAt ?? file.updatedAt ?? new Date().toISOString())}</div>
          {file.kind === 'image' ? (
            <ImagePreview src={content} name={file.name} />
          ) : (
            <article className="paper">
              {file.editable ? (
                fullContentLoaded ? (
                  <div
                    className={`milkdown-mode-shell ${isEditing ? 'is-editing' : 'is-readonly'}`}
                    title={!isEditing ? '点击正文进入编辑' : undefined}
                    onClick={() => {
                      if (!isEditing) enterEditing()
                    }}
                  >
                    <MilkdownEditor
                      key={file.id}
                      value={content}
                      readOnly={!isEditing}
                      autoFocusStart={pendingEmptyFile?.id === file.id}
                      onReady={setEditorApi}
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
