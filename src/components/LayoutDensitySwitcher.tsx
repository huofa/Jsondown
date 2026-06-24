import { AlignJustify, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import type { LayoutDensity } from '../types/settings'

const options: { id: LayoutDensity; label: string }[] = [
  { id: 'compact', label: '紧凑' },
  { id: 'comfortable', label: '舒适' },
  { id: 'loose', label: '宽松' },
  { id: 'custom', label: '自定义' },
]

export function LayoutDensitySwitcher() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const layoutDensity = useSettingsStore((state) => state.layoutDensity)
  const customEditorLayout = useSettingsStore((state) => state.customEditorLayout)
  const setLayoutDensity = useSettingsStore((state) => state.setLayoutDensity)
  const setCustomEditorLayout = useSettingsStore((state) => state.setCustomEditorLayout)
  const resetCustomEditorLayout = useSettingsStore((state) => state.resetCustomEditorLayout)
  const label = options.find((option) => option.id === layoutDensity)?.label

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
        <span>{label}</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="density-menu">
          {options.map((option) => (
            <button
              key={option.id}
              className={option.id === layoutDensity ? 'is-active' : ''}
              onClick={() => {
                setLayoutDensity(option.id)
                if (option.id !== 'custom') setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
          {layoutDensity === 'custom' && (
            <div className="density-custom-panel">
              <label>
                字号 <span>{customEditorLayout.fontSize}px</span>
                <input
                  type="range"
                  min="14"
                  max="22"
                  step="1"
                  value={customEditorLayout.fontSize}
                  onChange={(event) => setCustomEditorLayout({ fontSize: Number(event.target.value) })}
                />
              </label>
              <label>
                行距 <span>{customEditorLayout.lineHeight.toFixed(2)}</span>
                <input
                  type="range"
                  min="1.4"
                  max="2.2"
                  step="0.05"
                  value={customEditorLayout.lineHeight}
                  onChange={(event) => setCustomEditorLayout({ lineHeight: Number(event.target.value) })}
                />
              </label>
              <label>
                段距 <span>{customEditorLayout.paragraphSpacing.toFixed(2)}em</span>
                <input
                  type="range"
                  min="0.25"
                  max="1.25"
                  step="0.05"
                  value={customEditorLayout.paragraphSpacing}
                  onChange={(event) => setCustomEditorLayout({ paragraphSpacing: Number(event.target.value) })}
                />
              </label>
              <label>
                左右边距 <span>{customEditorLayout.horizontalPadding}px</span>
                <input
                  type="range"
                  min="6"
                  max="72"
                  step="2"
                  value={customEditorLayout.horizontalPadding}
                  onChange={(event) => setCustomEditorLayout({ horizontalPadding: Number(event.target.value) })}
                />
              </label>
              <label>
                正文宽度 <span>{customEditorLayout.maxWidth}px</span>
                <input
                  type="range"
                  min="760"
                  max="1280"
                  step="20"
                  value={customEditorLayout.maxWidth}
                  onChange={(event) => setCustomEditorLayout({ maxWidth: Number(event.target.value) })}
                />
              </label>
              <button className="density-reset" onClick={resetCustomEditorLayout}>恢复默认</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
