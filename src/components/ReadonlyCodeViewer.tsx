import { Clipboard } from 'lucide-react'
import { showToast } from './Toast'

export function ReadonlyCodeViewer({ content, language }: { content: string; language: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(content)
    showToast('已复制文件内容')
  }

  return (
    <div className="readonly-viewer">
      <div className="readonly-code-header">
        <span>{language.toUpperCase()}</span>
        <button onClick={copy}><Clipboard size={13} />复制</button>
      </div>
      <pre><code>{content}</code></pre>
    </div>
  )
}
