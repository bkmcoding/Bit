import Phaser from 'phaser'
import { HUD_DEPTH } from '../utils/constants.js'

const CARD_W = 120
const CARD_H = 160
const RADIUS = 8

export default class UpgradeCard {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {{ id: string, name: string, description: string, rarity: string, icon: string }} upgrade
   * @param {(id: string) => void} onSelect
   */
  constructor(scene, x, y, upgrade, onSelect) {
    this.scene = scene
    this.upgrade = upgrade
    this.onSelect = onSelect

    const halfW = CARD_W / 2
    const halfH = CARD_H / 2

    this.container = scene.add.container(x, y)
    this.container.setDepth(HUD_DEPTH + 2)

    const bg = scene.add.graphics()
    bg.fillStyle(0x222233, 1)
    bg.fillRoundedRect(-halfW, -halfH, CARD_W, CARD_H, RADIUS)
    const borderColor = upgrade.rarity === 'rare' ? 0xffaa00 : 0x888899
    bg.lineStyle(2, borderColor, 1)
    bg.strokeRoundedRect(-halfW, -halfH, CARD_W, CARD_H, RADIUS)
    this.container.add(bg)

    const iconGfx = scene.add.graphics()
    const iconColor = upgrade.rarity === 'rare' ? 0xffaa00 : 0x6677aa
    iconGfx.fillStyle(iconColor, 1)
    iconGfx.fillCircle(0, -halfH + 36, 20)
    this.container.add(iconGfx)

    const nameText = scene.add
      .text(0, -halfH + 72, upgrade.name, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5, 0)
    this.container.add(nameText)

    const descText = scene.add
      .text(0, -halfH + 90, upgrade.description, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '9px',
        color: '#aaaaaa',
        align: 'center',
        wordWrap: { width: CARD_W - 12 },
      })
      .setOrigin(0.5, 0)
    this.container.add(descText)

    const hit = new Phaser.Geom.Rectangle(-halfW, -halfH, CARD_W, CARD_H)
    this.container.setInteractive(hit, Phaser.Geom.Rectangle.Contains)
    this.container.on('pointerdown', () => onSelect(upgrade.id))
    this.container.on('pointerover', () => {
      scene.tweens.add({
        targets: this.container,
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 80,
        ease: 'Sine.easeOut',
      })
    })
    this.container.on('pointerout', () => {
      scene.tweens.add({
        targets: this.container,
        scaleX: 1,
        scaleY: 1,
        duration: 80,
        ease: 'Sine.easeOut',
      })
    })
  }

  destroy() {
    this.container.destroy(true)
  }
}
