import {
  Bold,
  Braces,
  CheckSquare,
  Code2,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Undo2,
} from 'lucide-react'
import type { EditorCommand, EditorCommandApi } from '../types/editorCommand'

type TopEditorToolbarProps = {
  api: EditorCommandApi | null
  disabled?: boolean
}

const commandButtons: { command: EditorCommand; label: string; icon: typeof Bold }[] = [
  { command: 'undo', label: '撤销', icon: Undo2 },
  { command: 'redo', label: '重做', icon: Redo2 },
  { command: 'bold', label: '加粗', icon: Bold },
  { command: 'italic', label: '斜体', icon: Italic },
  { command: 'strikethrough', label: '删除线', icon: Strikethrough },
  { command: 'inline-code', label: '行内代码', icon: Code2 },
  { command: 'bullet-list', label: '无序列表', icon: List },
  { command: 'ordered-list', label: '有序列表', icon: ListOrdered },
  { command: 'task-list', label: '任务列表', icon: CheckSquare },
  { command: 'table', label: '表格', icon: Table2 },
  { command: 'code-block', label: '代码块', icon: Braces },
  { command: 'blockquote', label: '引用', icon: Quote },
  { command: 'hr', label: '分割线', icon: Minus },
]

export function TopEditorToolbar({ api, disabled }: TopEditorToolbarProps) {
  const isDisabled = disabled || !api
  const run = (command: EditorCommand) => api?.run(command)

  return (
    <div className="top-editor-toolbar" aria-label="编辑工具栏">
      <div className="toolbar-group history-group">
        {commandButtons.slice(0, 2).map(({ command, label, icon: Icon }) => (
          <button key={command} disabled={isDisabled} title={label} aria-label={label} onClick={() => run(command)}>
            <Icon size={14} />
          </button>
        ))}
      </div>
      <div className="toolbar-separator" />
      <select
        className="heading-select"
        disabled={isDisabled}
        defaultValue="0"
        title="段落样式"
        aria-label="段落样式"
        onChange={(event) => api?.heading(Number(event.target.value))}
      >
        <option value="0">正文</option>
        <option value="1">标题 1</option>
        <option value="2">标题 2</option>
        <option value="3">标题 3</option>
      </select>
      <div className="toolbar-separator" />
      <div className="toolbar-group">
        {commandButtons.slice(2, 6).map(({ command, label, icon: Icon }) => (
          <button key={command} disabled={isDisabled} title={label} aria-label={label} onClick={() => run(command)}>
            <Icon size={14} />
          </button>
        ))}
      </div>
      <div className="toolbar-separator" />
      <div className="toolbar-group">
        <button
          disabled={isDisabled}
          title="链接"
          aria-label="链接"
          onClick={() => {
            const url = window.prompt('输入链接地址', 'https://')
            if (url) api?.run('link', url)
          }}
        >
          <Link size={14} />
        </button>
        <button
          disabled={isDisabled}
          title="图片"
          aria-label="图片"
          onClick={() => {
            const url = window.prompt('输入图片地址')
            if (url) api?.run('image', url)
          }}
        >
          <Image size={14} />
        </button>
        {commandButtons.slice(6).map(({ command, label, icon: Icon }) => (
          <button key={command} disabled={isDisabled} title={label} aria-label={label} onClick={() => run(command)}>
            <Icon size={14} />
          </button>
        ))}
      </div>
    </div>
  )
}
