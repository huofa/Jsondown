import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useUiStore } from '../stores/uiStore'

export function SidebarCollapseButton() {
  const collapsed = useUiStore((state) => state.isRootSidebarCollapsed)
  const toggle = useUiStore((state) => state.toggleRootSidebarCollapsed)
  return (
    <button
      className="sidebar-collapse-button"
      onClick={toggle}
      title={collapsed ? '展开资料夹栏' : '折叠资料夹栏'}
      aria-label={collapsed ? '展开资料夹栏' : '折叠资料夹栏'}
    >
      {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
    </button>
  )
}
