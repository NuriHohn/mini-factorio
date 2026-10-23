import { useGameStore } from '../state/gameStore'
export function RevengeHUD() {
  const { peaceful, gifts, peteConstructionHint, revenge: r, simulationTime } = useGameStore()
  if (peaceful) return <span className="revenge-progress peace-status" role="status" title={`Revenge progress kept: ${r.arrests}/${r.threshold}. Escape, then click a gift to collect.`}>♥ Pete is peaceful {gifts > 0 && `· 🎁 ${gifts} nearby`}{peteConstructionHint && ` · ${peteConstructionHint}`}</span>
  if (r.stage === 'idle') return <span className="revenge-progress">Pete’s Revenge: {r.arrests} / {r.threshold} arrests</span>
  return <section className="revenge-hud" aria-label="Pete's Revenge">
    <strong>Pete’s Revenge · Revenge-O-Matic 3000</strong>
    {r.boss && <><progress aria-label="Boss health" value={r.boss.hp} max={100} /><span>{r.boss.hp} / 100 HP · {r.boss.phase === 1 ? 'Phase 1 · Revenge' : 'Phase 2 · Furious Pete'}</span></>}
    <p role="status">{r.stage === 'warning' && simulationTime >= r.untilMs ? 'WARNING · Waiting for a clear map edge.' : r.stage === 'warning' ? `WARNING · Walker arriving in ${Math.max(0, (r.untilMs - simulationTime) / 1000).toFixed(1)} s · clear the factory!` : r.stage === 'stomp' ? 'STOMP! Raised foot · get ready!' : r.stage === 'defeating' ? 'SYSTEM ERROR · Pete is about to eject!' : r.stage === 'stunned' ? `Pete ejected · stunned for ${Math.max(0, (r.untilMs - simulationTime) / 1000).toFixed(1)} s` : 'Choose a combat tool in Special to defend your factory.'}</p>
  </section>
}
