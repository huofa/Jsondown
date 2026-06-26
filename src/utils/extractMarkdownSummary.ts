export function extractMarkdownSummary(content: string, fallback = '暂无内容') {
  const plain = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<span\b[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<img\b[^>]*>/gi, ' [图片] ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~`|]/g, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  return plain.slice(1, 3).join(' · ') || plain[0] || fallback
}
