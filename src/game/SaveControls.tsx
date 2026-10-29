import { useGameText } from './useGameText'
import { useRef, useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { MAX_SAVE_BYTES } from '../persistence/saveGame'
import { errorMessage } from '../persistence/storage'
export function SaveControls() {
  const t = useGameText()
  const { playMode, saveStatus, saveBusy, requestSave, saveFeedback } = useGameStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)
  const disabled = reading || saveBusy
  const time = (value: string | null) => value ? new Date(value).toLocaleString() : t('Never')
  return <section aria-label={t('Save and load')}>
    <p className="eyebrow">{playMode === 'petesWorld' ? 'PETES WELT' : 'FACTORY'} · {t('SAVE & LOAD')}</p>
    <p>{playMode === 'petesWorld' ? 'Spielstände für Petes Welt.' : 'Spielstände für Factory.'}</p>
    <div className="save-grid">
      <button className="save-action" disabled={disabled} onClick={() => requestSave({ kind: 'save' })}>{t('Save Game')}</button>
      <button className="save-action" disabled={disabled} onClick={() => requestSave({ kind: 'load' })}>{t('Load Game')}</button>
      <button className="save-action" disabled={disabled} onClick={() => requestSave({ kind: 'export' })} title={t('Download a JSON save backup')}>{t('Export file')}</button>
      <button className="save-action" disabled={disabled} onClick={() => fileInput.current?.click()} title={t('Open a JSON save backup')}>{t('Import file')}</button>
      <button className="save-action" disabled={disabled} onClick={() => requestSave({ kind: 'load-auto' })}>{t('Load Autosave')}</button>
    </div>
    <input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label={t('Import save file')} onChange={async event => {
      const file = event.currentTarget.files?.[0]
      if (!file) return
      setReading(true)
      try {
        if (file.size > MAX_SAVE_BYTES) throw new Error(t('Save file exceeds the 2 MiB limit.'))
        requestSave({ kind: 'import', text: await file.text() })
      } catch (error) { saveFeedback(errorMessage(error), true) }
      finally { setReading(false); if (fileInput.current) fileInput.current.value = '' }
    }} />
    <div className="stats"><span>{t('Last manual save')}</span><b>{time(saveStatus.manualAt)}</b></div>
    <div className="stats"><span>{t('Last autosave')}</span><b>{time(saveStatus.autoAt)}</b></div>
    <button className="save-action new-game" aria-label={t('New game')} disabled={disabled} onClick={() => requestSave({ kind: 'new' })}>{t('↻ New game')}</button>
    <p className="inspection-note">{t('New game asks first. Your saved games stay safe.')}</p>
    {saveStatus.message && <p className={`inspection-note ${saveStatus.error ? 'save-error' : ''}`} role={saveStatus.error ? 'alert' : 'status'}>{t(saveStatus.message)}</p>}
  </section>
}
