import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { FactoryScene } from './FactoryScene'
export function GameCanvas() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!host.current) return
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: host.current, backgroundColor: '#243c2c', pixelArt: true,
      scale: { mode: Phaser.Scale.RESIZE, width: host.current.clientWidth, height: host.current.clientHeight },
      scene: FactoryScene,
    })
    const observer = new ResizeObserver(() => {
      if (host.current?.clientWidth && host.current.clientHeight) game.scale.resize(host.current.clientWidth, host.current.clientHeight)
    })
    observer.observe(host.current)
    return () => { observer.disconnect(); game.destroy(true) }
  }, [])
  return <div ref={host} className="game-canvas" aria-label="Factory world: WASD to move, scroll to zoom, 1 miner, 2 belt, 3 storage, 4 furnace, 5 generator, 6 power pole, P electricity overlay, R rotate, X remove, Escape inspect." />
}

