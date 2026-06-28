import type { ReactNode } from 'react'

type MarkdownRenderedViewerProps = {
  markdown: string
  emptyText?: string
}

const sanitizeStyleColor = (value: string) => {
  const trimmed = value.trim()
  return /^#[0-9a-f]{3,8}$/i.test(trimmed) || /^rgba?\([^)]+\)$/i.test(trimmed) ? trimmed : ''
}

const extractSafeSpanStyle = (rawStyle: string) => {
  const backgroundColor = rawStyle.match(/background-color\s*:\s*([^;]+)/i)?.[1]
  const color = rawStyle.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1]
  const safeBackground = backgroundColor ? sanitizeStyleColor(backgroundColor) : ''
  const safeColor = color ? sanitizeStyleColor(color) : ''

  if (!safeBackground && !safeColor) return undefined

  return {
    ...(safeColor ? { color: safeColor } : {}),
    ...(safeBackground ? { backgroundColor: safeBackground } : {}),
  }
}

const parseInline = (text: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = []
  let rest = text
  let index = 0

  const pushText = (value: string) => {
    if (!value) return
    value.split(/(<br\s*\/?>)/i).forEach((part, partIndex) => {
      if (!part) return
      if (/^<br\s*\/?>$/i.test(part)) {
        nodes.push(<br key={`${keyPrefix}-br-${index}-${partIndex}`} />)
      } else {
        nodes.push(part)
      }
    })
  }

  while (rest) {
    const spanMatch = rest.match(/^<span\s+style=(["'])(.*?)\1>(.*?)<\/span>/i)
    if (spanMatch) {
      const style = extractSafeSpanStyle(spanMatch[2])
      const content = spanMatch[3]
      nodes.push(
        <span key={`${keyPrefix}-span-${index}`} style={style}>
          {parseInline(content, `${keyPrefix}-span-${index}`)}
        </span>,
      )
      rest = rest.slice(spanMatch[0].length)
      index += 1
      continue
    }

    const tokenMatch = rest.match(/(`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*)/)
    if (!tokenMatch || tokenMatch.index === undefined) {
      pushText(rest)
      break
    }

    pushText(rest.slice(0, tokenMatch.index))

    const token = tokenMatch[0]
    const inner = token.replace(/^(`|\*\*|~~|\*)/, '').replace(/(`|\*\*|~~|\*)$/, '')

    if (token.startsWith('`')) {
      nodes.push(<code key={`${keyPrefix}-code-${index}`}>{inner}</code>)
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-strong-${index}`}>{parseInline(inner, `${keyPrefix}-strong-${index}`)}</strong>)
    } else if (token.startsWith('~~')) {
      nodes.push(<del key={`${keyPrefix}-del-${index}`}>{parseInline(inner, `${keyPrefix}-del-${index}`)}</del>)
    } else {
      nodes.push(<em key={`${keyPrefix}-em-${index}`}>{parseInline(inner, `${keyPrefix}-em-${index}`)}</em>)
    }

    rest = rest.slice(tokenMatch.index + token.length)
    index += 1
  }

  return nodes
}

const isListLine = (line: string) =>
  /^\s*(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/.test(line)

const isBlockStart = (line: string) =>
  /^\s*#{1,6}\s+/.test(line)
  || /^\s*(?:---|\*\*\*|___)\s*$/.test(line)
  || /^\s*>/.test(line)
  || isListLine(line)
  || /^\s*```/.test(line)

export function MarkdownRenderedViewer({ markdown, emptyText = '暂无内容' }: MarkdownRenderedViewerProps) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let cursor = 0
  let blockIndex = 0

  while (cursor < lines.length) {
    const line = lines[cursor]

    if (!line.trim()) {
      cursor += 1
      continue
    }

    const fence = line.match(/^\s*```\s*([a-zA-Z0-9_-]+)?\s*$/)
    if (fence) {
      const codeLines: string[] = []
      cursor += 1

      while (cursor < lines.length && !/^\s*```\s*$/.test(lines[cursor])) {
        codeLines.push(lines[cursor])
        cursor += 1
      }

      if (cursor < lines.length) cursor += 1
      blocks.push(
        <pre key={`block-${blockIndex}`} data-jd-readonly-block="true" data-jd-text={codeLines.join('\n').trim().slice(0, 80)}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      blockIndex += 1
      continue
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (heading) {
      const level = Math.min(6, heading[1].length)
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements
      blocks.push(
        <HeadingTag key={`block-${blockIndex}`} data-jd-readonly-block="true" data-jd-text={heading[2].trim().slice(0, 80)}>
          {parseInline(heading[2], `block-${blockIndex}`)}
        </HeadingTag>,
      )
      cursor += 1
      blockIndex += 1
      continue
    }

    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push(<hr key={`block-${blockIndex}`} />)
      cursor += 1
      blockIndex += 1
      continue
    }

    if (/^\s*>/.test(line)) {
      const quoteLines: string[] = []
      while (cursor < lines.length && /^\s*>/.test(lines[cursor])) {
        quoteLines.push(lines[cursor].replace(/^\s*>\s?/, ''))
        cursor += 1
      }
      blocks.push(
        <blockquote key={`block-${blockIndex}`} data-jd-readonly-block="true" data-jd-text={quoteLines.join(' ').trim().slice(0, 80)}>
          {quoteLines.map((quoteLine, index) => (
            <p key={`quote-${blockIndex}-${index}`}>{parseInline(quoteLine, `quote-${blockIndex}-${index}`)}</p>
          ))}
        </blockquote>,
      )
      blockIndex += 1
      continue
    }

    if (isListLine(line)) {
      const items: Array<{ text: string; checked?: boolean; ordered?: boolean }> = []
      let ordered = false
      let task = false

      while (cursor < lines.length && isListLine(lines[cursor])) {
        const taskMatch = lines[cursor].match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/)
        const orderedMatch = lines[cursor].match(/^\s*\d+[.)]\s+(.*)$/)
        const bulletMatch = lines[cursor].match(/^\s*[-*+]\s+(.*)$/)

        if (taskMatch) {
          task = true
          items.push({ text: taskMatch[2], checked: taskMatch[1].toLowerCase() === 'x' })
        } else if (orderedMatch) {
          ordered = true
          items.push({ text: orderedMatch[1], ordered: true })
        } else if (bulletMatch) {
          items.push({ text: bulletMatch[1] })
        }

        cursor += 1
      }

      const ListTag = ordered ? 'ol' : 'ul'
      blocks.push(
        <ListTag
          key={`block-${blockIndex}`}
          className={task ? 'contains-task-list' : undefined}
          data-jd-readonly-block="true"
          data-jd-text={items.map((item) => item.text).join(' ').trim().slice(0, 80)}
        >
          {items.map((item, index) => (
            <li key={`item-${blockIndex}-${index}`} className={task ? 'task-list-item' : undefined}>
              {task ? <input type="checkbox" checked={Boolean(item.checked)} readOnly /> : null}
              <span>{parseInline(item.text, `item-${blockIndex}-${index}`)}</span>
            </li>
          ))}
        </ListTag>,
      )
      blockIndex += 1
      continue
    }

    const paragraphLines = [line]
    cursor += 1

    while (cursor < lines.length && lines[cursor].trim() && !isBlockStart(lines[cursor])) {
      paragraphLines.push(lines[cursor])
      cursor += 1
    }

    blocks.push(
      <p key={`block-${blockIndex}`} data-jd-readonly-block="true" data-jd-text={paragraphLines.join(' ').trim().slice(0, 80)}>
        {paragraphLines.map((paragraphLine, index) => (
          <span key={`p-${blockIndex}-${index}`}>
            {index > 0 ? <br /> : null}
            {parseInline(paragraphLine, `p-${blockIndex}-${index}`)}
          </span>
        ))}
      </p>,
    )
    blockIndex += 1
  }

  return (
    <div className="markdown-rendered-viewer">
      {blocks.length ? blocks : <p>{emptyText}</p>}
    </div>
  )
}
