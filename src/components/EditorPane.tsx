import { FileQuestion, FolderOpen, MoreHorizontal, SquarePen } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import { useThemeStore } from '../stores/themeStore'
import type { EditorCommandApi } from '../types/editorCommand'
import { flattenFiles } from '../utils/flattenFiles'
import { formatDisplayTime } from '../utils/formatDisplayTime'
import { ImagePreview } from './ImagePreview'
import { MilkdownEditor } from './MilkdownEditor'
import { ReadonlyCodeViewer } from './ReadonlyCodeViewer'
import { SaveStatus } from './SaveStatus'
import { ThemeSwitcher } from './ThemeSwitcher'
import { ToastHost, showToast } from './Toast'
import { TopEditorToolbar } from './TopEditorToolbar'

export function EditorPane() {
  const folders = useRootFolderStore((state) => state.folders)
  const activeFolderId = useRootFolderStore((state) => state.activeFolderId)
  const createMockDocument = useRootFolderStore((state) => state.createMockDocument)
  const { activeFileId, contents, saveStatus, openFile, updateContent, setSaveStatus, markSaved } = useEditorStore()
  const theme = useThemeStore((state) => state.theme)
  const [editorApi, setEditorApi] = useState<EditorCommandApi | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const savingTimer = useRef<number | undefined>(undefined)

  const allFiles = useMemo(
    () => folders.flatMap((folder) => flattenFiles(folder.tree ?? [], folder.path, folder.id)),
    [folders],
  )
  const file = allFiles.find((item) => item.id === activeFileId)
  const content = activeFileId ? (contents[activeFileId] ?? '') : ''

  useEffect(() => {
    if (saveStatus !== 'dirty' || !file?.editable) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      setSaveStatus('saving')
      savingTimer.current = window.setTimeout(markSaved, 420)
    }, 800)
    return () => window.clearTimeout(saveTimer.current)
  }, [content, file?.editable, markSaved, saveStatus, setSaveStatus])

  useEffect(() => () => {
    window.clearTimeout(saveTimer.current)
    window.clearTimeout(savingTimer.current)
  }, [])

  const createDocument = () => {
    const id = createMockDocument(activeFolderId)
    if (id) {
      openFile(id)
      showToast('已新建 Markdown 笔记')
    }
  }

  return (
    <div className={`editor-shell ${theme}`}>
      <header className="editor-header">
        <button className="new-document-button" onClick={createDocument} title="新建文档" aria-label="新建文档">
          <SquarePen size={15} />
        </button>
        <TopEditorToolbar api={editorApi} disabled={!file?.editable} />
        <div className="editor-actions">
          {file?.editable && <SaveStatus status={saveStatus} />}
          <ThemeSwitcher />
          <button
            className="icon-button"
            title="在访达中打开（Mock）"
            aria-label="在访达中打开"
            disabled={!file}
            onClick={() => file && showToast(`阶段 A Mock：在访达中显示 ${file.name}`)}
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
        <div className="editor-scroll">
          <div className="note-created-time">{formatDisplayTime(file.createdAt ?? file.updatedAt ?? new Date().toISOString())}</div>
          {file.editable ? (
            <article className="paper">
              <MilkdownEditor
                key={file.id}
                value={content}
                onReady={setEditorApi}
                onChange={(markdown) => updateContent(file.id, markdown)}
              />
            </article>
          ) : file.kind === 'image' ? (
            <ImagePreview src={content} name={file.name} />
          ) : (
            <ReadonlyCodeViewer content={content} language={file.extension} />
          )}
        </div>
      )}
      <ToastHost />
    </div>
  )
}
