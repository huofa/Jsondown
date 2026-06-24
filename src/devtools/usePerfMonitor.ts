import { useEffect, useState } from 'react'
import { perfMonitor } from './perfMonitor'

export function usePerfMonitor() {
  const [summary, setSummary] = useState(() => perfMonitor.summary())

  useEffect(() => {
    const update = () => setSummary(perfMonitor.summary())
    const unsubscribe = perfMonitor.subscribe(update)
    return () => { unsubscribe() }
  }, [])

  return summary
}
