import { FileQuestion, FolderOpen, MoreHorizontal } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import { useThemeStore } from '../stores/themeStore'
import { flattenFiles } from '../utils/flattenFiles'
import { MilkdownEditor } from './MilkdownEditor'
import { ReadonlyCodeViewer } from './ReadonlyCodeViewer'
import { ImagePreview } from './ImagePreview'
import { SaveStatus } from './SaveStatus'
import { ThemeSwitcher } from './ThemeSwitcher'
import { showToast } from './Toast'

export function EditorPane() {
  const folders = useRootFolderStore((state) => state.folders)
  const activeFolderId = useRootFolderStore((state) => state.activeFolderId)
  const { activeFileId, contents, saveStatus, updateContent, setSaveStatus, markSaved } = useEditorStore()
  const theme = useThemeStore((state) => state.theme)
  const saveTimer = useRef<number | undefined>(undefined)
  const savingTimer = useRef<number | undefined>(undefined)

  const activeFolder = folders.find((folder) => folder.id === activeFolderId)
  const file = useMemo(
    () => activeFolder
      ? flattenFiles(activeFolder.tree ?? [], activeFolder.path).find((item) => item.id === activeFileId)
      : undefined,
    [activeFolder, activeFileId],
  )
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

  if (!file) {
    return (
      <div className={`editor-shell ${theme}`}>
        <div className="editor-empty">
          <div className="empty-mark"><FileQuestion size={27} /></div>
          <h2>选一篇笔记，开始写作</h2>
          <p>Markdown 文件可以直接编辑，代码、文本与图片会以只读方式打开。</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`editor-shell ${theme}`}>
      <header className="editor-header">
        <div className="editor-title">
          <span className="eyebrow">{file.editable ? 'MARKDOWN NOTE' : 'READ ONLY'}</span>
          <h2>{file.name}</h2>
        </div>
        <div className="editor-actions">
          {file.editable && <SaveStatus status={saveStatus} />}
          <ThemeSwitcher />
          <button
            className="icon-button"
            title="在访达中打开（Mock）"
            onClick={() => showToast(`阶段 A Mock：在访达中显示 ${file.name}`)}
          >
            <FolderOpen size={16} />
          </button>
          <button className="icon-button" title="更多"><MoreHorizontal size={17} /></button>
        </div>
      </header>

      <div className="editor-scroll">
        {file.editable ? (
          <article className="paper">
            <MilkdownEditor
              key={file.id}
              value={content}
              onChange={(markdown) => updateContent(file.id, markdown)}
            />
          </article>
        ) : file.kind === 'image' ? (
          <ImagePreview src={content} name={file.name} />
        ) : (
          <ReadonlyCodeViewer content={content} language={file.extension} />
        )}
      </div>
    </div>
  )
}
