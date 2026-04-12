import Phaser from 'phaser'
import UpgradeCard from '../ui/UpgradeCard.js'
import UpgradeSystem from '../systems/UpgradeSystem.js'
import { RunState } from '../systems/RunState.js'
import { HUD_DEPTH, ROOM_HEIGHT, ROOM_WIDTH } from '../utils/constants.js'

export default class UpgradeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UpgradeScene' })
  }

  create() {
    /** @type {{ upgrades?: Array<{ id: string, name: string, description: string, rarity: string, icon: string }> }} */
    const data = this.scene.settings.data || {}
    const upgrades = data.upgrades || []

    const overlay = this.add.graphics()
    overlay.fillStyle(0x000000, 0.75)
    overlay.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT)
    overlay.setDepth(HUD_DEPTH)
    overlay.setScrollFactor(0)

    const title = this.add
      .text(ROOM_WIDTH / 2, 28, 'CHOOSE YOUR UPGRADE', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 1)
      .setScrollFactor(0)

    const upgradeSystem = new UpgradeSystem()
    /** @type {UpgradeCard[]} */
    this._cards = []

    const spacing = 140
    const startX = ROOM_WIDTH / 2 - ((upgrades.length - 1) * spacing) / 2
    const cy = ROOM_HEIGHT / 2 + 10

    const pick = (id) => {
      upgradeSystem.applyUpgrade(id, RunState)
      this._cards.forEach((c) => c.destroy())
      this._cards = []
      overlay.destroy()
      title.destroy()
      this.scene.stop()
      this.scene.resume('GameScene')
    }

    upgrades.forEach((up, i) => {
      const card = new UpgradeCard(this, startX + i * spacing, cy, up, pick)
      this._cards.push(card)
    })

    this.keys1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE)
    this.keys2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO)
    this.keys3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE)

    this.keyHandler = () => {
      if (Phaser.Input.Keyboard.JustDown(this.keys1) && upgrades[0]) pick(upgrades[0].id)
      if (Phaser.Input.Keyboard.JustDown(this.keys2) && upgrades[1]) pick(upgrades[1].id)
      if (Phaser.Input.Keyboard.JustDown(this.keys3) && upgrades[2]) pick(upgrades[2].id)
    }
  }

  update() {
    if (this.keyHandler) this.keyHandler()
  }
}
