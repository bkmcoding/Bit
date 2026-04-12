import Phaser from 'phaser'
import { PROJ_DEPTH } from '../utils/constants.js'

/** Texture frame is 8×8; graphic circle centered at (4, 4). Body offset = bbox top-left in frame px. */
const PROJ_TEXTURE_CENTER = 4

export default class Projectile extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {string} [textureKey]
   * @param {string | number} [frame]
   */
  constructor(scene, x, y, textureKey = 'projectile', frame) {
    super(scene, x, y, textureKey, frame)
    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setDepth(PROJ_DEPTH)
    this.setOrigin(0.5, 0.5)

    this.damage = 0
    this.distanceTraveled = 0
    this.maxRange = 0
    /** @type {number} */
    this.size = 3

    this.deactivate()
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} angleDeg
   * @param {number} speed
   * @param {number} damage
   * @param {number} range
   * @param {number} size circle radius (px)
   */
  fire(x, y, angleDeg, speed, damage, range, size) {
    this.size = size
    this.damage = damage
    this.distanceTraveled = 0
    this.maxRange = range

    this.setPosition(x, y)
    this.setActive(true)
    this.setVisible(true)

    /** @type {Phaser.Physics.Arcade.Body} */
    const body = this.body
    body.enable = true
    body.setCircle(size, PROJ_TEXTURE_CENTER - size, PROJ_TEXTURE_CENTER - size)
    this.refreshBody()
    body.setVelocity(0, 0)
    this.scene.physics.velocityFromAngle(angleDeg, speed, body.velocity)
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta)
    if (!this.active) return

    const vx = this.body.velocity.x
    const vy = this.body.velocity.y
    this.distanceTraveled += (Math.abs(vx * delta) + Math.abs(vy * delta)) / 1000
    if (this.distanceTraveled > this.maxRange) {
      this.deactivate()
    }
  }

  deactivate() {
    this.setActive(false)
    this.setVisible(false)
    const body = this.body
    if (body) {
      body.stop()
      body.enable = false
    }
  }
}
