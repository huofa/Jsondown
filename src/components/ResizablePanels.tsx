import { type PointerEvent, type ReactNode, useRef, useState } from 'react'
import { useUiStore } from '../stores/uiStore'

type ResizablePanelsProps = {
  left: ReactNode
  middle: ReactNode
  right: ReactNode
}

export function ResizablePanels({ left, middle, right }: ResizablePanelsProps) {
  const collapsed = useUiStore((state) => state.isRootSidebarCollapsed)
  const [leftWidth, setLeftWidth] = useState(244)
  const [middleWidth, setMiddleWidth] = useState(326)
  const drag = useRef<{ panel: 'left' | 'middle'; x: number; width: number } | null>(null)

  const startResize = (panel: 'left' | 'middle') => (event: PointerEvent<HTMLDivElement>) => {
    drag.current = {
      panel,
      x: event.clientX,
      width: panel === 'left' ? leftWidth : middleWidth,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const resize = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const width = drag.current.width + event.clientX - drag.current.x
    if (drag.current.panel === 'left') setLeftWidth(Math.min(360, Math.max(190, width)))
    else setMiddleWidth(Math.min(500, Math.max(260, width)))
  }

  const stopResize = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const divider = (panel: 'left' | 'middle') => (
    <div
      className="panel-divider"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={startResize(panel)}
      onPointerMove={resize}
      onPointerUp={stopResize}
      onDoubleClick={() => (panel === 'left' ? setLeftWidth(244) : setMiddleWidth(326))}
    />
  )

  return (
    <main className={`panel-layout ${collapsed ? 'is-sidebar-collapsed' : ''}`}>
      <section className="panel panel-left" style={{ width: collapsed ? 0 : leftWidth }}>{left}</section>
      {!collapsed && divider('left')}
      <section className="panel panel-middle" style={{ width: middleWidth }}>{middle}</section>
      {divider('middle')}
      <section className="panel panel-right">{right}</section>
    </main>
  )
}
