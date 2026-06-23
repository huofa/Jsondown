import { AlertCircle, Check, Cloud, LoaderCircle, PencilLine, RefreshCw } from 'lucide-react'
import type { SaveStatus as SaveStatusType } from '../types/editor'

const labels: Record<SaveStatusType, string> = {
  idle: '自动保存',
  dirty: '自动保存',
  saving: '正在保存',
  saved: '已保存',
  error: '保存失败',
  'external-changed': '文件已在外部更改',
}

export function SaveStatus({ status }: { status: SaveStatusType }) {
  const Icon =
    status === 'saving' ? LoaderCircle :
    status === 'dirty' ? PencilLine :
    status === 'error' ? AlertCircle :
    status === 'external-changed' ? RefreshCw :
    status === 'saved' ? Check : Cloud

  return (
    <span className={`save-status status-${status}`}>
      <Icon size={13} className={status === 'saving' ? 'spin' : ''} />
      {labels[status]}
    </span>
  )
}
