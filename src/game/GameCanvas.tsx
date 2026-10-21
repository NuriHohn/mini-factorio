import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { FramePacer } from './framePacing'
import { useGraphicsSettings } from '../state/graphicsSettings'
import { PerformanceOverlay } from './GraphicsOptions'
import { FactoryScene } from './FactoryScene'
export function GameCanvas() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!host.current) return
    const pacer = new FramePacer()
    let frames = 0, workMs = 0, measuredAt = 0
    const visibility = () => { pacer.reset(); frames = 0; workMs = 0; measuredAt = 0 }
    document.addEventListener('visibilitychange', visibility)
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: host.current, backgroundColor: '#243c2c', pixelArt: true,
      scale: { mode: Phaser.Scale.RESIZE, width: host.current.clientWidth, height: host.current.clientHeight },
      scene: FactoryScene,
      fps: { smoothStep: false },
      callbacks: { postBoot: game => {
        const step = game.step.bind(game)
        game.step = (time: number) => {
          const settings = useGraphicsSettings.getState()
          const delta = pacer.frame(time, settings.mode, document.hidden)
          if (delta === null) return
          const start = settings.diagnostics ? performance.now() : 0
          step(time, delta)
          if (!settings.diagnostics) { frames = 0; workMs = 0; measuredAt = time; return }
          if (!measuredAt) { measuredAt = time; return }
          frames++; workMs += performance.now() - start
          if (time - measuredAt >= 1000) {
            const scene = game.scene.getScenes(true).find(scene => scene instanceof FactoryScene) as FactoryScene | undefined
            useGraphicsSettings.setState({ stats: {
              fps: frames * 1000 / (time - measuredAt), frameMs: (time - measuredAt) / frames,
              workMs: workMs / frames, tickMs: scene?.tickCostMs ?? 0, buildings: scene?.drawnBuildings ?? 0,
            } })
            frames = 0; workMs = 0; measuredAt = time
          }
        }
      } },
    })
    const observer = new ResizeObserver(() => {
      if (host.current?.clientWidth && host.current.clientHeight) game.scale.resize(host.current.clientWidth, host.current.clientHeight)
    })
    observer.observe(host.current)
    return () => { document.removeEventListener('visibilitychange', visibility); observer.disconnect(); game.destroy(true) }
  }, [])
  return <><PerformanceOverlay /><div ref={host} className="game-canvas" aria-label="Factory world: WASD to move, scroll to zoom, 1 miner, 2 belt, 3 storage, 4 furnace, 5 generator, 6 power pole, 7 assembler, 8 inserter, 9 radar trap, 0 splitter, P electricity overlay, R rotate, X remove, Escape inspect." /></>
}

