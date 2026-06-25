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
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Undo2,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import type { EditorCommand, EditorCommandApi } from '../types/editorCommand'
import { useEffect, useRef, useState, type MouseEvent } from 'react'

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

const colorPresets = [
  { name: '暖黄', text: '#6c4a05', background: '#f7d56b' },
  { name: '玫瑰', text: '#7a3046', background: '#f2d4dc' },
  { name: '杏橙', text: '#7b461c', background: '#f4c59d' },
  { name: '薄荷', text: '#23645a', background: '#cfebe3' },
  { name: '雾蓝', text: '#275d7c', background: '#d7eaf7' },
]

export function TopEditorToolbar({ api, disabled }: TopEditorToolbarProps) {
  const [colorOpen, setColorOpen] = useState(false)
  const [colorMenuPosition, setColorMenuPosition] = useState({ left: 0, top: 0 })
  const colorButtonRef = useRef<HTMLButtonElement>(null)
  const isDisabled = disabled || !api
  const run = (command: EditorCommand) => api?.run(command)
  const keepSelection = (event: MouseEvent) => {
    api?.rememberSelection()
    event.preventDefault()
  }

  useEffect(() => {
    if (!colorOpen) return

    const closeColorMenu = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (colorButtonRef.current?.contains(target)) return
      if (document.querySelector('.color-menu')?.contains(target)) return
      setColorOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setColorOpen(false)
    }
    window.addEventListener('pointerdown', closeColorMenu, true)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeColorMenu, true)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [colorOpen])

  const colorMenu = colorOpen
    ? createPortal(
      <div
        className="toolbar-floating-menu color-menu"
        style={{ left: colorMenuPosition.left, top: colorMenuPosition.top }}
      >
        {colorPresets.map((preset) => (
          <button
            key={preset.name}
            title={preset.name}
            aria-label={preset.name}
            style={{ color: preset.text, background: preset.background }}
            onMouseDown={keepSelection}
            onClick={() => {
              api?.applyColor(preset.text, preset.background)
              setColorOpen(false)
            }}
          >
            A
          </button>
        ))}
      </div>,
      document.body,
    )
    : null

  return (
    <div className="top-editor-toolbar" aria-label="编辑工具栏">
      <div className="toolbar-scroll">
        <div className="toolbar-group history-group">
          {commandButtons.slice(0, 2).map(({ command, label, icon: Icon }) => (
            <button key={command} disabled={isDisabled} title={label} aria-label={label} onMouseDown={keepSelection} onClick={() => run(command)}>
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
          <option value="4">标题 4</option>
          <option value="5">标题 5</option>
          <option value="6">标题 6</option>
        </select>
        <div className="toolbar-separator" />
        <div className="toolbar-group">
          {commandButtons.slice(2, 6).map(({ command, label, icon: Icon }) => (
            <button key={command} disabled={isDisabled} title={label} aria-label={label} onMouseDown={keepSelection} onClick={() => run(command)}>
              <Icon size={14} />
            </button>
          ))}
          <div className="color-control">
            <button
              disabled={isDisabled}
              ref={colorButtonRef}
              title="文字颜色"
              aria-label="文字颜色"
              onMouseDown={keepSelection}
              onClick={() => {
                const rect = colorButtonRef.current?.getBoundingClientRect()
                if (rect) {
                  setColorMenuPosition({
                    left: rect.left,
                    top: rect.bottom + 6,
                  })
                }
                setColorOpen((open) => !open)
              }}
            >
              <Palette size={14} />
            </button>
          </div>
        </div>
        <div className="toolbar-separator" />
        <div className="toolbar-group">
          <button
            disabled={isDisabled}
            title="链接"
            aria-label="链接"
            onMouseDown={keepSelection}
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
            onMouseDown={keepSelection}
            onClick={() => {
              const url = window.prompt('输入图片地址')
              if (url) api?.run('image', url)
            }}
          >
            <Image size={14} />
          </button>
          {commandButtons.slice(6).map(({ command, label, icon: Icon }) => (
            <button key={command} disabled={isDisabled} title={label} aria-label={label} onMouseDown={keepSelection} onClick={() => run(command)}>
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>
      {colorMenu}
    </div>
  )
}
