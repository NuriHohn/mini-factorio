import { useGameText } from '../game/useGameText'
import { useGameStore } from '../state/gameStore'
import { PETES_WORLD_TOOLS, toolMetadata } from '../state/toolMetadata'
import { brushMode } from '../state/natureTools'
import { TOOL_HINTS, toolHintId } from '../state/toolHints'

export function PeteToolbar() {
  const t = useGameText()
  const { tool, select, touchActive, brushSize, setBrushSize, hintUses } = useGameStore()
  const hint = toolHintId(tool)
  return <section className="construction-toolbar" aria-label={t('Build toolbar')}>
    <div className="toolbar-top">
      {touchActive && <button className="save-action" aria-label={t('Close tools')} onClick={() => useGameStore.setState({ touchToolsOpen: false })}>×</button>}
      <strong>Petes Welt · Ressourcen und Landschaft</strong>
      <span className="selected-tool">{tool ? t(toolMetadata(tool).label) : t('Explore')}</span>
      {hint && (hintUses[hint] ?? 0) < 3 && <span className="tool-hint" role="note">{t(TOOL_HINTS[hint])}</span>}
    </div>
    <div className="toolbar-tools">
      <div className="tool-icons">{PETES_WORLD_TOOLS.filter(id => id !== 'playfulSpray').map(id => {
        const option = toolMetadata(id)
        return <button key={id} className="building tool-icon" data-tool={id} title={`${t(option.label)} · ${t(option.hint)}`} aria-label={t(option.label)} aria-pressed={tool === id} onClick={() => select(id)}>
          <span className="machine-icon" aria-hidden="true">{option.icon}</span><strong>{t(option.label)}</strong>
        </button>
      })}</div>
      {brushMode(tool) !== undefined && <fieldset className="brush-options"><legend>{t('Brush size')}</legend>{([1, 3, 5] as const).map(size => <button key={size} className="save-action" aria-pressed={brushSize === size} onClick={() => setBrushSize(size)}>{size}×{size}</button>)}</fieldset>}
    </div>
  </section>
}
