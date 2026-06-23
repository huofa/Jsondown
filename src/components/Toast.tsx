import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type ToastDetail = { message: string }

export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent<ToastDetail>('jsondown:toast', { detail: { message } }))
}

export function ToastHost() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    let timer: number | undefined
    const handleToast = (event: Event) => {
      setMessage((event as CustomEvent<ToastDetail>).detail.message)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setMessage(''), 2200)
    }
    window.addEventListener('jsondown:toast', handleToast)
    return () => {
      window.removeEventListener('jsondown:toast', handleToast)
      window.clearTimeout(timer)
    }
  }, [])

  if (!message) return null
  return createPortal(<div className="toast">{message}</div>, document.getElementById('toast-root')!)
}
