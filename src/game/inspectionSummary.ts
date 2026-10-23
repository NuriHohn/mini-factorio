import { GATE_OPEN_MS } from '../simulation/gardenGate'
import type { Inspection } from '../simulation/inspection'
import { ITEM_DEFINITIONS, ITEMS } from '../simulation/items'
import { PLAYER_TOOLS } from '../state/toolMetadata'
const descriptions: Record<Inspection['kind'], string> = {
  peteExperiment: 'Pete’s copper-and-gear experiment table. Completed experiments earn Inventor XP; no production or power needed.',
  peteWorkshop: 'Pete’s wooden-and-metal workshop. Decorative hammering earns Craftsman XP; no production.',
  peteGarden: 'Pete’s vegetable garden. Decorative plants, tended while peaceful; no crops or inventory.',
  peteGate: 'Pete’s wooden garden gate. Opens automatically for Pete; chickens stay in the yard.',
  peteCampfire: 'Pete’s cozy campfire. He cooks collected eggs here while peaceful; no factory production.',
  peteCoop: 'Pete’s cozy wooden chicken coop. A home for peaceful chickens and chicks. Eggs stay outside factory inventories.',
  peteFence: 'Pete built this wooden fence as his first secret project.',
  supplyCrate: 'Receives materials for Pete. Belts and inserters can deliver; Pete may collect supplied Wood for his secret project.',
  footbridge: 'A wooden crossing for Pete and police. No items or electricity. Remove only when clear.',
  fishingDock: 'A quiet place for peaceful Pete to fish. No items are produced.',
  waterwheel: 'Makes electricity from adjacent water. Connect it to a pole.',
  miner: 'Takes ore from the ground.', belt: 'Carries items in the arrow’s direction.', storage: 'Keeps items until they are needed.',
  furnace: 'Turns ore into metal plates.', assembler: 'Makes parts from ingredients.', inserter: 'Moves one item between neighbors.',
  splitter: 'Shares items between two paths.', generator: 'Makes electricity. Connect it to a pole.', powerPole: 'Connects power and supplies nearby machines.',
  radar: 'Calls the police when mischievous Pete comes near.', sprinkler: 'Gives mischievous Pete a splash.', prison: 'Holds Pete until release or escape.',
  tree: 'Grows over time. Chop it for Wood.', treehouse: 'A home that keeps Pete peaceful.',
}
export function inspectionSummary(i: Inspection) {
  const metadata = PLAYER_TOOLS.find(t => t.tool === i.kind)
  const name = i.kind === 'peteExperiment' ? 'Pete’s Experiment Table' : i.kind === 'peteWorkshop' ? 'Pete’s Workshop' : i.kind === 'peteGarden' ? 'Pete’s Vegetable Garden' : i.kind === 'peteGate' ? 'Pete’s Garden Gate' : i.kind === 'peteCampfire' ? 'Pete’s Campfire' : i.kind === 'peteCoop' ? 'Pete’s Chicken Coop' : i.kind === 'peteFence' ? 'Pete’s wooden fence' : i.kind === 'belt' && i.bridge ? 'Conveyor bridge' : metadata?.label ?? (i.kind === 'tree' ? `${i.species[0].toUpperCase()}${i.species.slice(1)} tree` : 'Pete’s prison')
  let state = 'Ready.'
  if ('electrical' in i && i.electrical.state === 'sabotaged') state = 'Temporarily disabled.'
  else if (i.kind === 'peteExperiment') state = i.experimenting ? 'Pete is testing a little invention.' : 'Ready for peaceful experiments.'
  else if (i.kind === 'peteWorkshop') state = i.hammering ? 'Pete is working at the anvil.' : 'Ready for peaceful workshop visits.'
  else if (i.kind === 'peteGate') state = i.openMs === 0 ? 'Closed · Pete opens it when approaching.' : i.openMs === GATE_OPEN_MS ? 'Open · keeping the passage clear.' : 'Gate is swinging.'
  else if (i.kind === 'peteCampfire') state = i.cooking ? 'Pete is frying an egg.' : 'Fire is warm · waiting for Pete.'
  else if (i.kind === 'peteCoop') state = `${i.collected} eggs collected · ${i.eggs} waiting.${i.eaten ? ` ${i.collected - i.eaten} available · ${i.eaten} eaten.` : ''}`
  else if (i.kind === 'supplyCrate') state = `${ITEMS.reduce((n, item) => n + i.inventory[item], i.wood)} / ${i.capacity} items${i.inspecting ? ' · Pete is inspecting.' : '.'}`
  else if (i.kind === 'fishingDock') state = !i.waterAvailable ? 'Needs water on the fishing side.' : !i.accessible ? 'Keep the land approach behind the dock clear.' : i.fishing ? 'Pete is fishing.' : 'Ready for peaceful Pete.'
  else if (i.kind === 'waterwheel' && !i.waterAvailable) state = 'Needs water on the facing side.'
  else if (i.kind === 'assembler' && !i.recipeId) state = 'Choose a recipe first.'
  else if ('electrical' in i && ['disconnected', 'no-generation'].includes(i.electrical.state) && i.kind !== 'generator' && i.kind !== 'waterwheel' && i.kind !== 'powerPole') state = 'Needs electricity.'
  else if (i.kind === 'miner') state = i.buffered ? 'Output is full.' : i.resource ? 'Working normally.' : 'Needs an ore patch.'
  else if (i.kind === 'furnace' || i.kind === 'assembler') {
    if (i.status === 'output-full') state = 'Output is full.'
    else if (i.status === 'processing') state = i.electrical.speedFraction > 0 ? 'Working normally.' : 'Needs electricity.'
    else {
      const missing = ITEMS.find(item => (i.requirements[item] ?? 0) > i.input[item])
      state = missing ? `Waiting for ${ITEM_DEFINITIONS[missing].label.toLowerCase()}.` : i.kind === 'furnace' && !i.recipeId ? 'Waiting for ore.' : 'Waiting for ingredients.'
    }
  } else if (i.kind === 'belt') state = !i.item ? 'Waiting for items.' : i.progress >= 1 ? 'Waiting for space ahead.' : 'Moving items.'
  else if (i.kind === 'inserter') state = i.status === 'output-blocked' ? 'Output is full.' : i.status === 'waiting-input' ? 'Waiting for items.' : 'Moving items.'
  else if (i.kind === 'splitter') state = i.blocked.every(Boolean) ? 'Outputs are blocked.' : 'Sharing items when they arrive.'
  else if (i.kind === 'sprinkler') state = i.status === 'Unpowered' ? 'Needs electricity.' : `${i.status}.`
  else if (i.kind === 'radar') state = i.operation === 'Pete is peaceful' ? 'Pete is peaceful.' : i.active ? 'Watching for Pete.' : 'Needs full power.'
  else if (i.kind === 'treehouse') state = 'Pete is peaceful.'
  else if (i.kind === 'tree') state = `${i.stage} · ${i.wood} Wood when chopped.`
  else if (i.kind === 'prison') state = i.occupied ? 'Pete is here.' : 'Empty.'
  else if (i.kind === 'generator' || i.kind === 'waterwheel' || i.kind === 'powerPole') state = i.electrical.networkId === null ? 'Needs a power connection.' : 'Connected.'
  const power = 'electrical' in i ? i.electrical.state === 'sabotaged' ? 'Temporarily disabled' : i.electrical.state === 'disconnected' ? 'No connection' : i.electrical.state === 'no-generation' ? 'No electricity' : i.electrical.state === 'reduced' ? 'Reduced power' : 'Connected' : null
  return { power, name, icon: metadata?.icon ?? (i.kind === 'tree' ? '♣' : '▥'), description: descriptions[i.kind], state }
}
