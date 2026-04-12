import Phaser from 'phaser'
import { COLORS } from '../utils/constants.js'

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    const playerGfx = this.make.graphics({ x: 0, y: 0, add: false })
    playerGfx.fillStyle(0xffffff)
    playerGfx.fillCircle(8, 8, 6)
    playerGfx.lineStyle(1, 0xcccccc)
    playerGfx.lineBetween(5, 13, 3, 18)
    playerGfx.lineBetween(11, 13, 13, 18)
    playerGfx.generateTexture('player', 16, 20)
    playerGfx.destroy()

    const floorGfx = this.make.graphics({ x: 0, y: 0, add: false })
    floorGfx.fillStyle(COLORS.FLOOR)
    floorGfx.fillRect(0, 0, 16, 16)
    floorGfx.generateTexture('floor_tile', 16, 16)
    floorGfx.destroy()

    const wallGfx = this.make.graphics({ x: 0, y: 0, add: false })
    wallGfx.fillStyle(COLORS.WALL)
    wallGfx.fillRect(0, 0, 16, 16)
    wallGfx.generateTexture('wall_tile', 16, 16)
    wallGfx.destroy()

    const pg = this.make.graphics({ add: false })
    pg.fillStyle(0xffffff, 1)
    pg.fillCircle(4, 4, 3)
    pg.generateTexture('projectile', 8, 8)
    pg.destroy()

    const eg = this.make.graphics({ add: false })
    eg.fillStyle(0x9933cc, 1)
    eg.fillCircle(4, 4, 3)
    eg.generateTexture('enemy_proj', 8, 8)
    eg.destroy()

    const cx = 12
    const cy = 12
    const bodyR = 8
    const legLen = 10
    const legAngles = [150, 180, 210, 30, 0, 330, 120, 60]

    const spiderGfx = this.make.graphics({ add: false })
    spiderGfx.fillStyle(0x4a1a6e, 1)
    spiderGfx.fillCircle(cx, cy, bodyR)
    spiderGfx.lineStyle(1, 0x3a1255, 1)
    legAngles.forEach((deg) => {
      const rad = Phaser.Math.DegToRad(deg)
      const sx = cx + Math.cos(rad) * bodyR
      const sy = cy + Math.sin(rad) * bodyR
      const ex = sx + Math.cos(rad) * legLen
      const ey = sy + Math.sin(rad) * legLen
      spiderGfx.lineBetween(sx, sy, ex, ey)
    })
    spiderGfx.fillStyle(0xff2222, 1)
    spiderGfx.fillCircle(10, 9, 1.5)
    spiderGfx.fillCircle(14, 9, 1.5)
    spiderGfx.generateTexture('spider_spitter', 24, 24)
    spiderGfx.destroy()
  }

  create() {
    this.scene.start('MainMenuScene')
  }
}
