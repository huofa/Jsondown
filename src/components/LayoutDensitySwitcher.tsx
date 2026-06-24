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
                上下间距 <span>{customEditorLayout.lineHeight.toFixed(2)}</span>
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
                字间距 <span>{customEditorLayout.letterSpacing.toFixed(1)}px</span>
                <input
                  type="range"
                  min="-0.4"
                  max="1.2"
                  step="0.1"
                  value={customEditorLayout.letterSpacing}
                  onChange={(event) => setCustomEditorLayout({ letterSpacing: Number(event.target.value) })}
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
              <button className="density-reset" onClick={resetCustomEditorLayout}>恢复默认</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
