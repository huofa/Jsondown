import { FileQuestion, FolderOpen, MoreHorizontal, SquarePen } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { useEditorStore } from '../stores/editorStore'
import { useOpenedFileCacheStore } from '../stores/openedFileCacheStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import { useThemeStore } from '../stores/themeStore'
import { backupTextFile, openExternalUrl, revealInFinder, writeTextFile } from '../services/tauriFileService'
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
import { PlainTextCodeEditor, type PlainTextCodeEditorHandle } from './PlainTextCodeEditor'
import { SidebarCollapseButton } from './SidebarCollapseButton'
import { CODE_TEXT_EXTENSIONS, MARKDOWN_EXTENSIONS } from '../utils/fileFilters'

type TextTemplate = {
  id: string
  name: string
  content: string
}

type EditorContextMenuState = {
  x: number
  y: number
  selectedText: string
  linkHref?: string
}

type WorkspaceSearchOpenDetail = {
  fileId: string
  query: string
  matchText: string
  firstMatchLine: number
  firstMatchColumn: number
  firstMatchByte: number
}

const textTemplateStorageKey = 'jsondown:text-templates'

const defaultTextTemplates: TextTemplate[] = [
  {
    id: 'json-basic',
    name: 'JSON 基础模板',
    content: '{\n  "title": "",\n  "description": "",\n  "tags": [],\n  "status": "active"\n}',
  },
  {
    id: 'yaml-basic',
    name: 'YAML 基础模板',
    content: 'title:\ndescription:\ntags:\n  -\nstatus: active',
  },
  {
    id: 'html-basic',
    name: 'HTML 基础模板',
    content: '<div>\n  内容\n</div>',
  },
  {
    id: 'text-basic',
    name: 'TEXT 基础模板',
    content: '标题：\n说明：\n备注：\n注意：',
  },
]

