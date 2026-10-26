import type Phaser from 'phaser'
import type { FuelDepot, SteamWork } from '../simulation/world'
export function drawFuelDepot(g: Phaser.GameObjects.Graphics, b: FuelDepot): void {
  const x=b.x*32,y=b.y*32
  g.fillStyle(0x26353d).fillRect(x+2,y+9,28,22)
  g.lineStyle(2,0xb2a178).strokeRect(x+2,y+9,28,22)
  const count = b.inventory.coal+b.inventory.coalBriquette
  for(let n=0;n<Math.min(8,count);n++) { const px=x+6+n%4*6,py=y+26-Math.floor(n/4)*7;g.fillStyle(n<b.inventory.coalBriquette?0xa1a7ae:0x535c65).fillTriangle(px-3,py+2,px,py-5,px+4,py+2) }
}
export function drawSteamWork(g: Phaser.GameObjects.Graphics, b: SteamWork): void {
  const x=b.x*32,y=b.y*32,phase=b.elapsedMs/(b.kind==='steamWorkshop'?6000:8000),lift=(1-Math.cos(phase*Math.PI*2))*7
  g.fillStyle(0x293b44).fillRect(x+1,y+25,30,6)
  g.lineStyle(3,0xc6af7a).lineBetween(x+5,y+27,x+5,y+3).lineBetween(x+27,y+27,x+27,y+3).lineBetween(x+5,y+3,x+27,y+3)
  if(b.kind==='steamWorkshop') {
    g.fillStyle(0x789aa5).fillRect(x+9,y+6+lift,14,8)
    g.lineStyle(3,0xadc7ce).lineBetween(x+16,y+4,x+16,y+7+lift)
    g.fillStyle(0xbda26d).fillRect(x+9,y+23,14,3)
  } else {
    g.lineStyle(1,0xd7d4bb).lineBetween(x+16,y+4,x+16,y+20-lift)
    g.fillStyle(0x859ca4).fillRect(x+10,y+18-lift,12,7)
    g.lineStyle(2,0xd3b57a).strokeCircle(x+16,y+4,4)
  }
}
