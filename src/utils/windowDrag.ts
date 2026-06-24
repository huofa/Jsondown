import type { MouseEvent, PointerEvent } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

const INTERACTIVE_SELECTOR = [
  'button',
  'input',
  'select',
  'textarea',
  'a',
  '[role="button"]',
  '[data-no-window-drag]',
  '.icon-button',
  '.tiny-icon-button',
  '.top-editor-toolbar',
  '.editor-actions',
  '.sidebar-actions',
  '.file-list-tools',
  '.sort-control',
  '.search-field',
  '.density-switcher',
  '.theme-switcher',
  '.color-menu',
].join(',')

export const startWindowDrag = (event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>) => {
  if (event.button !== 0) return

  const target = event.target as HTMLElement | null
  if (target?.closest(INTERACTIVE_SELECTOR)) return

  event.preventDefault()
  void getCurrentWindow().startDragging().catch(() => {
    // Browser preview / non-Tauri runtime: ignore.
  })
}
