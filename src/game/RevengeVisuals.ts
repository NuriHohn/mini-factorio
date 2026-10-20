import type Phaser from 'phaser'
import type { CombatImpact } from '../simulation/revenge'
import { BREAKDOWN_MS, peteUnavailable } from '../simulation/revenge'
import type { World } from '../simulation/world'

function star(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number) {
  g.fillTriangle(x, y - size, x - size, y + size / 2, x + size, y + size / 2)
  g.fillTriangle(x, y + size, x - size, y - size / 2, x + size, y - size / 2)
}

export class RevengeVisuals {
  private world: World | null = null
  private impacts: (CombatImpact & { label?: Phaser.GameObjects.Text })[] = []
  private lastBlast = -1
  private name: Phaser.GameObjects.Text | null = null
  private reset(world: World) {
    if (this.world === world) return
    this.destroy(); this.world = world; this.lastBlast = world.revenge.blast?.atMs ?? -1
  }
  impact(result: CombatImpact, world: World, camera: Phaser.Cameras.Scene2D.Camera) {
    this.reset(world)
    if (this.impacts.length >= 24) this.impacts.shift()?.label?.destroy()
    this.impacts.push(result)
    if (result.tool === 'lightningBeam' && result.hit) camera.shake(140, .003)
  }
  destroy() {
    for (const impact of this.impacts) impact.label?.destroy()
    this.impacts = []; this.name?.destroy(); this.name = null; this.world = null
  }
  draw(g: Phaser.GameObjects.Graphics, world: World, tile: number, scene: Phaser.Scene) {
    this.reset(world)
    const r = world.revenge, boss = r.boss
    if (boss) {
      const breaking = r.stage === 'defeating', t = breaking ? Math.min(1, 1 - (r.untilMs - world.timeMs) / BREAKDOWN_MS) : 0
      const hit = this.impacts.findLast(i => i.hit && world.timeMs - i.atMs < 400)
      const wobble = hit || breaking ? Math.sin(world.timeMs / 25) * (breaking ? 5 : 3) : 0
      const x = (boss.x + .5) * tile + wobble, y = (boss.y + .5) * tile
      const lift = r.stage === 'stomp' ? 35 : 0
      const stride = boss.next === null ? 0 : Math.sin(boss.travelMs / 160) * 7
      g.fillStyle(0x090f14, .5).fillEllipse(x, y + 25, 74, 25)
      g.lineStyle(9, 0x586879).lineBetween(x - 19, y, x - 26, y + 22 - lift + stride).lineBetween(x + 19, y, x + 26, y + 22 - stride)
      g.fillStyle(0x9faab5).fillRoundedRect(x - 38, y + 18 - lift + stride, 28, 12, 3).fillRoundedRect(x + 10, y + 18 - stride, 28, 12, 3)
      g.fillStyle(boss.phase === 2 ? 0x9c4335 : 0x526b85).fillRoundedRect(x - 29, y - 27 + t * 14, 58, 45 - t * 12, 8)
      g.lineStyle(3, 0xc2cbd4).strokeRoundedRect(x - 29, y - 27, 58, 45, 8)
      g.fillStyle(0x102737).fillEllipse(x, y - 16, 31, 25)
      // Pete is visible in the cockpit; during breakdown he shoots upward out of it.
      const ejectY = y - 17 - Math.sin(t * Math.PI / 2) * 55
      g.fillStyle(0x91dc60).fillCircle(x, ejectY, 8)
      g.fillStyle(0xffd67a).fillCircle(x - 3, ejectY - 2, 2).fillCircle(x + 3, ejectY - 2, 2)
      g.lineStyle(2, 0x315021).lineBetween(x - 4, ejectY + 4, x + 4, ejectY + 4)
      g.fillStyle(0x263746).fillRect(x - 40, y - 10, 16, 14).fillRect(x + 24, y - 10, 16, 14)
      g.fillStyle(0x74d4ff, .7 + Math.sin(world.timeMs / 120) * .3).fillCircle(x - 34, y - 3, 5).fillCircle(x + 34, y - 3, 5)
      for (let i = 0; i < 5; i++) g.fillStyle(0xd0a15b).fillCircle(x - 20 + i * 10, y + 10, 2)
      if (r.stage === 'stomp') {
        g.fillStyle(0xd7e0e6).fillRoundedRect(x - 38, y + 18 - lift + stride, 28, 12, 3)
        g.lineStyle(2, 0xffd75e).strokeRoundedRect(x - 38, y + 18 - lift + stride, 28, 12, 3)
      }
      if (breaking) for (let i = 0; i < 9; i++) {
        const a = i * 2.4 + world.timeMs / 140
        g.fillStyle(i % 2 ? 0xffc95b : 0x63727c, 1 - t * .5).fillCircle(x + Math.cos(a) * 26 * t, y - 8 - t * (i * 7), 3 + t * 8)
      }
      if (!this.name) this.name = scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '10px', color: '#ffe3a2', backgroundColor: '#17222bdd', padding: { x: 4, y: 3 } }).setOrigin(.5, 1).setDepth(9)
      this.name.setPosition(x, y - 36).setText(breaking ? 'DOES NOT COMPUTE! · EJECT!' : r.stage === 'stomp' ? 'STOMP INCOMING!' : `REVENGE-O-MATIC 3000 · ${boss.hp} HP`)
    } else { this.name?.destroy(); this.name = null }
    if (r.stage === 'stunned') {
      const x = (world.pete.x + .5) * tile, y = (world.pete.y + .5) * tile - 20
      for (let i = 0; i < 5; i++) { const a = world.timeMs / 250 + i * Math.PI * 2 / 5; g.fillStyle(0xffda6e); star(g, x + Math.cos(a) * 16, y + Math.sin(a) * 6, 3) }
    }
    const blast = r.blast
    if (blast) {
      if (blast.atMs !== this.lastBlast) { this.lastBlast = blast.atMs; if (blast.kind === 'stomp') scene.cameras.main.shake(220, .005) }
      const t = (world.timeMs - blast.atMs) / 1000, x = (blast.position.x + .5) * tile, y = (blast.position.y + .5) * tile
      const radius = (blast.kind === 'emp' ? 3 : 5) * tile
      g.fillStyle(blast.kind === 'emp' ? 0x50bfff : 0xc5a27b, (1 - t) * .3).fillCircle(x, y, radius * t)
      g.lineStyle(5 * (1 - t) + 1, blast.kind === 'emp' ? 0x82dcff : 0xf6d5a2, 1 - t).strokeCircle(x, y, radius * t)
      for (let i = 0; i < 18; i++) {
        const a = i * Math.PI / 9, d = radius * t
        g.lineStyle(2, blast.kind === 'emp' ? 0xe4f9ff : 0xc8ab83, 1 - t).lineBetween(x + Math.cos(a) * d, y + Math.sin(a) * d, x + Math.cos(a + .12) * (d + 12), y + Math.sin(a + .12) * (d + 12))
      }
    }
    this.impacts = this.impacts.filter(impact => {
      const t = (world.timeMs - impact.atMs) / 900
      if (t >= 1) { impact.label?.destroy(); return false }
      const x = (impact.position.x + .5) * tile, y = (impact.position.y + .5) * tile
      const color = impact.tool === 'flySwatter' ? 0xffd75e : impact.tool === 'drill' ? 0xff9d43 : 0x74d8ff
      const caption = impact.tool === 'flySwatter' ? impact.hit ? 'SMACK!' : 'PLOP' : impact.tool === 'drill' ? impact.hit ? 'BRRRR!' : 'DRRR…' : impact.hit ? 'ZAP!' : 'KRAK!'
      if (!impact.label) impact.label = scene.add.text(x, y, `${caption}${impact.hit ? ` -${impact.damage}` : ' MISS'}`, { fontFamily: 'monospace', fontStyle: 'bold', fontSize: impact.hit ? '15px' : '11px', color: `#${color.toString(16)}`, stroke: '#16201b', strokeThickness: 3 }).setOrigin(.5, 1).setDepth(10)
      impact.label.setPosition(x, y - 12 - t * 24).setAlpha(1 - t)
      g.lineStyle(3, color, 1 - t).strokeCircle(x, y, 8 + t * (impact.tool === 'lightningBeam' ? 38 : 18))
      if (impact.tool === 'lightningBeam') {
        g.lineStyle(4 * (1 - t), 0xc9efff, 1 - t)
        for (let i = 0; i < 6; i++) g.lineBetween(x + (i % 2 ? -8 : 8), y - 130 + i * 22, x + (i % 2 ? 8 : -8), y - 108 + i * 22)
      }
      if (impact.tool === 'flySwatter') g.fillStyle(0xdbe8b5, 1 - t).fillRect(x - 8, y - 8, 16, 12)
      if (impact.tool === 'drill') g.fillStyle(0xabbac4, 1 - t).fillTriangle(x - 8, y - 25, x + 8, y - 25, x, y)
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, d = 10 + t * 25
        g.fillStyle(impact.hit ? color : 0xbca37f, 1 - t)
        if (impact.hit && impact.tool === 'flySwatter') star(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 4)
        else g.fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, impact.hit ? 3 : 4)
      }
      return true
    })
    // No gameplay writes, RNG calls or authoritative timers occur in this renderer.
    return peteUnavailable(world) && r.stage !== 'stunned'
  }
}
