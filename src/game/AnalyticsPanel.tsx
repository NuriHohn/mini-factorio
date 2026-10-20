import { hasTechnology } from '../simulation/research'
import { useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { ITEMS, ITEM_DEFINITIONS } from '../simulation/items'
import type { Item } from '../simulation/items'
import { SIZE } from '../simulation/world'
import { HISTORY_MS, RATE_WINDOW_MS } from '../simulation/analytics'

const COLORS = ['#b9dc8b', '#f4ae72', '#83c9df']
export function AnalyticsPanel() {
  const { research, analytics, analyticsOpen, toggleAnalytics, focusBuilding } = useGameStore()
  // null follows the most recent productive types; an explicit choice stays stable.
  const [chosen, setChosen] = useState<Item[] | null>(null)
  const selected = chosen ?? analytics.recentItems
  const start = Math.max(0, analytics.timeMs - HISTORY_MS)
  const max = Math.max(1, ...analytics.history.flatMap(b => selected.map(item => b.produced[item])))
  const x = (time: number) => 38 + (time - start) / Math.max(RATE_WINDOW_MS, analytics.timeMs - start) * 270
  const y = (rate: number) => 134 - rate / max * 112
  const unlocked = hasTechnology(research, 'analytics1')
  return <aside className={`analytics-panel ${analyticsOpen ? 'is-open' : ''}`} aria-label="Production analytics">
    <button className="analytics-toggle" disabled={!unlocked} title={unlocked ? undefined : 'Requires Analytics I.'} aria-expanded={analyticsOpen && unlocked} aria-controls="analytics-content" onClick={toggleAnalytics}>{!unlocked ? 'Analytics · Requires Analytics I' : analyticsOpen ? '▸ Production analytics' : '◂ Analytics'}</button>
    {analyticsOpen && unlocked && <div id="analytics-content">
      <p className="eyebrow">ROLLING 60 SIMULATION SECONDS</p>
      <div className="stats"><span>Total production</span><b>{analytics.totalPerMinute.toFixed(1)} items/min</b></div>
      <div className="stats"><span>Average utilization</span><b>{(analytics.utilization * 100).toFixed(1)}%</b></div>
      <div className="stats"><span>Configured machines</span><b>{analytics.configuredMachines}</b></div>
      <div className="stats"><span>Active bottlenecks</span><b>{analytics.problems.length}</b></div>
      <table className="resource-table" aria-label="Production rates in items per minute"><thead><tr><th>Item</th><th>Produced</th><th>Consumed</th><th>Net</th></tr></thead><tbody>{ITEMS.map(item => <tr key={item}><th>{ITEM_DEFINITIONS[item].label}</th><td>{analytics.produced[item]}</td><td>{analytics.consumed[item]}</td><td>{analytics.produced[item] - analytics.consumed[item]}</td></tr>)}</tbody></table>
      <p className="inspection-note">items/min · Actual creation and committed recipe inputs. Transfers excluded. Utilization: time spent processing since the current task was configured; partially powered processing counts as active.</p>
      <h2>Production history</h2>
      <p className="inspection-note">Last 10 simulation minutes · 60-second buckets. Current minute is partial; the edge minute provides context. No extrapolation.</p>
      <fieldset className="analytics-items"><legend>Chart items (up to 3)</legend>{ITEMS.map(item => <label key={item}><input type="checkbox" checked={selected.includes(item)} disabled={!selected.includes(item) && selected.length >= 3} onChange={() => setChosen(selected.includes(item) ? selected.filter(i => i !== item) : [...selected, item])} />{ITEM_DEFINITIONS[item].label}</label>)}</fieldset>
      <button className="save-action" onClick={() => setChosen(null)}>Follow recent production</button>
      <svg viewBox="0 0 330 166" role="img" aria-label="Production history, items per minute" className="analytics-chart">
        <path d="M38 20V134H310" fill="none" stroke="#6c806f" />
        <text x="2" y="25">{max}/min</text><text x="19" y="137">0</text>
        <text x="38" y="155">{(start / 60000).toFixed(1)} min</text><text x="256" y="155">{(Math.max(RATE_WINDOW_MS, analytics.timeMs) / 60000).toFixed(1)} min</text>
        {selected.map((item, i) => {
          const points = Array.from({ length: 11 }, (_, n) => Math.floor(start / RATE_WINDOW_MS) * RATE_WINDOW_MS + n * RATE_WINDOW_MS).filter(t => t <= analytics.timeMs).map(t => {
            const bucket = analytics.history.find(b => b.startMs === t)
            return `${x(Math.max(start, t))},${y(bucket?.produced[item] ?? 0)}`
          }).join(' ')
          return <g key={item}><title>{ITEM_DEFINITIONS[item].label}</title><polyline fill="none" stroke={COLORS[i]} strokeWidth="2" points={points} />{points.split(' ').filter(Boolean).map((point, n) => { const [cx, cy] = point.split(','); return <circle key={n} cx={cx} cy={cy} r="2.5" fill={COLORS[i]} /> })}</g>
        })}
      </svg>
      <div className="analytics-legend">{selected.map((item, i) => <span key={item} style={{ color: COLORS[i] }}>{ITEM_DEFINITIONS[item].label}</span>)}</div>
      <h2>Bottlenecks</h2>
      <p className="inspection-note">One cause after 10 continuous seconds. Click to locate and inspect.</p>
      {!analytics.problems.length && <p className="inspection-note">No active bottlenecks.</p>}
      <ol className="bottlenecks">{analytics.problems.map(problem => <li key={problem.index}><button className="building" onClick={() => focusBuilding(problem.index)}><span><strong>{problem.cause}</strong><small>{problem.kind} · {problem.index % SIZE}, {Math.floor(problem.index / SIZE)}</small></span><span className="key">{(problem.durationMs / 1000).toFixed(1)} s</span></button></li>)}</ol>
    </div>}
  </aside>
}
