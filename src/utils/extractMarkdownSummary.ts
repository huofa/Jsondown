export function extractMarkdownSummary(content: string, fallback = '暂无内容') {
  const plain = content
    .replace(/```[\s\S]*?```/g, ' ')
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
