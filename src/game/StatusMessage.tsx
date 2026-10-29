import { useGameText } from './useGameText'
import { useEffect, useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { importantNotification, notificationText } from '../state/uiMetadata'
function TransientMessage({ text, persistent }: { text: string; persistent: boolean }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    if (persistent) return
    const timeout = window.setTimeout(() => setVisible(false), 6500)
    return () => window.clearTimeout(timeout)
  }, [persistent])
  return <div className={`status-message ${visible ? 'is-visible' : ''}`} role="status" aria-live="polite">{visible ? text : ''}</div>
}
export function StatusMessage() {
  const t = useGameText()
  const { message, saveStatus, uiPanel } = useGameStore()
  const text = saveStatus.error && uiPanel !== 'menu' ? saveStatus.message : notificationText(message)
  const persistent = saveStatus.error || (text !== null && importantNotification(text))
  return text ? <TransientMessage key={`${persistent}:${text}`} text={t(text)} persistent={persistent} /> : <div className="status-message" />
}
