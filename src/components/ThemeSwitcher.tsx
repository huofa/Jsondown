import { useThemeStore } from '../stores/themeStore'
import type { EditorTheme } from '../types/editor'

const themes: { id: EditorTheme; label: string; color: string }[] = [
  { id: 'paper-white', label: '白纸', color: '#ffffff' },
  { id: 'paper-yellow', label: '暖纸', color: '#fbf5df' },
  { id: 'paper-gray', label: '灰白', color: '#f1f2f3' },
]

export function ThemeSwitcher() {
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)

  return (
    <div className="theme-switcher" aria-label="编辑器纸张主题">
      {themes.map((item) => (
        <button
          key={item.id}
          className={theme === item.id ? 'is-active' : ''}
          onClick={() => setTheme(item.id)}
          title={item.label}
          aria-label={item.label}
        >
          <span style={{ background: item.color }} />
        </button>
      ))}
    </div>
  )
}
