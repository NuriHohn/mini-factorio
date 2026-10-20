import { ITEM_DEFINITIONS } from '../simulation/items'
import type { Inspection } from '../simulation/inspection'
export function SplitterInspector({ inspection: s }: { inspection: Extract<Inspection, { kind: 'splitter' }> }) {
  return <>
    <h2>Compact splitter · 1×1</h2>
    <div className="stats"><span>Rear input</span><b>{s.inputDirection} · {s.input ? ITEM_DEFINITIONS[s.input.item].label : 'Empty'}</b></div>
    <div className="stats"><span>Next output preference</span><b>{s.nextOutput === 0 ? 'Front' : 'Left'} · {s.outputDirections[s.nextOutput]}</b></div>
    {([0, 1] as const).map(output => <div key={output}>
      <div className="stats"><span>{output === 0 ? 'Front output' : 'Left output'}</span><b>{s.outputDirections[output]} · {s.blocked[output] ? 'Blocked' : 'Available'}</b></div>
      <div className="stats"><span>Outgoing item</span><b>{s.outputs[output] ? `${ITEM_DEFINITIONS[s.outputs[output].item].label} · ${Math.round(s.outputs[output].progress * 100)}%` : 'Empty'}</b></div>
      <div className="stats"><span>Items delivered</span><b>{s.delivered[output]}</b></div>
    </div>)}
    <div className="stats"><span>Buffered items</span><b>{Number(s.input !== null) + s.outputs.filter(Boolean).length} / 3</b></div>
    <div className="stats"><span>Average throughput</span><b>{s.itemsPerSec.toFixed(2)} items/s</b></div>
    <p className="inspection-note">One rear intake and two outgoing slots. Each item travels 250 ms into the center and 250 ms to its chosen output. Blocked outputs retain their items; the other route can continue. No electricity needed. Throughput is averaged since placement.</p>
  </>
}
