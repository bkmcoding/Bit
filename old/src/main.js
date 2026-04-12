import Phaser from 'phaser'
import BootScene from './scenes/BootScene.js'
import MainMenuScene from './scenes/MainMenuScene.js'
import GameScene from './scenes/GameScene.js'
import UpgradeScene from './scenes/UpgradeScene.js'
import HUDScene from './scenes/HUDScene.js'
import GameOverScene from './scenes/GameOverScene.js'

const config = {
  type: Phaser.AUTO,
  width: 480,
  height: 270,
  zoom: 3,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MainMenuScene, GameScene, HUDScene, UpgradeScene, GameOverScene],
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}

export default new Phaser.Game(config)
