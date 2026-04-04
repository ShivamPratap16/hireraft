import { useEffect, useRef, useState, useCallback } from 'react'

export interface LogMessage {
  run_id: string
  platform: string
  level: string
  message: string
  timestamp: string
}

export function useWebSocket(url: string) {
  const [messages, setMessages] = useState<LogMessage[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}${url}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      setTimeout(connect, 3000)
    }
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LogMessage
        setMessages((prev) => [data, ...prev].slice(0, 500))
      } catch { /* ignore malformed */ }
    }
    wsRef.current = ws
  }, [url])

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [connect])

  const clear = useCallback(() => setMessages([]), [])

  return { messages, connected, clear }
}