const loadTextTemplates = () => {
  if (typeof window === 'undefined') return defaultTextTemplates
  try {
    const raw = window.localStorage.getItem(textTemplateStorageKey)
    if (!raw) return defaultTextTemplates
    const parsed = JSON.parse(raw) as TextTemplate[]
    return Array.isArray(parsed) && parsed.length ? parsed : defaultTextTemplates
  } catch {
    return defaultTextTemplates
  }
}

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
  const [textTemplateOpen, setTextTemplateOpen] = useState(false)
  const [textTemplates, setTextTemplates] = useState<TextTemplate[]>(loadTextTemplates)
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateContent, setTemplateContent] = useState('')
  const [organizeResult, setOrganizeResult] = useState<MarkdownNormalizeResult | null>(null)
  const [organizing, setOrganizing] = useState(false)
  const [editorVisualReadyFileId, setEditorVisualReadyFileId] = useState<string | null>(null)
  const [editorContextMenu, setEditorContextMenu] = useState<EditorContextMenuState | null>(null)
  const [documentSearchVisible, setDocumentSearchVisible] = useState(false)
  const [documentSearchQuery, setDocumentSearchQuery] = useState('')
  const [documentSearchActiveIndex, setDocumentSearchActiveIndex] = useState(0)
  const [documentSearchCount, setDocumentSearchCount] = useState(0)
  const textTemplateMenuRef = useRef<HTMLDivElement>(null)
  const documentSearchInputRef = useRef<HTMLInputElement>(null)
  const plainTextEditorRef = useRef<PlainTextCodeEditorHandle>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const editorScrollRef = useRef<HTMLDivElement>(null)
  const pendingEditAnchorRef = useRef<ReadonlyEditAnchor | null>(null)
  const pendingWorkspaceSearchRef = useRef<WorkspaceSearchOpenDetail | null>(null)
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
  const isMarkdownFile = Boolean(file && MARKDOWN_EXTENSIONS.has(file.extension.toLowerCase()))
  const isTextCodeFile = Boolean(file && CODE_TEXT_EXTENSIONS.has(file.extension.toLowerCase()))

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
    if (file.editable && (isMarkdownFile || isTextCodeFile)) {
      void loadFileContent(file.id, file.path, file.kind)
      return
    }
    void openReadonlyFile(file)
  }, [file, isMarkdownFile, isTextCodeFile, loadFileContent, openReadonlyFile, pendingEmptyFile?.id])

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
        })
        return
      }
      setEditingFileId(null)
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
    if (typeof window === 'undefined') return
    window.localStorage.setItem(textTemplateStorageKey, JSON.stringify(textTemplates))
  }, [textTemplates])

  useEffect(() => {
    if (!textTemplateOpen) return
    const close = (event: MouseEvent) => {
      if (!textTemplateMenuRef.current?.contains(event.target as Node)) setTextTemplateOpen(false)
    }
    const closeOnBlur = () => setTextTemplateOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('blur', closeOnBlur)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('blur', closeOnBlur)
    }
  }, [textTemplateOpen])

  useEffect(() => {
    if (!editorContextMenu) return
    const close = () => setEditorContextMenu(null)
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('blur', close)
    }
  }, [editorContextMenu])

  const clearSearchHighlights = () => {
    const css = globalThis.CSS as unknown as { highlights?: { delete: (name: string) => void } } | undefined
    css?.highlights?.delete('jsondown-search')
    css?.highlights?.delete('jsondown-search-current')
  }

  const getSearchRoot = () =>
    editorScrollRef.current?.querySelector('.paper') as HTMLElement | null

  const collectSearchRanges = (query: string) => {
    const root = getSearchRoot()
    const value = query.trim()
    if (!root || !value) return []
    const ranges: Range[] = []
    const lowerValue = value.toLocaleLowerCase()
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        if (parent.closest('button, input, textarea, select, .editor-context-menu, .document-search-popover')) {
          return NodeFilter.FILTER_REJECT
        }
        return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      },
    })

    let node = walker.nextNode()
    while (node) {
      const text = node.textContent ?? ''
      const lowerText = text.toLocaleLowerCase()
      let from = 0
      while (from <= lowerText.length) {
        const index = lowerText.indexOf(lowerValue, from)
        if (index < 0) break
        const range = document.createRange()
        range.setStart(node, index)
        range.setEnd(node, index + value.length)
        ranges.push(range)
        from = index + Math.max(value.length, 1)
      }
      node = walker.nextNode()
    }
    return ranges
  }

  const applySearchHighlights = (ranges: Range[], activeIndex: number) => {
    clearSearchHighlights()
    const highlightCtor = (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight
    const css = globalThis.CSS as unknown as { highlights?: { set: (name: string, highlight: unknown) => void } } | undefined
    if (!highlightCtor || !css?.highlights || ranges.length === 0) return
    css.highlights.set('jsondown-search', new highlightCtor(...ranges))
    const current = ranges[activeIndex]
    if (current) css.highlights.set('jsondown-search-current', new highlightCtor(current))
  }

  const scrollRangeIntoView = (range?: Range) => {
    const scroll = editorScrollRef.current
    if (!scroll || !range) return
    const rect = range.getBoundingClientRect()
    const scrollRect = scroll.getBoundingClientRect()
    if (!rect.height && !rect.width) return
    const targetTop = scroll.scrollTop + rect.top - scrollRect.top - scrollRect.height * 0.35
    scroll.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
  }

  const refreshDocumentSearch = (query: string, requestedIndex = documentSearchActiveIndex, shouldScroll = true) => {
    const ranges = collectSearchRanges(query)
    const nextCount = ranges.length
    const nextIndex = nextCount ? ((requestedIndex % nextCount) + nextCount) % nextCount : 0
    setDocumentSearchCount(nextCount)
    setDocumentSearchActiveIndex(nextIndex)
    applySearchHighlights(ranges, nextIndex)
    if (shouldScroll) scrollRangeIntoView(ranges[nextIndex])
  }

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'f') return
      if (!file) return
      event.preventDefault()
      event.stopPropagation()
      setDocumentSearchVisible(true)
      window.setTimeout(() => {
        documentSearchInputRef.current?.focus()
        documentSearchInputRef.current?.select()
      }, 0)
    }
    window.addEventListener('keydown', openSearch, true)
    return () => window.removeEventListener('keydown', openSearch, true)
  }, [file])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceSearchOpenDetail>).detail
      if (!detail) return
      pendingWorkspaceSearchRef.current = detail
      setDocumentSearchQuery(detail.query)
      setDocumentSearchVisible(false)
      setDocumentSearchActiveIndex(0)
    }
    window.addEventListener('jsondown:workspace-search-open', handler)
    return () => window.removeEventListener('jsondown:workspace-search-open', handler)
  }, [])

  useEffect(() => {
    if (!file) {
      clearSearchHighlights()
      setDocumentSearchVisible(false)
      setDocumentSearchQuery('')
      setDocumentSearchCount(0)
      return
    }
    const pending = pendingWorkspaceSearchRef.current
    if (!pending || pending.fileId !== file.id || !fullContentLoaded) return
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        refreshDocumentSearch(pending.query, 0, true)
        pendingWorkspaceSearchRef.current = null
      })
    })
  }, [file?.id, fullContentLoaded, content, editorVisualReady])

  useEffect(() => {
    if (!documentSearchVisible) return
    window.requestAnimationFrame(() => refreshDocumentSearch(documentSearchQuery, documentSearchActiveIndex, false))
  }, [content, documentSearchQuery, documentSearchVisible, editorVisualReady, fullContentLoaded])

  useEffect(() => () => clearSearchHighlights(), [])

  const createDocument = () => {
    void createMockDocument(activeFolderId).then((id) => {
      if (id) {
        const latestFiles = useRootFolderStore
          .getState()
          .folders.flatMap((folder) => flattenFiles(folder.tree ?? [], folder.path, folder.id))
        void requestOpenFile(id, latestFiles)
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
    const beforeClientHeight = scroll?.clientHeight ?? 0
    const bottomFollowThreshold = Math.max(160, beforeClientHeight * 0.28)
    const wasNearBottom = beforeHeight - beforeTop - beforeClientHeight <= bottomFollowThreshold

    updateContent(id, markdown)

    const restoreScroll = () => {
      const current = editorScrollRef.current
      if (!current) return
      const maxTop = Math.max(0, current.scrollHeight - current.clientHeight)

      // 如果输入前光标所在区域已经贴近底部，输入换行后要像备忘录一样让内容上移、光标保持可见。
      if (wasNearBottom) {
        current.scrollTop = maxTop
      } else {
        // 否则保持用户原本视野，不因为自动高度调整跳动。
        current.scrollTop = Math.min(beforeTop, maxTop)
      }
    }

    const scheduleRestoreScroll = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(restoreScroll)
      })
    }

    scheduleRestoreScroll()
    window.setTimeout(scheduleRestoreScroll, 40)
    window.setTimeout(scheduleRestoreScroll, 120)
  }

  const rememberTemplateSelection = () => {
    if (isTextCodeFile) {
      plainTextEditorRef.current?.rememberSelection()
      return
    }
    editorApi?.rememberSelection()
  }

  const handleTextTemplateButton = () => {
    if (!file?.editable || !isEditing) {
      showToast('请先点击正文进入编辑')
      return
    }
    rememberTemplateSelection()
    setTextTemplateOpen((open) => !open)
  }

  const insertTextTemplate = (template: TextTemplate) => {
    if (!file?.editable || !isEditing) {
      showToast('请先点击正文进入编辑')
      return
    }

    const inserted = isTextCodeFile
      ? plainTextEditorRef.current?.insertText(template.content)
      : editorApi?.insertText(template.content)

    if (!inserted) {
      showToast('请先定位光标')
      return
    }

    setTextTemplateOpen(false)
  }

  const startAddTemplate = () => {
    setEditingTemplateId(null)
    setTemplateName('')
    setTemplateContent('')
    setTemplateEditorOpen(true)
  }

  const startEditTemplate = (template: TextTemplate) => {
    setEditingTemplateId(template.id)
    setTemplateName(template.name)
    setTemplateContent(template.content)
    setTemplateEditorOpen(true)
  }

  const saveTextTemplate = () => {
    const name = templateName.trim()
    const nextContent = templateContent

    if (!name || !nextContent.trim()) {
      showToast('模板名称和内容不能为空')
      return
    }

    if (editingTemplateId) {
      setTextTemplates((templates) => templates.map((template) => (
        template.id === editingTemplateId ? { ...template, name, content: nextContent } : template
      )))
    } else {
      setTextTemplates((templates) => [
        ...templates,
        { id: `template-${Date.now()}`, name, content: nextContent },
      ])
    }

    setTemplateEditorOpen(false)
    setEditingTemplateId(null)
    setTemplateName('')
    setTemplateContent('')
  }

  const deleteTextTemplate = (id: string) => {
    setTextTemplates((templates) => templates.filter((template) => template.id !== id))
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

  const findAnchorHref = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return undefined
    const anchor = target.closest('a[href]') as HTMLAnchorElement | null
    return anchor?.href
  }

  const copyToClipboard = async (value: string, message: string) => {
    if (!value) {
      showToast('没有可复制的内容')
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      showToast(message)
    } catch {
      showToast('复制失败')
    }
  }

  const openLinkInDefaultBrowser = (href: string) => {
    void openExternalUrl(href)
      .catch(() => showToast('链接打开失败'))
  }

  const handleEditorContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!file) return
    event.preventDefault()
    event.stopPropagation()
    setEditorContextMenu({
      x: event.clientX,
      y: event.clientY,
      selectedText: window.getSelection()?.toString() ?? '',
      linkHref: findAnchorHref(event.target),
    })
  }

  const handleEditorClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const href = findAnchorHref(event.target)
    if (!href) return
    if (isEditing && !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    event.stopPropagation()
    openLinkInDefaultBrowser(href)
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
        <TopEditorToolbar api={editorApi} disabled={!file?.editable || !isEditing || isTextCodeFile} />
        <div className="editor-actions">
          <div className="density-switcher text-template-tools" ref={textTemplateMenuRef}>
            <button
              title="插入常用文本模板"
              aria-label="文本模板"
              disabled={!file?.editable || !isEditing}
              onMouseDown={() => rememberTemplateSelection()}
              onClick={handleTextTemplateButton}
            >
              <span>文本模板</span>
            </button>
            {textTemplateOpen && (
              <div className="density-menu text-template-menu">
                <div className="text-template-list">
                  {textTemplates.map((template) => (
                    <div className="text-template-row" key={template.id}>
                      <button
                        className="text-template-insert"
                        title={template.content}
                        onMouseDown={() => rememberTemplateSelection()}
                        onClick={() => insertTextTemplate(template)}
                      >
                        {template.name}
                      </button>
                      <button className="text-template-mini" onClick={() => startEditTemplate(template)}>编辑</button>
                      <button className="text-template-mini" onClick={() => deleteTextTemplate(template.id)}>删除</button>
                    </div>
                  ))}
                </div>
                {templateEditorOpen ? (
                  <div className="text-template-editor">
                    <input
                      value={templateName}
                      placeholder="模板名称"
                      onChange={(event) => setTemplateName(event.currentTarget.value)}
                    />
                    <textarea
                      value={templateContent}
                      placeholder="模板内容"
                      onChange={(event) => setTemplateContent(event.currentTarget.value)}
                    />
                    <div className="text-template-editor-actions">
                      <button onClick={saveTextTemplate}>保存</button>
                      <button onClick={() => setTemplateEditorOpen(false)}>取消</button>
                    </div>
                  </div>
                ) : (
                  <button className="text-template-add" onClick={startAddTemplate}>添加模板</button>
                )}
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

      {file && documentSearchVisible && (
        <div
          className="document-search-popover"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <input
            ref={documentSearchInputRef}
            value={documentSearchQuery}
            placeholder="查找"
            onChange={(event) => {
              const value = event.currentTarget.value
              setDocumentSearchQuery(value)
              refreshDocumentSearch(value, 0, true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setDocumentSearchVisible(false)
                clearSearchHighlights()
                return
              }
              if (event.key === 'Enter') {
                const next = event.shiftKey ? documentSearchActiveIndex - 1 : documentSearchActiveIndex + 1
                refreshDocumentSearch(documentSearchQuery, next, true)
              }
            }}
          />
          <span className="document-search-count">
            {documentSearchQuery.trim() ? `${documentSearchCount ? documentSearchActiveIndex + 1 : 0}/${documentSearchCount}` : '0/0'}
          </span>
          <button
            aria-label="上一个"
            disabled={!documentSearchCount}
            onClick={() => refreshDocumentSearch(documentSearchQuery, documentSearchActiveIndex - 1, true)}
          >
            ‹
          </button>
          <button
            aria-label="下一个"
            disabled={!documentSearchCount}
            onClick={() => refreshDocumentSearch(documentSearchQuery, documentSearchActiveIndex + 1, true)}
          >
            ›
          </button>
          <button
            onClick={() => {
              setDocumentSearchVisible(false)
              clearSearchHighlights()
            }}
          >
            完成
          </button>
        </div>
      )}

      {!file ? (
        <div className="editor-empty">
          <div className="empty-mark"><FileQuestion size={27} /></div>
          <h2>选一篇笔记，开始写作</h2>
          <p>Markdown、JSON、HTML、YAML 与文本文件可以直接编辑，图片会以预览方式打开。</p>
        </div>
      ) : (
        <div
          ref={editorScrollRef}
          className={`editor-scroll ${isTextCodeFile ? 'is-code-paper' : ''}`}
          onScroll={handleEditorScroll}
          onWheelCapture={markUserScrollIntent}
          onTouchMoveCapture={markUserScrollIntent}
          onPointerDownCapture={markUserScrollIntent}
          onContextMenu={handleEditorContextMenu}
          onClickCapture={handleEditorClick}
        >
          <div className="note-created-time">{formatDisplayTime(file.createdAt ?? file.updatedAt ?? new Date().toISOString())}</div>
          {file.kind === 'image' ? (
            <ImagePreview src={content} name={file.name} />
          ) : (
            <article className={`paper ${isTextCodeFile ? 'code-paper' : ''}`}>
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
              ) : file.editable && isTextCodeFile ? (
                fullContentLoaded ? (
                  <div
                    className={`plain-text-code-shell ${isEditing ? 'is-editing' : 'is-readonly'}`}
                    onMouseDownCapture={() => {
                      if (isEditing || !file.editable) return
                      flushSync(() => {
                        setEditingFileId(file.id)
                      })
                    }}
                  >
                    <PlainTextCodeEditor
                      ref={plainTextEditorRef}
                      value={content}
                      readOnly={!isEditing}
                      autoFocusStart={pendingEmptyFile?.id === file.id}
                      onChange={(value) => updateEditorContent(file.id, value)}
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
      {editorContextMenu && file && (
        <div
          className="editor-context-menu"
          style={{ left: editorContextMenu.x, top: editorContextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {editorContextMenu.linkHref && (
            <>
              <button
                onClick={() => {
                  openLinkInDefaultBrowser(editorContextMenu.linkHref ?? '')
                  setEditorContextMenu(null)
                }}
              >
                打开链接
              </button>
              <button
                onClick={() => {
                  void copyToClipboard(editorContextMenu.linkHref ?? '', '已复制链接')
                  setEditorContextMenu(null)
                }}
              >
                复制链接
              </button>
              <span className="editor-context-menu-separator" />
            </>
          )}
          <button
            disabled={!editorContextMenu.selectedText}
            onClick={() => {
              void copyToClipboard(editorContextMenu.selectedText, '已复制选中内容')
              setEditorContextMenu(null)
            }}
          >
            复制选中内容
          </button>
          <button
            onClick={() => {
              void copyToClipboard(content, '已复制全文')
              setEditorContextMenu(null)
            }}
          >
            复制全文
          </button>
          <button
            onClick={() => {
              void copyToClipboard(file.path, '已复制文件路径')
              setEditorContextMenu(null)
            }}
          >
            复制文件路径
          </button>
          <button
            onClick={() => {
              setEditorContextMenu(null)
              void revealInFinder(file.path)
                .then(() => showToast('已在访达中显示'))
                .catch(() => showToast(`阶段 A Mock：在访达中显示 ${file.name}`))
            }}
          >
            在访达中打开
          </button>
        </div>
      )}
      <ToastHost />
    </div>
  )
}
