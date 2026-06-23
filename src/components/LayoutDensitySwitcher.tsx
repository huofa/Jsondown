import { AlignJustify, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import type { LayoutDensity } from '../types/settings'
import { showToast } from './Toast'

const options: { id: LayoutDensity; label: string }[] = [
  { id: 'compact', label: '紧凑' },
  { id: 'comfortable', label: '舒适' },
  { id: 'loose', label: '宽松' },
  { id: 'custom', label: '自定义' },
]

export function LayoutDensitySwitcher() {
  const [open, setOpen] = useState(false)
  const layoutDensity = useSettingsStore((state) => state.layoutDensity)
  const setLayoutDensity = useSettingsStore((state) => state.setLayoutDensity)
  const label = options.find((option) => option.id === layoutDensity)?.label

  return (
    <div className="density-switcher">
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
                setOpen(false)
                if (option.id === 'custom') showToast('自定义排版面板将在 Tauri 设置中提供')
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
