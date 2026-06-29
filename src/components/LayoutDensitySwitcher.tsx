import { AlignJustify, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { showToast } from './Toast'

export function LayoutDensitySwitcher() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const customEditorLayout = useSettingsStore((state) => state.customEditorLayout)
  const setCustomEditorLayout = useSettingsStore((state) => state.setCustomEditorLayout)
  const saveCustomEditorLayoutAsDefault = useSettingsStore((state) => state.saveCustomEditorLayoutAsDefault)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnBlur = () => setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('blur', closeOnBlur)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('blur', closeOnBlur)
    }
  }, [open])

  return (
    <div className="density-switcher" ref={ref}>
      <button title="排版设置" aria-label="排版设置" onClick={() => setOpen((value) => !value)}>
        <AlignJustify size={14} />
        <span>排版</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="density-menu typography-menu">
          <div className="density-custom-panel">
            <label>
              字号 <span>{customEditorLayout.fontSize}px</span>
              <input
                type="range"
                min="0"
                max="24"
                step="1"
                value={customEditorLayout.fontSize}
                onChange={(event) => setCustomEditorLayout({ fontSize: Number(event.target.value) })}
              />
            </label>
            <label>
              行高 <span>{customEditorLayout.lineHeight.toFixed(2)}</span>
              <input
                type="range"
                min="0.7"
                max="2.35"
                step="0.05"
                value={customEditorLayout.lineHeight}
                onChange={(event) => setCustomEditorLayout({ lineHeight: Number(event.target.value) })}
              />
            </label>
            <label>
              上下间距 <span>{customEditorLayout.paragraphSpacing.toFixed(1)}px</span>
              <input
                type="range"
                min="-14"
                max="28"
                step="0.5"
                value={customEditorLayout.paragraphSpacing}
                onChange={(event) => setCustomEditorLayout({ paragraphSpacing: Number(event.target.value) })}
              />
            </label>
            <label>
              字间距 <span>{customEditorLayout.letterSpacing.toFixed(1)}px</span>
              <input
                type="range"
                min="-0.4"
                max="1.4"
                step="0.1"
                value={customEditorLayout.letterSpacing}
                onChange={(event) => setCustomEditorLayout({ letterSpacing: Number(event.target.value) })}
              />
            </label>
            <label>
              左右边距 <span>{customEditorLayout.horizontalPadding}px</span>
              <input
                type="range"
                min="8"
                max="96"
                step="2"
                value={customEditorLayout.horizontalPadding}
                onChange={(event) => setCustomEditorLayout({ horizontalPadding: Number(event.target.value) })}
              />
            </label>
            <button
              className="density-reset"
              onClick={() => {
                void saveCustomEditorLayoutAsDefault()
                  .then(() => showToast('已设为默认排版'))
                  .catch(() => showToast('设为默认失败'))
              }}
            >
              设为默认
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
