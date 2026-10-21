import { TOOL_HINTS } from '../state/toolHints'
import type { KeyboardEvent } from 'react'
import { useState } from 'react'
import { CONTROL_ROWS } from '../state/uiMetadata'
export function HelpContents() {
  const [section, setSection] = useState<'play' | 'controls'>('play')
  const helpKey = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'play' : event.key === 'End' ? 'controls' : section === 'play' ? 'controls' : 'play'
    setSection(next)
    document.getElementById(`help-${next}-tab`)?.focus()
  }
  return <>
    <div className="help-tabs" role="tablist" aria-label="Help sections">
      <button className="save-action" role="tab" aria-selected={section === 'play'} tabIndex={section === 'play' ? 0 : -1} onKeyDown={helpKey} id="help-play-tab" aria-controls="help-play" onClick={() => setSection('play')}>How to Play</button>
      <button className="save-action" role="tab" aria-selected={section === 'controls'} tabIndex={section === 'controls' ? 0 : -1} onKeyDown={helpKey} id="help-controls-tab" aria-controls="help-controls" onClick={() => setSection('controls')}>Controls</button>
    </div>
    {section === 'play' ? <div id="help-play" role="tabpanel" aria-labelledby="help-play-tab" className="how-to-play">
      <p>Build a little factory, one machine at a time.</p>
      <h3>ϟ Start with power</h3><p>Place a generator and a nearby power pole. Keep machines within 3 tiles of a pole. Poles connect within 6 tiles.</p>
      <h3>⚙ Make something</h3><p>Put a miner on ore. Add belts to carry ore to a furnace, then into a chest. Furnaces turn ore into plates. Assemblers make parts: pick a recipe in their inspector first.</p>
      <h3>➜ Keep things moving</h3><p>Rotate tools to point their output the right way. Inserters move items between neighbors. If items cannot leave, machines wait.</p>
      <h3>✦ Discover new tools</h3><p>Working machines earn research points. Open Research and choose an unlock when you have enough points.</p>
      <h3>♣ Enjoy nature</h3><p>Plant trees and paint flowers. Trees grow while you play. Chop young or mature trees with the Axe for Wood. A treehouse costs 20 Wood. Create Water and Restore Land share the 1×1, 3×3 and 5×5 brushes. Red tiles are protected; existing bridges and their dry banks stay safe.</p>
      <h3>♥ Meet Pete</h3><p>Pete plays pranks and briefly stops machines. Radar traps call the police. Repeated arrests bring his Revenge walker. Choose a combat tool to defend your factory, or build Pete a home for peace and little gifts.</p>
      <h3>Building tips</h3><ul className="help-tool-hints">{Object.values(TOOL_HINTS).map(hint => <li key={hint}>{hint}</li>)}</ul>
      <h3>☰ Keep your factory</h3><p>Open Menu to save or load. Autosave keeps a separate copy every two minutes of play. Export a file for a backup. Loading is always your choice.</p>
    </div> : <div id="help-controls" role="tabpanel" aria-labelledby="help-controls-tab">
      <p className="inspection-note">Click a group below the world, then choose a tool. Click the active tool again to put it away. Right-click cancels a drag first, then puts away the selected tool.</p>
      <dl className="controls-list">{CONTROL_ROWS.map(row => <div key={row.keys}><dt><kbd>{row.keys}</kbd></dt><dd>{row.action}</dd></div>)}</dl>
      <p className="inspection-note">Close an open menu with its button, Close or Escape. The world keeps running while menus are open; game shortcuts wait until you close them.</p>
    </div>}
  </>
}
