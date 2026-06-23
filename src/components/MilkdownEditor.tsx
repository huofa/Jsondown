import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { useEffect, useRef } from 'react'

type MilkdownEditorProps = {
  value: string
  onChange: (markdown: string) => void
}

export function MilkdownEditor({ value, onChange }: MilkdownEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const initialValueRef = useRef(value)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!rootRef.current) return
    let disposed = false
    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: initialValueRef.current,
      features: {
        [CrepeFeature.AI]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.TopBar]: true,
      },
      featureConfigs: {
        [CrepeFeature.Placeholder]: {
          text: '开始写作，或输入 / 插入内容…',
        },
      },
    })

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, previousMarkdown) => {
        if (!disposed && markdown !== previousMarkdown) onChangeRef.current(markdown)
      })
    })

    void crepe.create()
    return () => {
      disposed = true
      void crepe.destroy()
    }
  }, [])

  return <div ref={rootRef} className="milkdown-host" />
}
