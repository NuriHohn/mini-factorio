import { useRef, useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { MAX_SAVE_BYTES } from '../persistence/saveGame'
import { errorMessage } from '../persistence/storage'
export function SaveControls() {
  const { playMode, saveStatus, saveBusy, requestSave, saveFeedback } = useGameStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)
  const disabled = reading || saveBusy
  const time = (value: string | null) => value ? new Date(value).toLocaleString() : 'Never'
  return <section aria-label="Save and load">
    <p className="eyebrow">{playMode === 'petesWorld' ? 'PETES WELT' : 'FACTORY'} · SAVE & LOAD</p>
    <p>Petes Welt und Factory haben getrennte Speicherplätze.</p>
    <div className="save-grid"><button className="save-action" disabled={disabled} onClick={() => requestSave({ kind: 'new', mode: 'petesWorld' })}>Neue Petes Welt</button><button className="save-action" disabled={disabled} onClick={() => requestSave({ kind: 'new', mode: 'factory' })}>Neue Factory</button><button className="save-action" disabled={disabled} onClick={() => requestSave({ kind: 'load', mode: playMode === 'factory' ? 'petesWorld' : 'factory' })}>Andere Spielweise laden</button></div>
    <div className="save-grid">
      <button className="save-action" disabled={disabled} onClick={() => requestSave({ kind: 'save' })}>Save Game</button>
      <button className="save-action" disabled={disabled} onClick={() => requestSave({ kind: 'load' })}>Load Game</button>
      <button className="save-action" disabled={disabled} onClick={() => requestSave({ kind: 'export' })} title="Download a JSON save backup">Export file</button>
      <button className="save-action" disabled={disabled} onClick={() => fileInput.current?.click()} title="Open a JSON save backup">Import file</button>
      <button className="save-action" disabled={disabled} onClick={() => requestSave({ kind: 'load-auto' })}>Load Autosave</button>
    </div>
    <input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label="Import save file" onChange={async event => {
      const file = event.currentTarget.files?.[0]
      if (!file) return
      setReading(true)
      try {
        if (file.size > MAX_SAVE_BYTES) throw new Error('Save file exceeds the 2 MiB limit.')
        requestSave({ kind: 'import', text: await file.text() })
      } catch (error) { saveFeedback(errorMessage(error), true) }
      finally { setReading(false); if (fileInput.current) fileInput.current.value = '' }
    }} />
    <div className="stats"><span>Last manual save</span><b>{time(saveStatus.manualAt)}</b></div>
    <div className="stats"><span>Last autosave</span><b>{time(saveStatus.autoAt)}</b></div>
    <button className="save-action new-game" aria-label="New game" disabled={disabled} onClick={() => requestSave({ kind: 'new' })}>↻ New game</button>
    <p className="inspection-note">New game asks first. Your saved games stay safe.</p>
    {saveStatus.message && <p className={`inspection-note ${saveStatus.error ? 'save-error' : ''}`} role={saveStatus.error ? 'alert' : 'status'}>{saveStatus.message}</p>}
  </section>
}
