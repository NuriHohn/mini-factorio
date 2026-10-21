import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
import type Phaser from 'phaser'
import type { CombatImpact } from '../simulation/revenge'
import { BREAKDOWN_MS, STOMP_MS, peteUnavailable } from '../simulation/revenge'
import type { World } from '../simulation/world'

function star(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number) {
  g.fillTriangle(x, y - size, x - size, y + size / 2, x + size, y + size / 2)
  g.fillTriangle(x, y + size, x - size, y - size / 2, x + size, y - size / 2)
}

export class RevengeVisuals {
  private world: World | null = null
  private impacts: (CombatImpact & { label?: Phaser.GameObjects.Text })[] = []
  private name: Phaser.GameObjects.Text | null = null
  private reset(world: World) {
    if (this.world === world) return
    this.destroy(); this.world = world
  }
  impact(result: CombatImpact, world: World) {
    this.reset(world)
    if (this.impacts.length >= 24) this.impacts.shift()?.label?.destroy()
    this.impacts.push(result)
  }
  destroy() {
    for (const impact of this.impacts) impact.label?.destroy()
    this.impacts = []; this.name?.destroy(); this.name = null; this.world = null
  }
  draw(g: Phaser.GameObjects.Graphics, world: World, tile: number, scene: Phaser.Scene, view?: Viewport) {
    this.reset(world)
    const r = world.revenge, boss = r.boss
    if (boss && visiblePoint(view, (boss.x + .5) * tile, (boss.y + .5) * tile, 400)) {
      const breaking = r.stage === 'defeating', t = breaking ? Math.min(1, 1 - (r.untilMs - world.timeMs) / BREAKDOWN_MS) : 0
      const hit = this.impacts.findLast(i => i.hit && world.timeMs - i.atMs < 400)
      const wobble = hit || breaking ? Math.sin(world.timeMs / 180) * (breaking ? 2 : 1) : 0
      const x = (boss.x + .5) * tile + wobble, y = (boss.y + .5) * tile
      const stomp = r.stage === 'stomp' ? 1 - (r.untilMs - world.timeMs) / STOMP_MS : 0
      const lift = 35 * Math.sin(Math.min(1, stomp) * Math.PI)
      const stride = boss.next === null ? 0 : Math.sin(boss.travelMs / 1500 * Math.PI) * 5
      const weight = boss.next === null ? 0 : Math.sin(boss.travelMs / 1500 * Math.PI) * 2
      g.fillStyle(0x090f14, .5).fillEllipse(x, y + 25, 74, 25)
      g.lineStyle(9, 0x586879).lineBetween(x - 19, y, x - 26, y + 22 - lift + stride).lineBetween(x + 19, y, x + 26, y + 22 - stride)
      g.fillStyle(0x9faab5).fillRoundedRect(x - 38, y + 18 - lift + stride, 28, 12, 3).fillRoundedRect(x + 10, y + 18 - stride, 28, 12, 3)
      g.fillStyle(boss.phase === 2 ? 0x9c4335 : 0x526b85).fillRoundedRect(x - 29, y - 27 + t * 14 + weight, 58, 45 - t * 12, 8)
      g.lineStyle(3, 0xc2cbd4).strokeRoundedRect(x - 29, y - 27, 58, 45, 8)
      g.fillStyle(0x102737).fillEllipse(x, y - 16, 31, 25)
      // Pete is visible in the cockpit; during breakdown he shoots upward out of it.
      const ejectY = y - 17 - Math.sin(t * Math.PI / 2) * 55
      g.fillStyle(0x91dc60).fillCircle(x, ejectY, 8)
      g.fillStyle(0xffd67a).fillCircle(x - 3, ejectY - 2, 2).fillCircle(x + 3, ejectY - 2, 2)
      g.lineStyle(2, 0x315021).lineBetween(x - 4, ejectY + 4, x + 4, ejectY + 4)
      g.fillStyle(0x263746).fillRect(x - 40, y - 10, 16, 14).fillRect(x + 24, y - 10, 16, 14)
      g.fillStyle(0x74d4ff, .6 + Math.sin(world.timeMs / 450) * .1).fillCircle(x - 34, y - 3, 5).fillCircle(x + 34, y - 3, 5)
      for (let i = 0; i < 5; i++) g.fillStyle(0xd0a15b).fillCircle(x - 20 + i * 10, y + 10, 2)
      if (r.stage === 'stomp') {
        g.fillStyle(0xd7e0e6).fillRoundedRect(x - 38, y + 18 - lift + stride, 28, 12, 3)
        g.lineStyle(2, 0xffd75e).strokeRoundedRect(x - 38, y + 18 - lift + stride, 28, 12, 3)
      }
      if (breaking) for (let i = 0; i < 9; i++) {
        const a = i * 2.4 + t * 1.2
        g.fillStyle(i % 2 ? 0xe7bf76 : 0x89958c, 1 - t * .5).fillCircle(x + Math.cos(a) * 26 * t, y - 8 - t * (i * 7), 3 + t * 8)
      }
      const target = boss.target === null ? null : world.buildings[boss.target]
      const charging = r.stage === 'hunting' && target && boss.next === null && Math.hypot(target.x - boss.x, target.y - boss.y) <= 6 && boss.empAtMs - world.timeMs <= 1600
      if (charging) {
        const charge = Math.max(0, 1 - (boss.empAtMs - world.timeMs) / 1600)
        g.lineStyle(2, 0x9ac6ca, .25 + charge * .35).strokeCircle((target.x + .5) * tile, (target.y + .5) * tile, 3 * tile)
        g.lineStyle(2, 0xb8d8cd, .7).strokeCircle(x - 34, y - 3, 7 + charge * 5).strokeCircle(x + 34, y - 3, 7 + charge * 5)
      }
      if (!this.name) this.name = scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '10px', color: '#ffe3a2', backgroundColor: '#17222bdd', padding: { x: 4, y: 3 } }).setOrigin(.5, 1).setDepth(9)
      this.name.setPosition(x, y - 36).setText(breaking ? '…' : r.stage === 'stomp' ? '!' : charging ? 'ϟ' : '').setVisible(breaking || r.stage === 'stomp' || !!charging)
    } else { this.name?.destroy(); this.name = null }
    if (r.stage === 'stunned' && visiblePoint(view, (world.pete.x + .5) * tile, (world.pete.y + .5) * tile, 64)) {
      const x = (world.pete.x + .5) * tile, y = (world.pete.y + .5) * tile - 20
      for (let i = 0; i < 5; i++) { const a = world.timeMs / 250 + i * Math.PI * 2 / 5; g.fillStyle(0xffda6e); star(g, x + Math.cos(a) * 16, y + Math.sin(a) * 6, 3) }
    }
    const blast = r.blast
    if (blast && visiblePoint(view, (blast.position.x + .5) * tile, (blast.position.y + .5) * tile, 200)) {
      const t = (world.timeMs - blast.atMs) / 1000, x = (blast.position.x + .5) * tile, y = (blast.position.y + .5) * tile
      const radius = (blast.kind === 'emp' ? 3 : 5) * tile
      g.fillStyle(blast.kind === 'emp' ? 0x50bfff : 0xc5a27b, (1 - t) * .1).fillCircle(x, y, radius * t)
      g.lineStyle(2 * (1 - t) + 1, blast.kind === 'emp' ? 0x8bbfc9 : 0xd5b486, 1 - t).strokeCircle(x, y, radius * t)
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, d = radius * t
        g.lineStyle(2, blast.kind === 'emp' ? 0xa9cbd0 : 0xc8ab83, 1 - t).lineBetween(x + Math.cos(a) * d, y + Math.sin(a) * d, x + Math.cos(a + .12) * (d + 12), y + Math.sin(a + .12) * (d + 12))
      }
    }
    this.impacts = this.impacts.filter(impact => {
      const t = (world.timeMs - impact.atMs) / 1200
      if (t >= 1) { impact.label?.destroy(); return false }
      const fade = Math.min(1, (1 - t) / .35), ease = t * (2 - t)
      const x = (impact.position.x + .5) * tile, y = (impact.position.y + .5) * tile
      if (!visiblePoint(view, x, y, 160)) { impact.label?.setVisible(false); return true }
      impact.label?.setVisible(true)
      const color = impact.tool === 'flySwatter' ? 0xe9c575 : impact.tool === 'drill' ? 0xdbac75 : 0x91becf
      const caption = impact.hit ? `−${impact.damage}` : '·'
      if (!impact.label) impact.label = scene.add.text(x, y, caption, { fontFamily: 'monospace', fontStyle: 'bold', fontSize: impact.hit ? '15px' : '11px', color: `#${color.toString(16)}`, stroke: '#16201b', strokeThickness: 3 }).setOrigin(.5, 1).setDepth(10)
      impact.label.setPosition(x, y - 12 - ease * 24).setAlpha(fade)
      g.lineStyle(2, color, fade * .55).strokeCircle(x, y, 8 + t * (impact.tool === 'lightningBeam' ? 38 : 18))
      if (impact.tool === 'lightningBeam') {
        g.lineStyle(2, 0xa4cbd5, fade * .75)
        for (let i = 0; i < 6; i++) g.lineBetween(x + (i % 2 ? -8 : 8), y - 130 + i * 22, x + (i % 2 ? 8 : -8), y - 108 + i * 22)
      }
      if (impact.tool === 'flySwatter') {
        const lift = Math.sin(Math.min(1, t * 3) * Math.PI) * 12
        g.lineStyle(3, 0xbca37a, fade).lineBetween(x + 1, y - 6 - lift, x + 13, y - 29 - lift)
        g.lineStyle(2, 0xcad8b5, fade).strokeRoundedRect(x - 10, y - 8 - lift, 20, 14, 3)
        for (let i = -1; i <= 1; i++) g.lineBetween(x + i * 5, y - 7 - lift, x + i * 5, y + 5 - lift)
      }
      if (impact.tool === 'drill') {
        const drill = Math.sin(t * Math.PI * 8) * (1 - t) * 2
        g.fillStyle(0x8fa7a8, fade).fillRoundedRect(x - 7 + drill, y - 32, 14, 12, 3)
        g.fillStyle(0xb9c8bd, fade).fillTriangle(x - 6 + drill, y - 20, x + 6 + drill, y - 20, x, y)
      }
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5, d = 10 + t * 25
        g.fillStyle(impact.hit ? color : 0xbca37f, fade * .75)
        if (impact.hit && impact.tool === 'flySwatter') star(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 4)
        else g.fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, impact.hit ? 3 : 4)
      }
      return true
    })
    // No gameplay writes, RNG calls or authoritative timers occur in this renderer.
    return peteUnavailable(world) && r.stage !== 'stunned'
  }
}
