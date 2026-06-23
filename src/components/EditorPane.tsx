import { FileQuestion, FolderOpen, MoreHorizontal, SquarePen } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import { useThemeStore } from '../stores/themeStore'
import { revealInFinder } from '../services/tauriFileService'
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
import { LayoutDensitySwitcher } from './LayoutDensitySwitcher'
import { SidebarCollapseButton } from './SidebarCollapseButton'

export function EditorPane() {
  const folders = useRootFolderStore((state) => state.folders)
  const activeFolderId = useRootFolderStore((state) => state.activeFolderId)
  const createMockDocument = useRootFolderStore((state) => state.createMockDocument)
  const { activeFileId, contents, saveStatus, openFile, updateContent } = useEditorStore()
  const loadFileContent = useEditorStore((state) => state.loadFileContent)
  const saveFileContent = useEditorStore((state) => state.saveFileContent)
  const theme = useThemeStore((state) => state.theme)
  const [editorApi, setEditorApi] = useState<EditorCommandApi | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  const allFiles = useMemo(
    () => folders.flatMap((folder) => flattenFiles(folder.tree ?? [], folder.path, folder.id)),
    [folders],
  )
  const file = allFiles.find((item) => item.id === activeFileId)
  const content = activeFileId ? (contents[activeFileId] ?? '') : ''

  useEffect(() => {
    if (!file) return
    void loadFileContent(file.id, file.path, file.kind)
  }, [file?.id, file?.kind, file?.path, loadFileContent])

  useEffect(() => {
    if (saveStatus !== 'dirty' || !file?.editable) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void saveFileContent(file.id, file.path)
    }, 800)
    return () => window.clearTimeout(saveTimer.current)
  }, [content, file?.editable, file?.id, file?.path, saveFileContent, saveStatus])

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

  return (
    <div className={`editor-shell ${theme}`}>
      <header className="editor-header">
        <SidebarCollapseButton />
        <button className="new-document-button" onClick={createDocument} title="新建文档" aria-label="新建文档">
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
