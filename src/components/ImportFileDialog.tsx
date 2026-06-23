import { FileText, Upload } from 'lucide-react'
import { createPortal } from 'react-dom'

type ImportFileDialogProps = {
  open: boolean
  folderName?: string
  onClose: () => void
  onImport: () => void
}

export function ImportFileDialog({ open, folderName, onClose, onImport }: ImportFileDialogProps) {
  if (!open) return null
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="native-dialog import-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog-symbol"><Upload size={20} /></div>
        <h3>导入文件</h3>
        <p>阶段 A 将模拟选择一个 Markdown 文件，并加入“{folderName ?? '当前资料夹'}”。</p>
        <div className="mock-file-choice"><FileText size={17} /><span>导入的笔记.md</span></div>
        <div className="dialog-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={() => { onImport(); onClose() }}>选择</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
