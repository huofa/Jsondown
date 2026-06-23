export function formatDisplayTime(iso?: string) {
  if (!iso) return ''
  const date = new Date(iso)
  const parts = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}年${value('month')}月${value('day')}日 ${value('hour')}:${value('minute')}`
}

export function compactPath(path: string) {
  return path.replace(/^\/Users\/[^/]+/, '~')
}
