import Phaser from 'phaser'
import { ENEMY_DEPTH } from '../../utils/constants.js'

/**
 * @typedef {{ hp: number, speed: number, damage: number, xp: number }} EnemyStatBlock
 */

export default class EnemyBase extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {string} textureKey
   * @param {EnemyStatBlock} stats
   */
  constructor(scene, x, y, textureKey, stats) {
    super(scene, x, y, textureKey)
    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setDepth(ENEMY_DEPTH)
    this.setOrigin(0.5, 0.5)

    this.hp = stats.hp
    this.maxHp = stats.hp
    this.speed = stats.speed
    this.damage = stats.damage
    this.xpValue = stats.xp

    this.isDead = false
    this.state = 'IDLE'
    this.stateTimer = 0
  }

  /**
   * @param {number} amount
   */
  takeDamage(amount) {
    if (this.isDead) return
    this.hp -= amount
    this.setTint(0xff4444)
    this.scene.time.delayedCall(120, () => {
      if (this.active) this.clearTint()
    })
    if (this.hp <= 0) this.die()
  }

  die() {
    if (this.isDead) return
    this.isDead = true
    this.scene.game.events.emit('enemyDied', this)
    this.destroy()
  }

  /**
   * @param {string} newState
   */
  setState(newState) {
    this.state = newState
    this.stateTimer = 0
  }

  /**
   * @param {number} _time
   * @param {number} _delta
   */
  update(_time, _delta) {
    // Subclasses override
  }
}
