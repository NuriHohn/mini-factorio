import { RightPan } from './rightPan'
import { drawGuidance } from './guidanceVisuals'
import { drawAnnexWalkway, drawDevelopment, drawDevelopmentActivity } from './developmentVisuals'
import { createPetesWorld, groveError, ironError, copperError, miniLayout, placeGrove, placeIron, placeCopper } from '../simulation/petesWorld'
import { TouchGestures } from './touchGestures'
import { commitConstruction } from '../simulation/construction'
import { drawInventorStructure, drawLeisure, drawPlayfulSpray } from './leisureVisuals'
import { flightPose } from '../simulation/peteLeisure'
import { playfulSpray } from '../simulation/playfulSpray'
import { simulationDelta, useSimulationSpeed } from '../state/simulationSpeed'
import { drawGearPress } from './gearPressVisuals'
import { drawExperimentTable } from './experimentVisuals'
import { drawWorkshop } from './workshopVisuals'
import { drawVegetableGarden } from './ecoVisuals'
import { drawGardenGate } from './gardenGateVisuals'
import { drawYardCorner, drawYardEntrance, yardCorner } from './yardVisuals'
import { drawCampfire, drawCampfireEffects } from './campfireVisuals'
import { drawPoultry } from './poultryVisuals'
import { drawChickenCoop } from './chickenCoopVisuals'
import { CrateSupplyAction } from './crateSupplyAction'
import { drawPeteFence } from './secretProjectVisuals'
import { drawSupplyCrate } from './supplyCrateVisuals'
import { ShoreVegetation } from './shoreVegetation'
import { drawFootbridge } from './footbridgeVisuals'
import { drawFishingDock } from './fishingDockVisuals'
import { waterwheelRunning } from '../simulation/waterwheel'
import { drawWaterwheel } from './waterwheelVisuals'
import { TerrainVisuals } from './terrainVisuals'
import { waterEditError, waterProtection } from '../simulation/waterLandscaping'
import { cameraViewport, visibleTileBounds, intersects } from './viewport'
import { useGraphicsSettings } from '../state/graphicsSettings'
import { LandscapeWater } from './landscapeWater'
import { PlacementRotation, rotationBuilding } from './placementRotation'
import { ConstructionDrag } from './constructionDrag'
import { placementInfo, planConstruction } from '../simulation/construction'
import type { ConstructionPlan } from '../simulation/construction'
import { toolMetadata } from '../state/toolMetadata'
import { peteCaption } from './peteCaption'
import { worldInputBlocked } from '../state/uiMetadata'
import { collectGift, peaceful } from '../simulation/peace'
import { drawPeace, drawTreehouse } from './peaceVisuals'
import { NatureVisuals, drawTree } from './natureVisuals'
import { LandscapeStroke, landscapeTile } from './landscapeStroke'
import { brushTiles, chopTree, MATURE_TREE_MS, plantTree, REPRODUCTION_MS } from '../simulation/nature'
import { brushMode, natureTool, plantingSpecies } from '../state/natureTools'
import { arrestVisual } from './arrestVisuals'
import { attackWalker, combatPosition, combatTool, peteUnavailable } from '../simulation/revenge'
import { RevengeVisuals } from './RevengeVisuals'
import { hasTechnology } from '../simulation/research'
import { WebVisuals } from './webVisuals'
import { peteHit, sabotageRemaining } from '../simulation/pete'
import { WaterVisuals, drawSprinkler } from './sprinklerVisuals'
import { sprinklerPowered, SPRINKLER_RANGE } from '../simulation/sprinklers'
import { SaveSession, errorMessage } from '../persistence/storage'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { LoadedGame, ViewState } from '../persistence/saveGame'
import { downloadSave } from '../persistence/download'
import { splitterPorts, splitterDirections, SPLITTER_STAGE_MS } from '../simulation/splitters'
import { splitterBlocked } from '../simulation/transport'
import { splitterInputPoint, splitterOutputPoint } from './splitterPath'
import { RADAR_RANGE } from '../simulation/police'
import { drawSecurityBuilding, drawPoliceEffects } from './policeVisuals'
import { drawPete, drawSabotage } from './peteVisuals'
import Phaser from 'phaser'
import { buildingAt, createWorld, inside, INTERVAL, offsets, opposite, placementError, placeBuilding, removalError, removeBuilding, rotate, SIZE } from '../simulation/world'
import { beltInputs } from '../simulation/beltConnections'
import { BELT_TRAVEL_MS } from '../simulation/transport'
import { inserterPorts } from '../simulation/inserters'
import { inserterArmPoint } from './inserterArm'
import { beltPathPoint } from './beltPath'
import { changeFurnaceRecipe, furnaceStatus } from '../simulation/smelting'
import { changeCraftingRecipe, craftingStatus } from '../simulation/crafting'
import { RECIPES } from '../simulation/recipes'
import { ITEM_DEFINITIONS, ITEMS } from '../simulation/items'
import { allocatePower, polePlacementPreview, POLE_COVERAGE_RADIUS, powerRequirement, tilePosition, withinRange } from '../simulation/power'
import type { PolePlacementPreview } from '../simulation/power'
import { electricalDetails } from '../simulation/inspection'
import { advanceWorld } from '../simulation/step'
import type { Item } from '../simulation/items'
import type { World, Direction } from '../simulation/world'
import { useGameStore } from '../state/gameStore'
import { moveCamera, updateCameraBounds } from './cameraMovement'
const TILE = 32
export class FactoryScene extends Phaser.Scene {
  private rightPan = new RightPan()
  private natureVisuals = new NatureVisuals()
  private landscapeWater = new LandscapeWater()
  private crateSupply = new CrateSupplyAction()
  private shoreVegetation = new ShoreVegetation()
  private waterSurface!: Phaser.GameObjects.Graphics
  private constructionDrag = new ConstructionDrag()
  private placementRotation = new PlacementRotation()
  private constructionLabel!: Phaser.GameObjects.Text
  private handledContextMenu = false
  private landscapeUsed = false
  private landscapeStroke = new LandscapeStroke()
  private landscape!: Phaser.GameObjects.Graphics
  private revengeVisuals = new RevengeVisuals()
  private world = createWorld()
  private terrain!: TerrainVisuals
  private summaryWorld: World | null = null
  private summaryAt = -Infinity
  private summaryRevision = -1
  drawnBuildings = 0
  tickCostMs = 0
  private saves!: SaveSession
  private skipNextDelta = false
  private keys!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
  private wires!: Phaser.GameObjects.Graphics
  private coverage!: Phaser.GameObjects.Graphics
  private machines!: Phaser.GameObjects.Graphics
  private items!: Phaser.GameObjects.Graphics
  private poleLinks!: Phaser.GameObjects.Graphics
  private polePreviewKey = ''
  private poleCandidate: PolePlacementPreview | null = null
  private peteEffects!: Phaser.GameObjects.Graphics
  private peteLabel!: Phaser.GameObjects.Text
  private webVisuals = new WebVisuals()
  private waterVisuals = new WaterVisuals()
  private preview!: Phaser.GameObjects.Graphics
  create() {
    useGameStore.setState({ spraySource: null, peteInspection: null, inspected: null, inspection: null, recipeRequest: null, releaseRequest: null, supplyRequest: null, connectionVisible: false, focusRequest: null, dragActive: false, uiPanel: null, researchOpen: false, researchRequest: null, researchFeedback: '', saveRequest: null, saveBusy: false })
    useGameStore.getState().publish(this.world)
    this.saves = new SaveSession({ getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) })
    useGameStore.setState({ saveStatus: this.saves.initialize() })
    this.terrain = this.createTerrain(this.world)
    this.waterSurface = this.add.graphics().setDepth(-.75)
    this.landscape = this.add.graphics().setDepth(-.5)
    this.wires = this.add.graphics()
    this.coverage = this.add.graphics()
    this.machines = this.add.graphics()
    this.items = this.add.graphics()
    this.poleLinks = this.add.graphics()
    this.polePreviewKey = ''
    this.poleCandidate = null
    this.peteEffects = this.add.graphics().setDepth(5)
    this.peteLabel = this.add.text(0, 0, 'Pete', { fontFamily: 'monospace', fontSize: '9px', color: '#f8cf86', backgroundColor: '#17221cbb', padding: { x: 3, y: 2 } }).setOrigin(.5, 1).setDepth(6)
    this.preview = this.add.graphics()
    this.constructionLabel = this.add.text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '12px', color: '#edf1dd', backgroundColor: '#19241cf2', padding: { x: 9, y: 7 } }).setDepth(20).setVisible(false)
    this.cameras.main.setZoom(1.3)
    updateCameraBounds(this.cameras.main, SIZE * TILE)
    this.cameras.main.centerOn(SIZE * TILE / 2, SIZE * TILE / 2)
    this.keys = this.input.keyboard!.addKeys('W,A,S,D', true) as typeof this.keys
    const keyboard = this.input.keyboard!
    const stopStrokeOnToolChange = useGameStore.subscribe((state, previous) => {
      if (state.tool !== previous.tool || state.dragCancelToken !== previous.dragCancelToken || worldInputBlocked(state)) this.cancelConstruction()
      else if (state.direction !== previous.direction) {
        if (this.placementRotation.active) this.placementRotation.setDirection(state.direction)
        else if (!state.touchPlacement) this.cancelConstruction()
      }
      if (state.tool !== previous.tool || worldInputBlocked(state)) this.rightPan.cancel()
      if (state.spraySource !== null && worldInputBlocked(state)) useGameStore.getState().select(null)
      if (state.tool !== previous.tool || state.brushSize !== previous.brushSize || worldInputBlocked(state)) this.landscapeStroke.end()
    })
    const destroyTerrain = () => this.terrain.destroy()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, destroyTerrain)
    this.events.once(Phaser.Scenes.Events.DESTROY, destroyTerrain)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopStrokeOnToolChange)
    this.events.once(Phaser.Scenes.Events.DESTROY, stopStrokeOnToolChange)
    // DOM delivery keeps Escape available even when a form control has focus.
    const toolKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape' && event.repeat) return
      const target = event.target
      const editing = target instanceof HTMLElement && (target.matches('input, select, textarea') || target.isContentEditable)
      if (worldInputBlocked(useGameStore.getState()) && event.code === 'Escape') event.preventDefault()
      useGameStore.getState().handleToolKey({ code: event.code, repeat: event.repeat, editing })
    }
    window.addEventListener('keydown', toolKeyDown)
    const touch = new TouchGestures(point => this.touchTap(point), (dx, dy) => {
      if (worldInputBlocked(useGameStore.getState())) return
      this.cameras.main.scrollX -= dx / this.cameras.main.zoom; this.cameras.main.scrollY -= dy / this.cameras.main.zoom
    }, ratio => { if (!worldInputBlocked(useGameStore.getState())) this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * ratio, .5, 2.5)) })
    const touchPoint = (event: PointerEvent) => {
      const rect = this.game.canvas.getBoundingClientRect()
      return { x: (event.clientX - rect.left) * this.cameras.main.width / rect.width, y: (event.clientY - rect.top) * this.cameras.main.height / rect.height }
    }
    const onTouchDown = (event: PointerEvent) => { if (event.pointerType !== 'touch') return; event.preventDefault(); useGameStore.setState({ touchActive: true }); this.game.canvas.setPointerCapture(event.pointerId); touch.down(event.pointerId, touchPoint(event)) }
    const onTouchMove = (event: PointerEvent) => { if (event.pointerType === 'touch') { event.preventDefault(); touch.move(event.pointerId, touchPoint(event)) } }
    const onTouchUp = (event: PointerEvent) => { if (event.pointerType === 'touch') { event.preventDefault(); touch.up(event.pointerId, touchPoint(event)) } }
    const onTouchCancel = () => touch.cancel()
    this.game.canvas.style.touchAction = 'none'
    this.game.canvas.addEventListener('pointerdown', onTouchDown)
    this.game.canvas.addEventListener('pointermove', onTouchMove)
    this.game.canvas.addEventListener('pointerup', onTouchUp)
    this.game.canvas.addEventListener('pointercancel', losePointer)
    function losePointer() { onTouchCancel(); loseFocus() }
    const loseFocus = () => { this.rightPan.cancel(); touch.cancel(); this.cancelConstruction(); this.landscapeStroke.end() }
    const visibility = () => { if (document.hidden) loseFocus() }
    const contextMenu = (event: MouseEvent) => {
      if (this.handledContextMenu || useGameStore.getState().tool !== null) event.preventDefault()
      this.handledContextMenu = false
    }
    window.addEventListener('blur', loseFocus)
    document.addEventListener('visibilitychange', visibility)
    this.game.canvas.addEventListener('contextmenu', contextMenu)
    const cleanupGestures = () => {
      loseFocus()
      this.game.canvas.removeEventListener('pointerdown', onTouchDown)
      this.game.canvas.removeEventListener('pointermove', onTouchMove)
      this.game.canvas.removeEventListener('pointerup', onTouchUp)
      this.game.canvas.removeEventListener('pointercancel', losePointer)
      window.removeEventListener('blur', loseFocus)
      document.removeEventListener('visibilitychange', visibility)
      this.game.canvas.removeEventListener('contextmenu', contextMenu)
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupGestures)
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanupGestures)
    const removeToolKeyListener = () => window.removeEventListener('keydown', toolKeyDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.revengeVisuals.destroy())
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, removeToolKeyListener)
    this.events.once(Phaser.Scenes.Events.DESTROY, removeToolKeyListener)
    keyboard.on('keydown-P', () => { if (!worldInputBlocked(useGameStore.getState())) useGameStore.getState().togglePowerOverlay() })
    keyboard.on('keydown-R', () => {
      if (worldInputBlocked(useGameStore.getState())) return
      const pending = this.placementRotation.preview()
      if (pending) {
        const direction = rotate(pending.direction)
        this.placementRotation.setDirection(direction)
        useGameStore.setState({ direction })
      } else useGameStore.getState().rotate()
    })
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      if (worldInputBlocked(useGameStore.getState())) return
      this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * (dy > 0 ? .9 : 1.1), .5, 2.5))
    })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch || pointer.event.target !== this.game.canvas || worldInputBlocked(useGameStore.getState())) return
      if (pointer.rightButtonDown()) {
        this.handledContextMenu = true
        if (this.constructionDrag.active || this.placementRotation.active || this.landscapeStroke.isActive) { this.cancelConstruction(); this.landscapeStroke.end() }
        else this.rightPan.begin(this.rotationScreen(pointer))
        return
      }
      if (this.rightPan.active) return
      if (!pointer.leftButtonDown()) return
      const selected = useGameStore.getState().tool
      if (selected === 'playfulSpray') {
        this.sprayAt(combatPosition(pointer, this.cameras.main, TILE))
        return
      }
      if (selected === null) {
        const point = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2
        const index = this.crateSupply.hit(this.world, point, TILE, this.cameras.main.zoom)
        if (index !== null) {
          const supplied = this.crateSupply.activate(this.world, index)
          useGameStore.setState({ message: supplied ? '6 Wood unloaded into Pete’s crate.' : 'Needs 6 Wood and six free crate slots.' })
          return
        }
      }
      if (selected === 'footbridge' || selected === 'belt' || selected === 'powerPole') {
        const point = landscapeTile(pointer, this.cameras.main, TILE)
        const error = this.constructionDrag.begin(this.world, point, selected, useGameStore.getState().direction)
        useGameStore.setState(error ? { message: error } : { dragActive: true })
        return
      }
      if (rotationBuilding(selected)) {
        this.placementRotation.begin(this.world, landscapeTile(pointer, this.cameras.main, TILE), this.rotationScreen(pointer), selected, useGameStore.getState().direction)
        useGameStore.setState({ dragActive: true })
        return
      }
      if (natureTool(selected)) {
        const point = landscapeTile(pointer, this.cameras.main, TILE), mode = brushMode(selected)
        if (mode !== undefined) {
          this.landscapeUsed = false
          if (this.landscapeStroke.begin(this.world, point, mode, useGameStore.getState().brushSize) > 0) { useGameStore.getState().recordToolUse(selected); this.landscapeUsed = true }
          return
        }
        if (selected === 'placeIron') { useGameStore.setState({ message: placeIron(this.world, point.x, point.y) ?? 'Eisen platziert. Pete sammelt und verarbeitet das Erz.' }); return }
        if (selected === 'placeCopper') { useGameStore.setState({ message: placeCopper(this.world, point.x, point.y) ?? 'Kupfer platziert. Pete sammelt und verarbeitet das Erz.' }); return }
        if (selected === 'placeGrove') { useGameStore.setState({ message: placeGrove(this.world, point.x, point.y) ?? 'Wald platziert. Pete kümmert sich um Holz und seine Projekte.' }); return }
        const species = plantingSpecies(selected)
        if (species) {
          const error = placementError(this.world, point.x, point.y, 'tree')
          if (error) { useGameStore.setState({ message: error }); return }
          if (plantTree(this.world, point.x, point.y, species)) { useGameStore.getState().recordToolUse(selected); useGameStore.setState({ message: `${species[0].toUpperCase() + species.slice(1)} sapling planted · grows with simulation time.` }) }
        } else {
          const result = chopTree(this.world, point.x, point.y)
          if (result) useGameStore.getState().recordToolUse(selected)
          if (result) this.natureVisuals.fell(this.world, result.tree)
          useGameStore.setState({ message: result ? `Tree chopped · +${result.wood} Wood (global stock). Ore and decoration preserved.` : 'Choose a tree to chop with the Axe.' })
        }
        return
      }
      if (combatTool(selected)) {
        const position = combatPosition(pointer, this.cameras.main, TILE)
        const impact = attackWalker(this.world, selected, position)
        if (impact) {
          if (impact.hit) useGameStore.getState().recordToolUse(selected)
          this.revengeVisuals.impact(impact, this.world)
          useGameStore.setState({ message: impact.hit ? `Hit! -${impact.damage} HP` : 'Miss! Click the walker hitbox.' })
        }
        return
      }
      const p = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2
      if (useGameStore.getState().useWebTool(this.world, { x: p.x / TILE - .5, y: p.y / TILE - .5 })) return
      const x = Math.floor(p.x / TILE), y = Math.floor(p.y / TILE)
      const { tool, direction } = useGameStore.getState()
      if (this.world.miniFactory && tool && !['placeGrove', 'placeIron', 'placeCopper'].includes(tool)) return
      if (tool === 'spiderWeb' || tool === 'playfulSpray' || combatTool(tool) || natureTool(tool)) return
      if (!tool) {
        if (peteHit(this.world, { x: p.x / TILE - .5, y: p.y / TILE - .5 })) { useGameStore.getState().inspectPete(this.world); return }
        const gift = collectGift(this.world, y * SIZE + x)
        if (gift) { useGameStore.setState({ message: gift }); return }
        if (buildingAt(this.world, x, y)?.kind === 'tree') {
          const result = chopTree(this.world, x, y)
          if (result) { this.natureVisuals.fell(this.world, result.tree); useGameStore.setState({ message: `Tree chopped · +${result.wood} Wood (global stock).` }) }
          return
        }
        useGameStore.getState().inspect(this.world, x, y)
        return
      }
      const error = tool === 'remove' ? removalError(this.world, x, y) : placementError(this.world, x, y, tool)
      if (error) { useGameStore.setState({ message: error }); return }
      const wasHome = buildingAt(this.world, x, y)?.kind === 'treehouse'
      const wasBoss = this.world.revenge.boss !== null
      useGameStore.getState().recordToolUse(tool)
      if (tool === 'remove') removeBuilding(this.world, x, y)
      else placeBuilding(this.world, x, y, tool, direction)
      useGameStore.setState({ message: tool === 'treehouse' ? wasBoss ? 'A home for Pete! The walker sighs, powers down, and Pete moves in. ♥' : 'Welcome home, Pete! Peace begins · -20 Wood. ♥' : wasHome ? 'Pete looks confused… back to mischief. Revenge preserved; no Wood refund.' : tool === 'remove' ? 'Building removed · Contained resources discarded.' : `${tool === 'supplyCrate' ? 'Pete’s Supply Crate' : tool === 'belt' ? 'Conveyor' : tool === 'miner' ? 'Miner' : tool === 'furnace' ? 'Furnace' : tool === 'assembler' ? 'Assembler' : tool === 'inserter' ? 'Inserter' : tool === 'generator' ? 'Generator' : tool === 'powerPole' ? 'Power pole' : tool === 'sprinkler' ? 'Anti-Goblin Sprinkler' : tool === 'radar' ? 'Radar trap' : tool === 'splitter' ? 'Splitter' : 'Storage'} placed.` })
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) return
      if (this.rightPan.active) {
        const delta = this.rightPan.move(this.rotationScreen(pointer))
        if (delta) { const rect = this.game.canvas.getBoundingClientRect(), camera = this.cameras.main; camera.scrollX -= delta.x * camera.width / rect.width / camera.zoom; camera.scrollY -= delta.y * camera.height / rect.height / camera.zoom }
        return
      }
      if (this.constructionDrag.active) this.constructionDrag.move(landscapeTile(pointer, this.cameras.main, TILE))
      this.placementRotation.move(this.rotationScreen(pointer))
      this.paintDrag(pointer)
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) return
      this.landscapeStroke.end()
      if ('button' in pointer.event && pointer.event.button === 2) { if (this.rightPan.end()) useGameStore.getState().select(null); return }
      if (this.rightPan.active || ('button' in pointer.event && pointer.event.button !== 0)) return
      if (pointer.event.target !== this.game.canvas || !this.input.isOver || worldInputBlocked(useGameStore.getState())) { if (!useGameStore.getState().touchPlacement) this.cancelConstruction(); return }
      if (this.placementRotation.active) {
        this.placementRotation.move(this.rotationScreen(pointer))
        const result = this.placementRotation.finish(this.world)
        useGameStore.setState({ dragActive: false })
        if (result) {
          if (!result.error) useGameStore.getState().recordToolUse(result.kind)
          useGameStore.setState({ message: result.error ?? `${toolMetadata(result.kind).label} placed.` })
        }
        return
      }
      this.constructionDrag.move(landscapeTile(pointer, this.cameras.main, TILE))
      const tool = useGameStore.getState().tool
      const result = this.constructionDrag.finish(this.world)
      useGameStore.setState({ dragActive: false })
      if (result) {
        if (!result.error && (result.placed > 0 || result.reversed)) useGameStore.getState().recordToolUse(tool)
        useGameStore.setState({ message: result.error ? `Nothing built. ${result.error}` : result.reversed ? `Belt direction updated · ${result.reversed} rotated · ${result.placed} new · ${result.wood ? `${result.wood} Wood` : 'Free'}.` : result.placed ? `${result.placed} ${tool === 'footbridge' ? 'footbridge tiles' : tool === 'belt' ? 'belt tiles' : 'power poles'} built · ${result.wood ? `${result.wood} Wood` : 'Free'}.` : tool === 'belt' ? 'Belts reused. Nothing changed.' : 'Connection already exists. Nothing changed.' })
      }
    })
    this.input.on('pointerupoutside', () => { this.rightPan.cancel(); this.landscapeStroke.end(); if (!useGameStore.getState().touchPlacement) this.cancelConstruction() })
    this.input.on('gameout', () => { this.landscapeStroke.end(); if (!useGameStore.getState().touchPlacement) this.cancelConstruction() })
  }
  private touchTap(point: { x: number; y: number }) {
    const state = useGameStore.getState()
    if (worldInputBlocked(state)) return
    const worldPoint = this.cameras.main.getWorldPoint(point.x, point.y), tile = { x: Math.floor(worldPoint.x / TILE), y: Math.floor(worldPoint.y / TILE) }
    const position = { x: worldPoint.x / TILE - .5, y: worldPoint.y / TILE - .5 }
    if (state.tool === 'playfulSpray') { this.sprayAt(position); return }
    if (state.tool === 'spiderWeb') { state.useWebTool(this.world, position); return }
    if (combatTool(state.tool)) { const impact = attackWalker(this.world, state.tool, position); if (impact) this.revengeVisuals.impact(impact, this.world); return }
    if (state.tool === null) {
      const supply = this.crateSupply.hit(this.world, worldPoint, TILE, this.cameras.main.zoom)
      if (supply !== null) { this.crateSupply.activate(this.world, supply); return }
      if (peteHit(this.world, position)) { state.inspectPete(this.world); return }
      const gift = collectGift(this.world, tile.y * SIZE + tile.x)
      if (gift) { useGameStore.setState({ message: gift }); return }
      if (buildingAt(this.world, tile.x, tile.y)?.kind !== 'tree') state.inspect(this.world, tile.x, tile.y); return
    }
    const previous = state.touchPlacement
    if (previous?.tool === state.tool && previous.end.x === tile.x && previous.end.y === tile.y) { useGameStore.setState({ touchRequest: 'confirm' }); return }
    const route = state.tool === 'belt' || state.tool === 'powerPole' || state.tool === 'footbridge'
    useGameStore.setState({ touchToolsOpen: false, touchAnchor: { x: point.x / this.cameras.main.width * 100, y: point.y / this.cameras.main.height * 100 }, touchPlacement: { tool: state.tool, start: route && previous?.tool === state.tool ? previous.start : tile, end: tile }, message: route ? 'Tap an endpoint, then tap it again to build.' : 'Tap the highlighted target again to build.' })
  }
  private processTouchRequest() {
    const state = useGameStore.getState(), request = state.touchRequest, pending = state.touchPlacement
    if (!request) return
    useGameStore.setState({ touchRequest: null })
    if (request === 'cancel' || !pending || pending.tool !== state.tool || worldInputBlocked(state)) { useGameStore.setState({ touchPlacement: null }); return }
    const { tool, start, end } = pending
    let error: string | null = null
    if (tool === 'belt' || tool === 'powerPole' || tool === 'footbridge') error = commitConstruction(this.world, start, end, tool, state.direction, true).error
    else if (natureTool(tool)) {
      const mode = brushMode(tool), species = plantingSpecies(tool)
      if (mode !== undefined) { const stroke = new LandscapeStroke(); stroke.begin(this.world, end, mode, state.brushSize); stroke.end() }
      else if (tool === 'placeCopper') error = placeCopper(this.world, end.x, end.y)
      else if (tool === 'placeIron') error = placeIron(this.world, end.x, end.y)
      else if (tool === 'placeGrove') error = placeGrove(this.world, end.x, end.y)
      else if (species) { if (!plantTree(this.world, end.x, end.y, species)) error = 'This planting site is blocked.' }
      else { const result = chopTree(this.world, end.x, end.y); if (result) this.natureVisuals.fell(this.world, result.tree); else error = 'Choose a tree.' }
    } else if (tool === 'remove') { error = removalError(this.world, end.x, end.y); if (!error) removeBuilding(this.world, end.x, end.y) }
    else if (tool !== 'spiderWeb' && tool !== 'playfulSpray' && !combatTool(tool)) {
      error = placementError(this.world, end.x, end.y, tool, state.direction)
      if (!error && !placeBuilding(this.world, end.x, end.y, tool, state.direction)) error = 'The site changed; choose another target.'
    }
    if (!error) state.recordToolUse(tool)
    useGameStore.setState({ touchPlacement: error ? pending : null, message: error ?? 'Done.' })
  }
  private sprayAt(position: { x: number; y: number }) {
    const source = useGameStore.getState().spraySource
    const message = useSimulationSpeed.getState().speed === 0 ? 'Paused · resume to spray.' : source !== null && playfulSpray(this.world, position, source) ? 'Splash!' : 'Needs this sprinkler at full power, a target within 3 tiles and a ready manual spray (1 s).'
    useGameStore.setState({ message })
  }
  private rotationScreen(pointer: Phaser.Input.Pointer) {
    return pointer.event instanceof MouseEvent ? { x: pointer.event.clientX, y: pointer.event.clientY } : { x: pointer.x, y: pointer.y }
  }
  private cancelConstruction() {
    if (useGameStore.getState().touchPlacement) useGameStore.setState({ touchPlacement: null, touchRequest: null })
    this.placementRotation.cancel()
    this.constructionDrag.cancel()
    if (useGameStore.getState().dragActive) useGameStore.setState({ dragActive: false })
  }
  private placementTooltip(pointer: Phaser.Input.Pointer, text: string) {
    const camera = this.cameras.main
    this.constructionLabel.setText(text).setScale(1 / camera.zoom).setVisible(true)
    const point = camera.getWorldPoint(Math.max(8, Math.min(pointer.x + 18, camera.width - this.constructionLabel.width - 8)), Math.max(8, Math.min(pointer.y + 20, camera.height - this.constructionLabel.height - 8)))
    this.constructionLabel.setPosition(point.x, point.y)
  }
  private drawConstruction(pointer: Phaser.Input.Pointer) {
    this.constructionDrag.move(landscapeTile(pointer, this.cameras.main, TILE))
    const plan = this.constructionDrag.preview()
    if (plan) this.drawConstructionPlan(pointer, plan)
  }
  private drawConstructionPlan(pointer: Phaser.Input.Pointer, plan: ConstructionPlan) {
    for (const cell of plan.cells) {
      const color = cell.error ? 0xe7a08d : (plan.unaffordable && (cell.bridge || plan.kind === 'footbridge') && !cell.reuse) ? 0xe6c487 : cell.reverse ? 0xe6c487 : cell.reuse ? 0xa4c9df : plan.detour ? 0x9acdcc : 0xb2d08a
      this.preview.fillStyle(color, .18).fillRect(cell.x * TILE + 1, cell.y * TILE + 1, TILE - 2, TILE - 2)
      this.preview.lineStyle(2, color).strokeRect(cell.x * TILE + 1, cell.y * TILE + 1, TILE - 2, TILE - 2)
      if (cell.error) this.preview.lineBetween(cell.x * TILE + 6, cell.y * TILE + 6, cell.x * TILE + 26, cell.y * TILE + 26).lineBetween(cell.x * TILE + 26, cell.y * TILE + 6, cell.x * TILE + 6, cell.y * TILE + 26)
      else if (plan.kind === 'footbridge') drawFootbridge(this.preview, { kind: 'footbridge', x: cell.x, y: cell.y, direction: cell.direction === 'east' ? 'east' : 'south' }, TILE)
      else if (plan.kind === 'belt') {
        if (cell.bridge) this.preview.lineStyle(2, 0xd1b88b, .85).strokeRect(cell.x * TILE + 4, cell.y * TILE + 4, TILE - 8, TILE - 8)
        this.arrow(cell.x * TILE, cell.y * TILE, cell.direction, color)
        if (cell.reverse) this.preview.lineStyle(2, color).strokeCircle((cell.x + .5) * TILE, (cell.y + .5) * TILE, 11)
      }
      else this.preview.lineBetween((cell.x + .5) * TILE, cell.y * TILE + 6, (cell.x + .5) * TILE, cell.y * TILE + 27).strokeCircle((cell.x + .5) * TILE, cell.y * TILE + 10, 5)
    }
    if (plan.kind === 'powerPole') {
      for (const cell of plan.cells) if (cell.reuse) this.preview.lineStyle(2, 0xa4c9df).strokeCircle((cell.x + .5) * TILE, (cell.y + .5) * TILE, 12)
      if (!plan.error) for (let i = 1; i < plan.cells.length; i++) this.preview.lineStyle(2, 0xb2d08a, .65).lineBetween((plan.cells[i - 1].x + .5) * TILE, (plan.cells[i - 1].y + .5) * TILE, (plan.cells[i].x + .5) * TILE, (plan.cells[i].y + .5) * TILE)
      if (plan.snapFrom) {
        const last = plan.cells[plan.cells.length - 1], from = plan.snapFrom
        this.preview.lineStyle(1, 0xa4c9df, .6).strokeCircle((from.x + .5) * TILE, (from.y + .5) * TILE, 7).lineBetween((from.x + .5) * TILE, (from.y + .5) * TILE, (last.x + .5) * TILE, (last.y + .5) * TILE)
      }
    }
    if (plan.beltSnap) this.preview.lineStyle(2, 0xa4c9df, .7).strokeCircle((plan.beltSnap.x + .5) * TILE, (plan.beltSnap.y + .5) * TILE, 11)
    const count = plan.cells.filter(c => !c.reuse).length, reversed = plan.cells.filter(c => c.reverse).length, reused = plan.cells.length - count - reversed
    this.placementTooltip(pointer, `${plan.unaffordable ? '◇' : plan.error ? '×' : '✓'} ${plan.kind === 'footbridge' ? 'Wooden footbridge' : plan.kind === 'belt' ? `Belts${plan.detour ? ' · Auto detour' : ''}` : 'Power connection'} · ${count} ${plan.kind === 'belt' ? `new · ${reused} reused · ${reversed} rotated` : `new · ${reused} existing`}\nTotal cost: ${plan.wood ? `${plan.wood} Wood · You have ${this.world.nature.wood}` : 'Free'}${plan.cells.some(c => c.bridge) ? ` · ${plan.cells.filter(c => c.bridge && !c.reuse).length} new bridge segments` : ''}\n${plan.error ?? `${plan.snapFrom ? 'Snapped to nearby existing pole. ' : plan.beltSnap ? 'Joining existing belt. ' : ''}${plan.kind === 'powerPole' ? 'Connection ready. ' : ''}Release to build. Escape or right-click to cancel.`}`)
  }
  private paintDrag(pointer: Phaser.Input.Pointer) {
    const state = useGameStore.getState(), mode = brushMode(state.tool)
    if (!pointer.leftButtonDown() || !this.input.isOver || worldInputBlocked(state) || mode === undefined) { this.landscapeStroke.end(); return }
    const changed = this.landscapeStroke.move(this.world, landscapeTile(pointer, this.cameras.main, TILE), mode, state.brushSize)
    if (changed > 0 && !this.landscapeUsed) { useGameStore.getState().recordToolUse(state.tool); this.landscapeUsed = true }
  }

  private createTerrain(world: World, visible = true): TerrainVisuals { return new TerrainVisuals(this, world, TILE, visible) }
  private viewState(): ViewState {
    const c = this.cameras.main, state = useGameStore.getState()
    return { scrollX: c.scrollX, scrollY: c.scrollY, zoom: c.zoom, direction: state.direction, powerOverlay: state.powerOverlay }
  }
  private restore(candidate: LoadedGame) {
    // Build replacement rendering while hidden. A failed preparation leaves the old world intact.
    const terrain = this.createTerrain(candidate.world, false)
    this.landscapeStroke.end()
    this.cancelConstruction()
    const oldWorld = this.world, oldTerrain = this.terrain, oldView = this.viewState(), oldState = useGameStore.getState()
    try {
      this.cameras.main.setZoom(candidate.view.zoom).setScroll(candidate.view.scrollX, candidate.view.scrollY)
      updateCameraBounds(this.cameras.main, SIZE * TILE)
      this.world = candidate.world
      this.terrain = terrain.setVisible(true)
      this.rightPan.cancel()
      useGameStore.setState({ spraySource: null, tool: null, buildTab: 'factory', peteInspection: null, inspected: null, inspection: null, recipeRequest: null, releaseRequest: null, supplyRequest: null, connectionVisible: false, focusRequest: null, dragActive: false, uiPanel: null, researchOpen: false, researchRequest: null, researchFeedback: '', analyticsOpen: false, direction: candidate.view.direction, powerOverlay: candidate.view.powerOverlay, message: candidate.world.miniFactory ? 'Petes Welt geladen.' : 'Factory restored · Click a building to inspect it.' })
      useGameStore.getState().publish(this.world)
    } catch (error) {
      this.world = oldWorld; this.terrain = oldTerrain
      terrain.destroy()
      this.cameras.main.setZoom(oldView.zoom).setScroll(oldView.scrollX, oldView.scrollY)
      updateCameraBounds(this.cameras.main, SIZE * TILE)
      useGameStore.setState(oldState, true)
      throw error
    }
    oldTerrain.destroy()
    this.polePreviewKey = ''; this.poleCandidate = null; this.poleLinks.clear()
    this.saves.resetAutosave()
  }

  private processSaveRequest(): boolean {
    const request = useGameStore.getState().saveRequest
    if (!request) return false
    const loading = request.kind === 'load' || request.kind === 'load-auto' || request.kind === 'import' || request.kind === 'new'
    useGameStore.setState({ saveRequest: null })
    try {
      if (request.kind === 'save') this.saves.save(this.world, this.viewState(), 'manual')
      else if (request.kind === 'new') {
        if (window.confirm('Neue Spielwelt starten? Ungespeicherter Fortschritt geht verloren. Deine gespeicherten Welten bleiben erhalten.')) {
          const camera = this.cameras.main
          this.restore({ world: request.mode === 'petesWorld' || (!request.mode && this.world.miniFactory) ? createPetesWorld() : createWorld(), view: { scrollX: SIZE * TILE / 2 - camera.width / 2, scrollY: SIZE * TILE / 2 - camera.height / 2, zoom: 1.3, direction: 'east', powerOverlay: false }, savedAt: new Date().toISOString() })
          this.saves.setMode(this.world.miniFactory ? 'petesWorld' : 'factory')
          useGameStore.getState().setBuildTab(this.world.miniFactory ? 'nature' : 'factory')
          this.saves.feedback('New game started. Browser save slots were kept.')
        } else this.saves.feedback('New game cancelled. Current factory kept.')
      } else if (request.kind === 'export') {
        const savedAt = new Date().toISOString()
        downloadSave(encodeSave(this.world, this.viewState(), savedAt), savedAt)
        this.saves.feedback('JSON save exported. Browser save slots were kept.')
      } else {
        const previousMode = this.saves.mode
        if (request.kind !== 'import' && request.mode) this.saves.setMode(request.mode)
        let candidate: LoadedGame
        try { candidate = request.kind === 'import' ? decodeSave(request.text) : this.saves.load(request.kind === 'load-auto' ? 'auto' : 'manual') } finally { this.saves.setMode(previousMode) }
        if (window.confirm('Replace the current running factory with this saved game? Unsaved progress will be replaced.')) {
          this.restore(candidate)
          this.saves.setMode(this.world.miniFactory ? 'petesWorld' : 'factory')
          useGameStore.getState().setBuildTab(this.world.miniFactory ? 'nature' : 'factory')
          this.saves.feedback(request.kind === 'import' ? 'JSON save imported. Browser save slots were kept.' : 'Game loaded locally.')
        } else this.saves.feedback('Load cancelled. Current factory kept.')
      }
    } catch (error) { this.saves.feedback(errorMessage(error), true) }
    finally {
      useGameStore.setState({ saveBusy: false, saveStatus: { ...this.saves.status } })
      if (loading) this.skipNextDelta = true
    }
    return loading
  }
  private drawItem(item: Item, x: number, y: number) {
    const visual = ITEM_DEFINITIONS[item].visual
    if (visual.shape === 'ore') {
      this.items.fillStyle(0x17222b).fillCircle(x, y, 5)
      this.items.fillStyle(visual.color).fillTriangle(x - 4, y + 3, x - 2, y - 4, x + 4, y + 2)
      this.items.fillStyle(visual.highlight).fillCircle(x + 1, y, 2.5)
    } else if (item === 'wood') {
      this.items.fillStyle(visual.color).fillRoundedRect(x - 6, y - 3, 12, 6, 2)
      this.items.fillStyle(visual.highlight).fillCircle(x + 4, y, 3)
      this.items.lineStyle(1, visual.shade).strokeCircle(x + 4, y, 1.5)
    } else if (item === 'woodenCrate') {
      this.items.fillStyle(visual.color).fillRect(x - 5, y - 5, 10, 10)
      this.items.lineStyle(1, visual.highlight).strokeRect(x - 5, y - 5, 10, 10)
      this.items.lineStyle(1, visual.shade).lineBetween(x - 4, y - 4, x + 4, y + 4)
      this.items.lineBetween(x - 4, y + 4, x + 4, y - 4)
    } else if (visual.shape === 'gear') {
      this.items.lineStyle(3, visual.color)
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4
        this.items.lineBetween(x + Math.cos(angle) * 3, y + Math.sin(angle) * 3, x + Math.cos(angle) * 6, y + Math.sin(angle) * 6)
      }
      this.items.fillStyle(visual.highlight).fillCircle(x, y, 4)
      this.items.fillStyle(visual.shade).fillCircle(x, y, 2)
    } else if (visual.shape === 'cable') {
      this.items.lineStyle(2, visual.shade).strokeEllipse(x, y, 10, 8)
      this.items.lineStyle(2, visual.color).strokeEllipse(x, y - 1, 8, 6)
      this.items.lineStyle(1, visual.highlight).lineBetween(x + 3, y + 1, x + 6, y + 4)
    } else if (visual.shape === 'circuit') {
      this.items.fillStyle(visual.shade).fillRect(x - 6, y - 5, 12, 10)
      this.items.fillStyle(visual.color).fillRect(x - 5, y - 4, 10, 8)
      this.items.fillStyle(0x182b25).fillRect(x - 2, y - 2, 4, 4)
      this.items.lineStyle(1, visual.highlight).lineBetween(x - 4, y + 3, x - 4, y - 2)
      this.items.lineBetween(x + 2, y, x + 5, y)
    } else {
      this.items.fillStyle(visual.shade).fillRect(x - 5, y - 3, 10, 7)
      this.items.fillStyle(visual.color).fillRect(x - 4, y - 3, 8, 5)
      this.items.lineStyle(1, visual.highlight).lineBetween(x - 4, y - 3, x + 4, y - 3)
    }
  }
  private arrow(x: number, y: number, direction: Direction, color = 0xe8dfac, scale = 1) {
    const d = offsets[direction]
    const cx = x + TILE / 2, cy = y + TILE / 2
    this.machines.lineStyle(2, color).lineBetween(cx - d.x * 6 * scale, cy - d.y * 6 * scale, cx + d.x * 7 * scale, cy + d.y * 7 * scale)
    this.machines.lineBetween(cx + d.x * 7 * scale, cy + d.y * 7 * scale, cx + (d.x * 2 - d.y * 4) * scale, cy + (d.y * 2 + d.x * 4) * scale)
    this.machines.lineBetween(cx + d.x * 7 * scale, cy + d.y * 7 * scale, cx + (d.x * 2 + d.y * 4) * scale, cy + (d.y * 2 - d.x * 4) * scale)
  }
  private lane(x: number, y: number, entry: Direction, output: Direction, width: number, color: number) {
    const graphics = this.machines
    graphics.lineStyle(width, color).beginPath()
    for (let i = 0; i <= 20; i++) {
      const p = beltPathPoint(entry, output, i / 20)
      if (i === 0) graphics.moveTo(x + 16 + p.x * TILE, y + 16 + p.y * TILE)
      else graphics.lineTo(x + 16 + p.x * TILE, y + 16 + p.y * TILE)
    }
    graphics.strokePath()
  }
  private showCoverage(position: { x: number; y: number }, networkId: number | null, alpha = .1) {
    if (!intersects(cameraViewport(this.cameras.main), (position.x + .5 - POLE_COVERAGE_RADIUS) * TILE, (position.y + .5 - POLE_COVERAGE_RADIUS) * TILE, 2 * POLE_COVERAGE_RADIUS * TILE, 2 * POLE_COVERAGE_RADIUS * TILE, TILE)) return
    const graphics = this.coverage
    graphics.fillStyle(0x66c6e0, alpha).fillCircle((position.x + .5) * TILE, (position.y + .5) * TILE, POLE_COVERAGE_RADIUS * TILE)
    graphics.lineStyle(1, 0x83d5ec, .8).strokeCircle((position.x + .5) * TILE, (position.y + .5) * TILE, POLE_COVERAGE_RADIUS * TILE)
    for (const machine of this.world.buildings) {
      if (!machine || !powerRequirement(machine) || !withinRange(position, machine, POLE_COVERAGE_RADIUS)) continue
      const assigned = this.world.power?.assignments[machine.y * SIZE + machine.x] ?? null
      const color = networkId !== null && assigned !== null && assigned !== networkId ? 0xffbd6c : 0x8df0b3
      graphics.fillStyle(color, .25).fillRect(machine.x * TILE, machine.y * TILE, TILE, TILE)
      graphics.lineStyle(3, color).strokeRect(machine.x * TILE + 1, machine.y * TILE + 1, TILE - 2, TILE - 2)
    }
  }
  private previewPole(x: number, y: number): PolePlacementPreview {
    const key = `${x},${y},${this.world.topologyRevision},${this.world.pete.tile},${this.world.pete.next},${this.world.police.car?.tile},${this.world.police.car?.next},${this.world.revenge.boss?.tile},${this.world.revenge.boss?.next}`
    // World-space graphics follow camera transforms without being rebuilt.
    if (!this.poleCandidate || this.polePreviewKey !== key) {
      this.polePreviewKey = key
      this.poleCandidate = polePlacementPreview(this.world, { x, y })
      this.poleLinks.clear()
      const color = this.poleCandidate.state === 'invalid' ? 0x929b9f : this.poleCandidate.state === 'connected' ? 0x8df0b3 : 0xf0ac60
      const fromX = (x + .5) * TILE, fromY = (y + .5) * TILE
      this.poleLinks.lineStyle(2, color, .9)
      for (const index of this.poleCandidate.connections) {
        const to = tilePosition(index)
        const dx = (to.x - x) * TILE, dy = (to.y - y) * TILE
        const length = Math.hypot(dx, dy)
        for (let distance = 0; distance < length; distance += 12) {
          const end = Math.min(distance + 7, length)
          this.poleLinks.lineBetween(fromX + dx * distance / length, fromY + dy * distance / length, fromX + dx * end / length, fromY + dy * end / length)
        }
      }
      this.poleLinks.lineBetween(fromX, fromY + 9, fromX, fromY - 9)
      this.poleLinks.lineBetween(fromX - 9, fromY - 6, fromX + 9, fromY - 6)
    }
    return this.poleCandidate
  }
  update(_time: number, delta: number) {
    const camera = this.cameras.main
    this.processTouchRequest()
    updateCameraBounds(camera, SIZE * TILE)
    if (!worldInputBlocked(useGameStore.getState())) moveCamera(camera, this.keys, delta)
    const focus = useGameStore.getState().focusRequest
    if (focus !== null) {
      const building = this.world.buildings[focus]
      if (building && hasTechnology(this.world.research, 'analytics1')) {
        useGameStore.getState().inspect(this.world, building.x, building.y)
        camera.centerOn((building.x + .5) * TILE, (building.y + .5) * TILE)
      }
      useGameStore.setState({ focusRequest: null })
    }
    useGameStore.getState().applySupply(this.world)
    useGameStore.getState().applyResearch(this.world)
    useGameStore.getState().applyRelease(this.world)
    const request = useGameStore.getState().recipeRequest
    if (request) {
      const position = tilePosition(request.index)
      const machine = buildingAt(this.world, position.x, position.y)
      const error = machine?.kind === 'assembler'
        ? changeCraftingRecipe(this.world, position.x, position.y, request.recipeMode)
        : changeFurnaceRecipe(this.world, position.x, position.y, request.recipeMode)
      useGameStore.setState({ recipeRequest: null, message: error ?? `Recipe mode: ${request.recipeMode === 'auto' ? 'Auto' : RECIPES[request.recipeMode].label}.` })
    }
    const loading = this.processSaveRequest()
    const skip = this.skipNextDelta
    if (skip && !loading) this.skipNextDelta = false
    const before = this.world.timeMs
    const diagnostics = useGraphicsSettings.getState().diagnostics
    const tickStart = diagnostics ? performance.now() : 0
    if (!loading && !skip) advanceWorld(this.world, simulationDelta(delta, useSimulationSpeed.getState().speed))
    if (diagnostics && this.world.timeMs > before) this.tickCostMs = (performance.now() - tickStart) / ((this.world.timeMs - before) / 50)
    const autosave = this.saves.tick(document.hidden ? 0 : this.world.timeMs - before, this.world, this.viewState(), !loading && !skip)
    if (autosave) useGameStore.setState({ saveStatus: autosave })
    const power = allocatePower(this.world)
    const overlay = useGameStore.getState().powerOverlay
    const view = cameraViewport(camera)
    const bounds = visibleTileBounds(view, TILE)
    this.wires.clear()
    this.coverage.clear()
    for (const [a, b] of power.poleConnections) {
      const from = tilePosition(a), to = tilePosition(b)
      if (!intersects(view, Math.min(from.x, to.x) * TILE, Math.min(from.y, to.y) * TILE, Math.abs(to.x - from.x) * TILE, Math.abs(to.y - from.y) * TILE, TILE)) continue
      this.wires.lineStyle(overlay ? 2 : 1, 0xd7b66c, .8).lineBetween((from.x + .5) * TILE, (from.y + .5) * TILE, (to.x + .5) * TILE, (to.y + .5) * TILE)
    }
    for (const network of power.networks) for (const index of network.generatorIndices) {
      const generator = this.world.buildings[index]!
      const pole = network.poleIndices.find(i => withinRange(generator, tilePosition(i), POLE_COVERAGE_RADIUS))!
      const to = tilePosition(pole)
      if (!intersects(view, Math.min(generator.x, to.x) * TILE, Math.min(generator.y, to.y) * TILE, Math.abs(to.x - generator.x) * TILE, Math.abs(to.y - generator.y) * TILE, TILE)) continue
      this.wires.lineStyle(1, 0x78c9bc, .8).lineBetween((generator.x + .5) * TILE, (generator.y + .5) * TILE, (to.x + .5) * TILE, (to.y + .5) * TILE)
    }
    if (overlay) for (const network of power.networks) for (const index of network.poleIndices) this.showCoverage(tilePosition(index), network.id, .035)
    this.machines.clear()
    this.items.clear()
    this.peteEffects.clear()
    this.paintDrag(this.input.activePointer)
    this.terrain.update()
    this.landscapeWater.draw(this.waterSurface, this.world, view, TILE)
    this.shoreVegetation.draw(this.waterSurface, this.world, view, TILE)
    this.natureVisuals.drawDecorations(this.landscape, this.world, TILE, view)
    this.drawnBuildings = 0
    for (let row = bounds.top; row <= bounds.bottom; row++) for (let column = bounds.left; column <= bounds.right; column++) {
      const building = this.world.buildings[row * SIZE + column]
      if (!building) continue
      this.drawnBuildings++
      const x = building.x * TILE, y = building.y * TILE
      if (building.kind === 'footbridge') {
        drawFootbridge(this.machines, building, TILE)
      } else if (building.kind === 'treehouse') {
        drawTreehouse(this.machines, this.world, building, TILE)
      } else if (building.kind === 'tree') {
        drawTree(this.machines, this.world, building, TILE)
      } else if (building.kind === 'sprinkler') {
        drawSprinkler(this.machines, this.world, building, TILE)
      } else if (building.kind === 'radar' || building.kind === 'prison') {
        drawSecurityBuilding(this.machines, this.world, building, TILE)
      } else if (building.kind === 'peteGate') {
        drawGardenGate(this.machines, building, TILE)
      } else if (building.kind === 'peteTreasure' || building.kind === 'peteFlightpad') {
        drawInventorStructure(this.machines, building.kind === 'peteTreasure' ? 'treasure' : 'flightpad', building.x, building.y, TILE, 1, this.world.peace.activity === 'storingTreasure')
      } else if (building.kind === 'peteDevelopment') {
        if (building.development === 'house') drawAnnexWalkway(this.machines, this.world, TILE)
        drawDevelopment(this.machines, building.development, building.x, building.y, TILE, this.world.timeMs, 1, building.fruit, this.world.peace.activity === 'developmentWork' && Math.abs(this.world.pete.tile % SIZE - building.x) + Math.abs(Math.floor(this.world.pete.tile / SIZE) - building.y) === 1, this.world.peace.activity !== 'cycling' && this.world.peace.activity !== 'dismounting')
      } else if (building.kind === 'petePress') {
        drawGearPress(this.machines, building, TILE)
      } else if (building.kind === 'peteExperiment') {
        drawExperimentTable(this.machines, building, TILE)
      } else if (building.kind === 'peteWorkshop') {
        drawWorkshop(this.machines, building, TILE)
      } else if (building.kind === 'peteGarden') {
        drawVegetableGarden(this.machines, building, TILE)
      } else if (building.kind === 'peteCampfire') {
        drawCampfire(this.machines, building, TILE)
      } else if (building.kind === 'peteCoop') {
        drawChickenCoop(this.machines, building, TILE)
      } else if (building.kind === 'peteFence') {
        if (this.world.chickenRun && this.world.chickenRun.tiles.includes(building.y * SIZE + building.x) && yardCorner(this.world.chickenRun, building.y * SIZE + building.x)) drawYardCorner(this.machines, building, this.world.chickenRun, TILE)
        else if (this.world.yard && yardCorner(this.world.yard, building.y * SIZE + building.x)) drawYardCorner(this.machines, building, this.world.yard, TILE)
        else drawPeteFence(this.machines, building, TILE, 1, this.world.chickenRun?.tiles.includes(building.y * SIZE + building.x) ?? false)
      } else if (building.kind === 'supplyCrate') {
        drawSupplyCrate(this.machines, building, TILE)
      } else if (building.kind === 'storage') {
        this.machines.fillStyle(0x392d20).fillRoundedRect(x + 2, y + 2, 28, 28, 3)
        this.machines.lineStyle(2, 0xb68b50).strokeRect(x + 5, y + 5, 22, 22)
        this.machines.fillStyle(0xb68b50).fillRect(x + 5, y + 13, 22, 5)
        ITEMS.filter(item => building.inventory[item] > 0).slice(0, 4).forEach((item, index) => this.drawItem(item, x + 11 + index % 2 * 10, y + 12 + Math.floor(index / 2) * 10))
      } else if (building.kind === 'forester' || building.kind === 'sawmill') {
        const mill = building.kind === 'sawmill'
        this.machines.fillStyle(0x263d2c).fillRoundedRect(x + 2, y + 3, 28, 27, 3)
        this.machines.lineStyle(2, 0xb59357).strokeRect(x + 4, y + 6, 24, 22)
        this.machines.fillStyle(0x9e7242).fillRect(x + 5, y + 18, 22, 7)
        if (mill) {
          this.machines.fillStyle(0xcad8d1).fillCircle(x + 16, y + 16, 8)
          this.machines.lineStyle(2, 0x476051)
          const angle = (building.job?.elapsedMs ?? 0) / 200
          for (let n = 0; n < 6; n++) this.machines.lineBetween(x + 16, y + 16, x + 16 + Math.cos(angle + n * Math.PI / 3) * 9, y + 16 + Math.sin(angle + n * Math.PI / 3) * 9)
        } else {
          this.machines.fillStyle(0x73ac66).fillTriangle(x + 16, y + 4, x + 7, y + 19, x + 25, y + 19)
          this.machines.fillStyle(0xe0d1a3).fillRect(x + 7, y + 26, 18 * building.elapsed / 6000, 2)
        }
        this.arrow(x, y, building.direction)
      } else if (building.kind === 'miner') {
        this.machines.fillStyle(0x15201e).fillRoundedRect(x + 3, y + 4, 27, 27, 3)
        this.machines.fillStyle(0xc69a46).fillRect(x + 5, y + 4, 22, 21)
        this.machines.fillStyle(0x354346).fillRect(x + 9, y + 7, 14, 15)
        this.arrow(x, y, building.direction)
        this.machines.fillStyle(building.item ? 0xf08172 : 0x79e6a2).fillCircle(x + 25, y + 6, 2)
        this.machines.fillStyle(0x79e6a2).fillRect(x + 5, y + 27, 22 * (building.item ? 1 : building.elapsed / INTERVAL), 3)
      } else if (building.kind === 'furnace') {
        const status = furnaceStatus(building)
        const speed = power.consumers[building.y * SIZE + building.x]?.speedFraction ?? 0
        const active = status === 'processing' && speed > 0
        const glow = active ? .78 + .1 * Math.sin(building.job ? building.job.elapsedMs / 350 : 0) : .15
        this.machines.fillStyle(0x191e20).fillRoundedRect(x + 2, y + 2, 28, 28, 3)
        this.machines.fillStyle(0x626d70).fillRect(x + 5, y + 3, 22, 24)
        this.machines.fillStyle(0x3e302b).fillRect(x + 7, y + 5, 18, 20)
        this.machines.lineStyle(1, 0x91705b).lineBetween(x + 7, y + 12, x + 25, y + 12)
        this.machines.fillStyle(0x151a1c).fillRoundedRect(x + 9, y + 10, 14, 13, 2)
        this.machines.fillStyle(active ? 0xff9d3c : 0x59636b, glow).fillRect(x + 10, y + 12, 12, 9)
        if (active) this.machines.fillStyle(0xffdc7c, glow).fillTriangle(x + 11, y + 21, x + 17, y + 13 - 2 * Math.sin(building.job ? building.job.elapsedMs / 260 : 0), x + 21, y + 21)
        this.machines.fillStyle(status === 'output-full' ? 0xf08172 : active ? 0xffc470 : 0x98a2a3).fillCircle(x + 26, y + 5, 2)
        const progress = building.job ? building.job.elapsedMs / RECIPES[building.job.recipeId].durationMs : 0
        this.machines.fillStyle(0x111714).fillRect(x + 5, y + 28, 22, 3)
        this.machines.fillStyle(0xffbd6c).fillRect(x + 5, y + 28, 22 * progress, 3)
        this.machines.fillStyle(0x9aabad).fillRect(x + 4, y + 1, 6, 10)
        this.machines.fillStyle(0x293237).fillRect(x + 3, y + 1, 8, 3)
        this.machines.fillStyle(0xb6c2c3).fillCircle(x + 6, y + 25, 1)
        this.machines.fillCircle(x + 26, y + 25, 1)
        const output = offsets[building.direction]
        this.arrow(x + output.x * 8, y + output.y * 8, building.direction, 0xffdb9d, .6)
      } else if (building.kind === 'assembler') {
        const status = craftingStatus(building)
        const speed = power.consumers[building.y * SIZE + building.x]?.speedFraction ?? 0
        const active = status === 'processing' && speed > 0
        // Job time advances only with allocated power, so the mechanism freezes on outages.
        const angle = (building.job?.elapsedMs ?? 0) / 240
        const progress = building.job ? building.job.elapsedMs / RECIPES[building.job.recipeId].durationMs : 0
        this.machines.fillStyle(0x15252c).fillRoundedRect(x + 2, y + 2, 28, 28, 3)
        this.machines.lineStyle(2, 0x659bab).strokeRect(x + 4, y + 4, 24, 23)
        this.machines.fillStyle(0x2c515d).fillRect(x + 6, y + 6, 20, 19)
        for (const side of ['north', 'east', 'south', 'west'] as const) {
          if (side === building.direction) continue
          const d = offsets[side]
          this.machines.fillStyle(0x8fc6c4).fillCircle(x + 16 + d.x * 12, y + 16 + d.y * 12, 2)
        }
        this.machines.lineStyle(3, active ? 0xc4e2e6 : 0x81969c)
        for (let i = 0; i < 6; i++) {
          const a = angle + i * Math.PI / 3
          this.machines.lineBetween(x + 16 + Math.cos(a) * 4, y + 15 + Math.sin(a) * 4, x + 16 + Math.cos(a) * 8, y + 15 + Math.sin(a) * 8)
        }
        this.machines.fillStyle(0xa1bec7).fillCircle(x + 16, y + 15, 5)
        this.machines.fillStyle(0x203d46).fillCircle(x + 16, y + 15, 2)
        const output = offsets[building.direction]
        this.arrow(x + output.x * 10, y + output.y * 10, building.direction, 0xb9f3df, .45)
        this.machines.fillStyle(status === 'output-full' ? 0xf08172 : active ? 0x79e6a2 : 0x98a2a3).fillCircle(x + 26, y + 5, 2)
        this.machines.fillStyle(0x101b22).fillRect(x + 5, y + 28, 22, 3)
        this.machines.fillStyle(0x79e6a2).fillRect(x + 5, y + 28, 22 * progress, 3)
      } else if (building.kind === 'inserter') {
        const d = offsets[building.direction]
        const arm = inserterArmPoint(building.phase, building.elapsedMs)
        const cx = x + 16, cy = y + 16
        const handX = cx + (d.x * arm.x - d.y * arm.y) * TILE
        const handY = cy + (d.y * arm.x + d.x * arm.y) * TILE
        this.machines.fillStyle(0x18262c).fillRoundedRect(x + 5, y + 5, 22, 22, 4)
        this.machines.lineStyle(2, 0xa9bac0).strokeRect(x + 8, y + 8, 16, 16)
        this.machines.lineStyle(5, 0x433a22).lineBetween(cx, cy, handX, handY)
        this.machines.lineStyle(3, 0xe8ba56).lineBetween(cx, cy, handX, handY)
        this.machines.fillStyle(0xe4c782).fillCircle(cx, cy, 5)
        this.machines.fillStyle(0x33474d).fillCircle(cx, cy, 2)
        this.machines.lineStyle(2, 0xe8dfb6).strokeCircle(handX, handY, 5)
        this.arrow(x + d.x * 9, y + d.y * 9, building.direction, 0xa5edcf, .35)
        if (building.item) this.drawItem(building.item, handX, handY)
      } else if (building.kind === 'fishingDock') {
        drawFishingDock(this.machines, building)
      } else if (building.kind === 'waterwheel') {
        drawWaterwheel(this.machines, building, waterwheelRunning(this.world, building) ? this.world.remainder : 0)
      } else if (building.kind === 'generator') {
        const networkId = power.assignments[building.y * SIZE + building.x]
        const network = power.networks.find(n => n.id === networkId)
        const supplying = sabotageRemaining(this.world, building) === 0 && (network?.suppliedKw ?? 0) > 0
        this.machines.fillStyle(0x15242b).fillRoundedRect(x + 2, y + 3, 28, 27, 4)
        this.machines.lineStyle(2, 0x72b9c1).strokeRect(x + 4, y + 5, 24, 23)
        for (let n = 0; n < 4; n++) this.machines.fillStyle(0x3d6571).fillRect(x + 6, y + 8 + n * 4, 9, 2)
        this.machines.fillStyle(0xffdd79).fillTriangle(x + 22, y + 7, x + 16, y + 18, x + 21, y + 18)
        this.machines.fillTriangle(x + 19, y + 15, x + 25, y + 15, x + 19, y + 26)
        this.machines.fillStyle(networkId === undefined ? 0xf08172 : supplying ? 0x79e6a2 : 0x78bdd3).fillCircle(x + 6, y + 5, 2)
      } else if (building.kind === 'powerPole') {
        this.machines.fillStyle(0x322a20).fillEllipse(x + 16, y + 27, 16, 7)
        this.machines.lineStyle(5, 0xb89a6a).lineBetween(x + 16, y + 27, x + 16, y + 5)
        this.machines.lineStyle(3, 0xe5d0a5).lineBetween(x + 5, y + 8, x + 27, y + 8)
        this.machines.fillStyle(0x94d5dc).fillCircle(x + 7, y + 5, 2)
        this.machines.fillCircle(x + 25, y + 5, 2)
      } else if (building.kind === 'splitter') {
        const rear = opposite(building.direction), rearOffset = offsets[rear]
        this.machines.fillStyle(0x253c45).fillRoundedRect(x + 1, y + 1, 30, 30, 4)
        this.machines.lineStyle(2, 0x87b6ba).strokeRoundedRect(x + 2, y + 2, 28, 28, 4)
        this.machines.lineStyle(6, 0x15252c).lineBetween(x + 16 + rearOffset.x * 16, y + 16 + rearOffset.y * 16, x + 16, y + 16)
        this.arrow(x + rearOffset.x * 10, y + rearOffset.y * 10, building.direction, 0xffbd6c, .45)
        for (const output of [0, 1] as const) {
          let previous = splitterOutputPoint(building.direction, output, 0)
          for (let t = .1; t <= 1.001; t += .1) {
            const next = splitterOutputPoint(building.direction, output, t)
            this.machines.lineStyle(6, 0x15252c).lineBetween(x + 16 + previous.x * TILE, y + 16 + previous.y * TILE, x + 16 + next.x * TILE, y + 16 + next.y * TILE)
            previous = next
          }
          const direction = splitterDirections(building.direction)[output], d = offsets[direction]
          this.arrow(x + d.x * 10, y + d.y * 10, direction, output === 0 ? 0x9ee1ac : 0x85d1e8, .6)
          this.machines.fillStyle(splitterBlocked(this.world, building, output) ? 0xf08172 : 0x79e6a2).fillCircle(x + 16 + d.x * 12, y + 16 + d.y * 12, 2)
          const packet = building.outputs[output]
          if (packet) {
            const point = splitterOutputPoint(building.direction, output, Math.min(1, packet.progress + this.world.remainder / SPLITTER_STAGE_MS))
            this.drawItem(packet.item, x + 16 + point.x * TILE, y + 16 + point.y * TILE)
          }
        }
        this.machines.fillStyle(0xd8b369).fillCircle(x + 16, y + 16, 3)
        if (building.input) {
          const point = splitterInputPoint(building.direction, Math.min(1, building.input.progress + this.world.remainder / SPLITTER_STAGE_MS))
          this.drawItem(building.input.item, x + 16 + point.x * TILE, y + 16 + point.y * TILE)
        }
      } else if (building.kind === 'belt') {
        if (building.bridge) {
          const horizontal = !!offsets[building.direction].x
          this.machines.fillStyle(0xa88a61).fillRect(x + (horizontal ? 0 : 1), y + (horizontal ? 1 : 0), horizontal ? TILE : 30, horizontal ? 30 : TILE)
          this.machines.lineStyle(2, 0xd1b88b)
          for (const edge of [2, 30]) if (horizontal) this.machines.lineBetween(x, y + edge, x + TILE, y + edge)
          else this.machines.lineBetween(x + edge, y, x + edge, y + TILE)
        }
        const inputs = beltInputs(this.world, building)
        const paths = inputs.length ? inputs : [opposite(building.direction)]
        // Draw every valid input, with a stable main lane independent of items.
        for (const entry of paths) this.lane(x, y, entry, building.direction, 24, 0x778184)
        for (const entry of paths) this.lane(x, y, entry, building.direction, 20, 0x1b2329)
        for (const entry of paths) {
          for (let t = .15; t < 1; t += .2) {
            const p = beltPathPoint(entry, building.direction, t)
            const q = beltPathPoint(entry, building.direction, t + .01)
            const length = Math.hypot(q.x - p.x, q.y - p.y)
            const nx = -(q.y - p.y) / length * 7, ny = (q.x - p.x) / length * 7
            this.machines.lineStyle(1, 0x465256).lineBetween(x + 16 + p.x * TILE - nx, y + 16 + p.y * TILE - ny, x + 16 + p.x * TILE + nx, y + 16 + p.y * TILE + ny)
          }
        }
        const arrow = beltPathPoint(paths[0], building.direction, .65)
        this.arrow(x + arrow.x * TILE, y + arrow.y * TILE, building.direction, 0xa5ac91)
        if (building.item) {
          const progress = Math.min(1, building.progress + this.world.remainder / BELT_TRAVEL_MS)
          const p = beltPathPoint(building.entry, building.direction, progress)
          this.drawItem(building.item, x + 16 + p.x * TILE, y + 16 + p.y * TILE)
        }
      }
      drawSabotage(this.peteEffects, this.world, building, TILE)
      if (powerRequirement(building)) {
        const details = electricalDetails(this.world, building.y * SIZE + building.x)
        const color = details.state === 'sabotaged' ? 0xf69a38 : details.state === 'disconnected' || details.state === 'no-generation' ? 0xf08172 : details.state === 'reduced' ? 0xffbd6c : details.state === 'idle' ? 0x83c0d4 : 0x79e6a2
        this.items.fillStyle(0x111714).fillCircle(x + 5, y + 5, 4)
        this.items.fillStyle(color).fillCircle(x + 5, y + 5, 2.5)
        if (overlay) this.items.lineStyle(2, color).strokeRect(x + 1, y + 1, TILE - 2, TILE - 2)
      }
    }
    this.natureVisuals.drawEffects(this.peteEffects, this.world, TILE, view)
    this.webVisuals.draw(this.peteEffects, this.world, TILE, view)
    this.waterVisuals.draw(this.peteEffects, this.world, TILE, view)
    this.revengeVisuals.draw(this.peteEffects, this.world, TILE, this, view)
    drawCampfireEffects(this.peteEffects, this.world, TILE, view)
    drawYardEntrance(this.peteEffects, this.world, TILE, view)
    drawPoultry(this.peteEffects, this.world, TILE, view)
    drawPeace(this.peteEffects, this.world, TILE, view)
    drawDevelopmentActivity(this.peteEffects, this.world, TILE)
    drawLeisure(this.peteEffects, this.world, TILE, view)
    drawPlayfulSpray(this.peteEffects, this.world, TILE, view)
    this.crateSupply.draw(this.peteEffects, this.world, view, TILE, camera.zoom, useGameStore.getState().tool === null && !worldInputBlocked(useGameStore.getState()))
    if (!peaceful(this.world) && (!peteUnavailable(this.world) || this.world.revenge.stage === 'stunned')) drawPete(this.peteEffects, this.world, TILE, view)
    drawPoliceEffects(this.peteEffects, this.world, TILE, view)
    const arrest = arrestVisual(this.world)
    const pete = this.world.pete, complaining = pete.mode === 'COMPLAINING'
    const home = this.world.peace.home === null ? null : this.world.buildings[this.world.peace.home]
    const labelPosition = flightPose(this.world) ?? (home && ['entering', 'resting'].includes(this.world.peace.activity) ? home : arrest?.caption ? this.world.police.car! : pete.mode === 'ARRESTED' ? arrest?.pete ?? pete : pete)
    this.peteLabel.setPosition((labelPosition.x + .5) * TILE, (labelPosition.y + .5) * TILE - (arrest?.active ? 59 : arrest?.caption ? 32 : complaining ? 29 : 15))
    const label = peteCaption(this.world)
    this.peteLabel.setVisible(label !== '' && (!peteUnavailable(this.world) || this.world.revenge.stage === 'stunned'))
    if (this.peteLabel.text !== label) {
      this.peteLabel.setText(label).setStyle({ fontSize: arrest?.caption ? '13px' : '9px', color: complaining ? '#56341a' : '#f8cf86', backgroundColor: complaining ? '#fff3c9' : '#17221cbb', padding: { x: 3, y: 2 } })
    }
    if (this.summaryWorld !== this.world || this.world.timeMs - this.summaryAt >= 100 || this.summaryRevision !== this.world.topologyRevision) {
      useGameStore.getState().publish(this.world)
      this.summaryWorld = this.world; this.summaryAt = this.world.timeMs; this.summaryRevision = this.world.topologyRevision
    }
    const state = useGameStore.getState()
    const inspected = state.inspected === null ? null : this.world.buildings[state.inspected]
    this.preview.clear()
    const mini = this.world.miniFactory
    if (mini?.anchor !== null && mini?.anchor !== undefined) {
      const next = miniLayout(mini.anchor)[mini.built]
      if (next) {
        this.preview.lineStyle(2, 0xf0d191, .8).strokeRect(next.tile % SIZE * TILE + 2, Math.floor(next.tile / SIZE) * TILE + 2, TILE - 4, TILE - 4)
        this.preview.fillStyle(0xb0d792, .5).fillRect(next.tile % SIZE * TILE + 3, Math.floor(next.tile / SIZE) * TILE + TILE - 7, (TILE - 6) * mini.elapsedMs / 3000, 4)
      }
    }
    if (this.world.miniFactory && ['placeGrove', 'placeIron', 'placeCopper'].includes(state.tool ?? '') && this.world.peace.home !== null) {
      const home = this.world.peace.home, hx = home % SIZE, hy = Math.floor(home / SIZE)
      this.preview.lineStyle(2, 0x96c77c, .5).strokeRect((hx - 10) * TILE, (hy - 10) * TILE, 21 * TILE, 21 * TILE)
      this.preview.lineStyle(2, 0xce9c73, .5).strokeRect((hx - 3) * TILE, (hy - 3) * TILE, 7 * TILE, 7 * TILE)
    }
    if (state.tool === null) drawGuidance(this.preview, this.world, TILE, !!state.peteInspection && state.petePathVisible, state.inspected, state.connectionVisible)
    const touchTarget = useGameStore.getState().touchPlacement
    if (touchTarget) {
      const { start, end, tool } = touchTarget
      const cells = ['placeGrove', 'placeIron', 'placeCopper'].includes(tool ?? '') ? brushTiles(end, end, 3).map(tile => ({ x: tile % SIZE, y: Math.floor(tile / SIZE) })) : tool === 'belt' || tool === 'powerPole' || tool === 'footbridge' ? planConstruction(this.world, start, end, tool, useGameStore.getState().direction, true).cells : [end]
      for (const cell of cells) this.preview.lineStyle(2, 0xf5d68b).strokeRect(cell.x * TILE + 1, cell.y * TILE + 1, TILE - 2, TILE - 2)
    }
    this.constructionLabel.setVisible(false)
    this.input.setDefaultCursor('default')
    if (state.spraySource !== null) {
      const source = this.world.buildings[state.spraySource]
      if (source?.kind !== 'sprinkler') useGameStore.getState().select(null)
      else {
        this.preview.lineStyle(2, 0x72d6ff, .8).strokeCircle((source.x + .5) * TILE, (source.y + .5) * TILE, SPRINKLER_RANGE * TILE)
        if (this.input.isOver) this.placementTooltip(this.input.activePointer, `Mit Wasser spritzen · 3 Felder · ${sprinklerPowered(this.world, state.spraySource) ? (source.manualReadyAtMs ?? 0) > this.world.timeMs ? '1 s Pause' : 'Bereit' : 'Benötigt 5 kW'} · Escape beendet`)
      }
      return
    }
    if (!state.touchActive && state.tool === null && !worldInputBlocked(state) && this.input.isOver && !this.rightPan.active) {
      const point = this.input.activePointer.positionToCamera(camera) as Phaser.Math.Vector2
      if (!peteHit(this.world, { x: point.x / TILE - .5, y: point.y / TILE - .5 }) && this.crateSupply.hit(this.world, point, TILE, camera.zoom) === null && buildingAt(this.world, Math.floor(point.x / TILE), Math.floor(point.y / TILE))?.kind === 'tree') this.input.setDefaultCursor('url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22%3E%3Ctext y=%2225%22 font-size=%2225%22%3E%F0%9F%AA%93%3C/text%3E%3C/svg%3E") 8 8, crosshair')
    }
    if (this.constructionDrag.active) { this.drawConstruction(this.input.activePointer); return }
    if (inspected?.kind === 'sprinkler') this.preview.lineStyle(1, 0x72d6ff, .7).strokeCircle((inspected.x + .5) * TILE, (inspected.y + .5) * TILE, SPRINKLER_RANGE * TILE)
    if (inspected?.kind === 'radar') this.preview.lineStyle(1, 0x9ad4ed, .7).strokeCircle((inspected.x + .5) * TILE, (inspected.y + .5) * TILE, RADAR_RANGE * TILE)
    if (inspected?.kind === 'powerPole') this.showCoverage(inspected, power.assignments[state.inspected!] ?? null)
    if (inspected) this.preview.lineStyle(2, 0xf3d282).strokeRect(inspected.x * TILE + 1, inspected.y * TILE + 1, TILE - 2, TILE - 2)
    if (state.tool === null && !worldInputBlocked(state) && this.input.isOver) {
      const pointer = this.input.activePointer, point = pointer.positionToCamera(camera) as Phaser.Math.Vector2
      if (this.crateSupply.hit(this.world, point, TILE, camera.zoom) !== null) this.placementTooltip(pointer, 'Unload 6 Wood into Pete’s crate')
    }
    this.poleLinks.setVisible(!worldInputBlocked(state) && state.tool === 'powerPole' && this.input.isOver)
    const pointer = this.input.activePointer
    if (!worldInputBlocked(state) && state.tool && !combatTool(state.tool) && this.input.isOver) {
      const p = pointer.positionToCamera(camera) as Phaser.Math.Vector2
      const rotation = this.placementRotation.preview()
      const x = rotation?.x ?? Math.floor(p.x / TILE), y = rotation?.y ?? Math.floor(p.y / TILE)
      const direction = rotation?.direction ?? state.direction
      if (state.tool === 'belt' || state.tool === 'footbridge') { this.drawConstructionPlan(pointer, planConstruction(this.world, { x, y }, { x, y }, state.tool, direction)); return }
      if (natureTool(state.tool)) {
        const waterMode = brushMode(state.tool)
        if (waterMode === 'water' || waterMode === 'land') {
          const protection = waterProtection(this.world)
          let blocked = 0, unchanged = 0, paintable = 0, reason = ''
          for (const i of brushTiles({ x, y }, { x, y }, state.brushSize)) {
            const error = waterEditError(this.world, i, waterMode, protection)
            const same = this.world.water[i] === (waterMode === 'water')
            if (error) { blocked++; reason ||= error } else if (same) unchanged++; else paintable++
            const color = error ? 0xe7a08d : same ? 0xa4c9df : waterMode === 'water' ? 0x8fcbd0 : 0xb2d08a
            const px = i % SIZE * TILE, py = Math.floor(i / SIZE) * TILE
            this.preview.fillStyle(color, .2).fillRect(px, py, TILE, TILE).lineStyle(1, color, .85).strokeRect(px + 1, py + 1, TILE - 2, TILE - 2)
            if (error) this.preview.lineBetween(px + 8, py + 8, px + 24, py + 24).lineBetween(px + 24, py + 8, px + 8, py + 24)
          }
          if (!paintable && !unchanged && !blocked) reason = 'Choose a tile inside the world.'
          this.placementTooltip(pointer, `${toolMetadata(state.tool).label} · Free
${paintable} paintable · ${unchanged} unchanged · ${blocked} protected
${reason || 'Drag to paint. Protected tiles are skipped.'}`)
          return
        }
        const previewSpecies = plantingSpecies(state.tool)
        const error = previewSpecies ? placementInfo(this.world, { x, y }, 'tree').error : state.tool === 'axe' && buildingAt(this.world, x, y)?.kind !== 'tree' ? 'Choose a tree to chop.' : brushMode(state.tool) !== undefined && this.world.water[y * SIZE + x] ? 'Only dry tiles are painted. Water stays clear.' : null
        this.placementTooltip(pointer, `${error ? '×' : '✓'} ${toolMetadata(state.tool).label} · Free${error ? `\n${error}` : ''}`)
        const mode = brushMode(state.tool), species = plantingSpecies(state.tool)
        if (mode !== undefined) {
          const color = mode === 'flowers' ? 0xe5c3a1 : mode === 'grass' ? 0xa6c27d : 0xc6bca7
          for (const i of brushTiles({ x, y }, { x, y }, state.brushSize)) {
            if (this.world.water[i]) { this.preview.lineStyle(1, 0xe7a08d, .6).strokeRect(i % SIZE * TILE + 2, Math.floor(i / SIZE) * TILE + 2, TILE - 4, TILE - 4); continue }
            this.preview.fillStyle(color, .2).fillRect(i % SIZE * TILE, Math.floor(i / SIZE) * TILE, TILE, TILE)
            this.preview.lineStyle(1, color, .7).strokeRect(i % SIZE * TILE + 1, Math.floor(i / SIZE) * TILE + 1, TILE - 2, TILE - 2)
          }
        } else {
          const error = state.tool === 'placeGrove' ? groveError(this.world, x, y) : state.tool === 'placeIron' ? ironError(this.world, x, y) : state.tool === 'placeCopper' ? copperError(this.world, x, y) : species ? placementError(this.world, x, y, 'tree') : buildingAt(this.world, x, y)?.kind !== 'tree'
          const color = error ? 0xe5a08d : 0xb2d08a
          this.preview.fillStyle(color, .2).fillRect(x * TILE, y * TILE, TILE, TILE)
          this.preview.lineStyle(2, color).strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2)
          if (['placeGrove', 'placeIron', 'placeCopper'].includes(state.tool ?? '') && inside(x, y)) {
            this.preview.lineStyle(2, color).strokeRect((x - 1) * TILE, (y - 1) * TILE, TILE * 3, TILE * 3)
          }
          if (species && inside(x, y) && !error) drawTree(this.preview, this.world, { kind: 'tree', x, y, species, origin: 'manual', bornAtMs: this.world.timeMs, nextReproductionAtMs: this.world.timeMs + MATURE_TREE_MS + REPRODUCTION_MS }, TILE)
        }
        return
      }
      if (state.tool === 'spiderWeb' && peteHit(this.world, { x: p.x / TILE - .5, y: p.y / TILE - .5 })) this.preview.lineStyle(2, 0xeaf3f5).strokeCircle((this.world.pete.x + .5) * TILE, (this.world.pete.y + .5) * TILE, .8 * TILE)
      if (state.tool === 'sprinkler') this.preview.lineStyle(1, 0x72d6ff, .7).strokeCircle((x + .5) * TILE, (y + .5) * TILE, SPRINKLER_RANGE * TILE)
      if (state.tool === 'radar') this.preview.lineStyle(1, 0x9ad4ed, .7).strokeCircle((x + .5) * TILE, (y + .5) * TILE, RADAR_RANGE * TILE)
      const removalTarget = state.tool === 'remove' ? buildingAt(this.world, x, y) : null
      if (removalTarget?.kind === 'footbridge') this.placementTooltip(pointer, removalError(this.world, x, y) ?? 'Remove entire wooden footbridge. No Wood refund.')
      if (removalTarget?.kind === 'belt' && removalTarget.bridge) this.placementTooltip(pointer, 'Remove entire bridge crossing. Items are lost; no Wood refund.')
      if (state.tool === 'powerPole') this.showCoverage({ x, y }, null)
      if (state.tool === 'splitter') {
        const ports = splitterPorts({ x, y, direction })
        for (const [port, color] of [[ports.input, 0xffbd6c], [ports.outputs[0], 0x8df0b3], [ports.outputs[1], 0x85d1e8]] as const) {
          if (!inside(port.x, port.y)) continue
          this.preview.lineStyle(1, color, .8).strokeRect(port.x * TILE + 5, port.y * TILE + 5, TILE - 10, TILE - 10)
          this.preview.lineBetween((x + .5) * TILE, (y + .5) * TILE, (port.x + .5) * TILE, (port.y + .5) * TILE)
        }
        const left = splitterDirections(direction)[1]
        this.arrow(x * TILE + offsets[left].x * 8, y * TILE + offsets[left].y * 8, left, 0x85d1e8, .7)
      }
      if (state.tool === 'inserter') {
        const ports = inserterPorts({ x, y, direction })
        for (const [port, portColor] of [[ports.pickup, 0xffbd6c], [ports.drop, 0x8df0b3]] as const) {
          if (!inside(port.x, port.y)) continue
          this.preview.lineStyle(2, portColor, .9).strokeRect(port.x * TILE + 3, port.y * TILE + 3, TILE - 6, TILE - 6)
          this.preview.lineStyle(1, portColor, .8).lineBetween((x + .5) * TILE, (y + .5) * TILE, (port.x + .5) * TILE, (port.y + .5) * TILE)
        }
      }
      const info = state.tool !== 'remove' && state.tool !== 'spiderWeb' && state.tool !== 'playfulSpray' ? rotation?.info ?? placementInfo(this.world, { x, y }, state.tool, direction) : null
      const existingPole = state.tool === 'powerPole' && buildingAt(this.world, x, y)?.kind === 'powerPole'
      if (info) this.placementTooltip(pointer, `${existingPole || info.state === 'valid' ? '✓' : info.state === 'unaffordable' ? '◇' : '×'} ${toolMetadata(state.tool).label}\n${info.wood ? `Cost: ${info.wood} Wood · You have ${info.available}` : 'Cost: Free'}${existingPole ? '\nExisting pole · Drag to extend.' : info.error ? `\n${info.error}` : ''}`)
      if (state.tool === 'powerPole') this.previewPole(x, y)
      const error = existingPole ? null : state.tool === 'spiderWeb' ? inside(x, y) ? null : 'Choose a tile inside the world.' : state.tool === 'remove' ? removalError(this.world, x, y) : info?.error
      const color = info?.state === 'unaffordable' ? 0xe5c578 : error ? 0xf08172 : 0x8df0b3
      this.preview.fillStyle(color, .25).fillRect(x * TILE, y * TILE, TILE, TILE)
      this.preview.lineStyle(2, color).strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2)
      if (info?.state === 'unaffordable') this.preview.lineStyle(2, color).lineBetween(x * TILE + 16, y * TILE + 5, x * TILE + 27, y * TILE + 16).lineBetween(x * TILE + 27, y * TILE + 16, x * TILE + 16, y * TILE + 27).lineBetween(x * TILE + 16, y * TILE + 27, x * TILE + 5, y * TILE + 16).lineBetween(x * TILE + 5, y * TILE + 16, x * TILE + 16, y * TILE + 5)
      else if (error) this.preview.lineStyle(2, color).lineBetween(x * TILE + 5, y * TILE + 5, x * TILE + 27, y * TILE + 27).lineBetween(x * TILE + 27, y * TILE + 5, x * TILE + 5, y * TILE + 27)
      if (state.tool === 'treehouse' && inside(x, y) && !error) drawTreehouse(this.preview, this.world, { kind: 'treehouse', x, y, placedAtMs: this.world.timeMs }, TILE, true)
      if (rotationBuilding(state.tool)) this.arrow(x * TILE, y * TILE, direction, color)
    }
  }
}
