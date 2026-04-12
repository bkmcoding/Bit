import Phaser from 'phaser'
import { RunState } from '../systems/RunState.js'

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' })
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000')

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 24, 'BOXED IN', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 32, 'press SPACE to start', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#cccccc',
      })
      .setOrigin(0.5)

    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      RunState.reset()
      this.scene.start('GameScene')
    }
  }
}
