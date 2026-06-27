import type { MarkdownNormalizeChange } from '../utils/markdownNormalize'

type MarkdownOrganizeDialogProps = {
  changes: MarkdownNormalizeChange[]
  warnings: MarkdownNormalizeChange[]
  onCancel: () => void
  onApply: () => void
}

export function MarkdownOrganizeDialog({ changes, warnings, onCancel, onApply }: MarkdownOrganizeDialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="native-dialog markdown-organize-dialog" role="dialog" aria-modal="true" aria-label="整理当前 Markdown">
        <h3>整理当前 Markdown</h3>
        <p className="dialog-description">
          将当前文件整理为 Jsondown 标准 Markdown 格式，不改写正文内容。应用前会自动备份原文件。
        </p>

        <div className="organize-section">
          <strong>本次将处理：</strong>
          <ul>
            {changes.map((change) => (
              <li key={change.type}>{change.description}：{change.count} 处</li>
            ))}
          </ul>
        </div>

        {warnings.length > 0 && (
          <div className="organize-section organize-warnings">
            <strong>注意：</strong>
            <ul>
              {warnings.map((warning) => (
                <li key={warning.type}>{warning.description}：{warning.count} 处</li>
              ))}
            </ul>
          </div>
        )}

        <div className="organize-section organize-safe-list">
          <strong>不会处理：</strong>
          <p>不改写正文，不总结，不移动段落，不改变自然编号，不处理代码块内容，不改变链接和图片路径。</p>
        </div>

        <div className="dialog-actions">
          <button onClick={onCancel}>取消</button>
          <button className="primary" onClick={onApply}>应用整理</button>
        </div>
      </div>
    </div>
  )
}
