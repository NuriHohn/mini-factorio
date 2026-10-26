import { useGameStore } from '../state/gameStore'
import { TOOL_HINTS } from '../state/toolHints'
import type { KeyboardEvent } from 'react'
import { useState } from 'react'
import { CONTROL_ROWS } from '../state/uiMetadata'
import { LittleGoals } from './LearningAids'
export function HelpContents() {
  const mode = useGameStore(state => state.playMode)
  const [section, setSection] = useState<'play' | 'controls' | 'goals'>('play')
  const helpKey = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const sections = ['play', 'controls', 'goals'] as const
    const next = event.key === 'Home' ? 'play' : event.key === 'End' ? 'goals' : sections[(sections.indexOf(section) + (event.key === 'ArrowLeft' ? 2 : 1)) % sections.length]
    setSection(next)
    document.getElementById(`help-${next}-tab`)?.focus()
  }
  if (mode === 'petesWorld') return <section aria-label="Petes Welt spielen"><h3>Du gibst Ressourcen, Pete baut seine Welt</h3><ol><li>Wähle Waldgruppe und platziere sie zwischen den Markierungen, 4–10 Felder vom Baumhaus.</li><li>Oder platziere Eisenvorkommen: Pete sammelt Erz ab Stufe 1, baut sein Lager auch aus Erz und kann ab Handwerker-Stufe 2 einen echten Schmelzofen bauen. Eisenplatten finanzieren seine Werkstatt. Ab Handwerker-Stufe 3 kann ein Erzförderer mit kurzem Förderband zum Ofen folgen.</li><li>Kupfervorkommen entwickeln den Erfinderpfad. Pete sammelt zunächst selbst Erz, baut ab Stufe 2 einen Kupferofen und ab Stufe 3 einen Kabel-Assembler. Danach baut er einen Kupferförderer und den Schaltkreis-Assembler: echte Eisenplatten und Kupferkabel versorgen seine Flugwerkstatt ab Stufe 4. Übungsflüge führen zu sicheren Rundflügen ab Stufe 5.</li><li>Kohlevorkommen starten den Industriepfad unabhängig: Pete sammelt Kohle, baut dasselbe Materiallager und ab Industrie-Stufe 2 einen Dampfantrieb mit geschlossenem Wasserkreislauf. Er trägt selbst Brennstoff hin; eine Kohle treibt zehn Sekunden lang das Schwungrad und bis zu 50 kW Strom über einen Mast an. Ab Industrie 3 folgen Kohleförderer, Brennstofflager und Kesselgreifer. Ein Stampfer verdichtet zwei Kohle zu einem Brikett mit gleichem Brennwert. Ab Industrie 4 arbeitet die Dampfwerkstatt, ab 5 folgt nach zehn Werkstattzyklen ein Förderaufzug. Beide brauchen echte Dampfenergie.</li><li>Mehr Ressourcen einer Kategorie in der Nähe und im Lager erhöhen die Chance entsprechender Projekte. Bezahlbare Projekte sind besonders interessant; Tierpflege und Pausen bleiben wichtig.</li><li>Am Handy: Ziel antippen und dieselbe Stelle noch einmal antippen.</li><li>Pete hackt auf Stufe 1 selbst Holz und baut ein allgemeines Materiallager. Daraus entstehen Zaun, Hühnerstall und weitere Projekte.</li><li>Klicke eine Maschine oder Pete an: Du siehst, was gerade passiert. Ab Öko-Stufe 3 baut Pete ein Sägewerk, trägt Holz dorthin und erweitert sein Lager mit Holzplatten.</li><li>Ab Öko-Stufe 2 kann Pete nachpflanzen. Neue Bäume brauchen fünf Spielminuten.</li><li>Holzplatten verbessern Stall und Garten. Ab Öko-Stufe 4 folgen Forststation, kurze Bänder und der gemeinsame Assembler. Holzkisten finanzieren Lagerregale und Pflanzkästen; volle Vorräte bremsen die Produktion.</li></ol><p>Du kannst die Kamera bewegen und zoomen. Speichere vor einem Wechsel im Menü. Petes Welt und Factory haben eigene Speicherplätze.</p></section>
  return <>
    <div className="help-tabs" role="tablist" aria-label="Help sections">
      <button className="save-action" role="tab" aria-selected={section === 'play'} tabIndex={section === 'play' ? 0 : -1} onKeyDown={helpKey} id="help-play-tab" aria-controls="help-play" onClick={() => setSection('play')}>How to Play</button>
      <button className="save-action" role="tab" aria-selected={section === 'controls'} tabIndex={section === 'controls' ? 0 : -1} onKeyDown={helpKey} id="help-controls-tab" aria-controls="help-controls" onClick={() => setSection('controls')}>Controls</button>
      <button className="save-action" role="tab" aria-selected={section === 'goals'} tabIndex={section === 'goals' ? 0 : -1} onKeyDown={helpKey} id="help-goals-tab" aria-controls="help-goals" onClick={() => setSection('goals')}>Little goals</button>
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
    </div> : section === 'goals' ? <div id="help-goals" role="tabpanel" aria-labelledby="help-goals-tab"><LittleGoals /></div> : <div id="help-controls" role="tabpanel" aria-labelledby="help-controls-tab">
      <p className="inspection-note">Click a group below the world, then choose a tool. Click the active tool again to put it away. Right-click cancels a drag first, then puts away the selected tool.</p>
      <p>Touch: drag to pan, pinch to zoom, tap to inspect. With a tool selected, tap a target (two endpoints for routes), then tap the same target again to build. Rotate/cancel actions appear beside the target. Tools hides the toolbar on small screens. Petes Welt: Ressource entfernen clears one resource tile without yield; Remove building discards its contents. Pete can pay to repair his missing components without repeated completion rewards. Touch confirms the same target. Start water play with Mit Wasser spritzen in a sprinkler’s inspector. The selected sprinkler needs full power and a target within 3 tiles. Manual sprays have a separate one-second cooldown. Right-drag pans; a short right-click cancels. With no tool selected, click a tree to chop it; in Petes Welt on touch tap a tree and tap it again to confirm; Factory retains Axe. Petes Welt also has Create Water and Restore Land with the shared brush sizes; new worlds include natural waterways outside the dry home clearing.</p>
      <dl className="controls-list">{CONTROL_ROWS.map(row => <div key={row.keys}><dt><kbd>{row.keys}</kbd></dt><dd>{row.action}</dd></div>)}</dl>
      <p className="inspection-note">Close an open menu with its button, Close or Escape. The world keeps running while menus are open; game shortcuts wait until you close them.</p>
    </div>}
  </>
}
