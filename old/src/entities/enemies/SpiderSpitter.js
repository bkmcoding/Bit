import Phaser from 'phaser'
import { ENEMY_STATS } from '../../data/enemies.js'
import EnemyBase from './EnemyBase.js'

const IDLE_MS = 500
const TRACK_SHOOT_MS = 1500
const MIN_RANGE = 80
const MAX_RANGE = 150

export default class SpiderSpitter extends EnemyBase {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   */
  constructor(scene, x, y) {
    const stats = ENEMY_STATS.spiderSpitter
    super(scene, x, y, 'spider_spitter', stats)

    this.fireRate = stats.fireRate

    /** Time spent in TRACK before shooting (ms). */
    this.trackPhaseTimer = 0
    /** +1 or -1 perpendicular strafe direction while in ideal range. */
    this.strafeDir = 1

    this.body.setCircle(8, 4, 4)
  }

  /**
   * @param {string} newState
   */
  setState(newState) {
    const prev = this.state
    super.setState(newState)

    if (newState === 'TRACK') {
      this.trackPhaseTimer = 0
      if (prev === 'IDLE') {
        this.strafeDir = Math.random() < 0.5 ? 1 : -1
      } else if (prev === 'COOLDOWN') {
        this.strafeDir *= -1
      }
    }
  }

  #getPlayer() {
    const p = this.scene.player
    return p && p.active ? p : null
  }

  /**
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    if (this.isDead) return

    const player = this.#getPlayer()
    if (!player) {
      this.body.setVelocity(0, 0)
      return
    }

    this.stateTimer += delta

    switch (this.state) {
      case 'IDLE': {
        if (this.stateTimer >= IDLE_MS) {
          this.setState('TRACK')
        }
        this.body.setVelocity(0, 0)
        break
      }
      case 'TRACK': {
        this.trackPhaseTimer += delta
        if (this.trackPhaseTimer >= TRACK_SHOOT_MS) {
          this.body.setVelocity(0, 0)
          this.setState('SHOOT')
          break
        }

        const dx = player.x - this.x
        const dy = player.y - this.y
        const dist = Math.hypot(dx, dy) || 1
        const nx = dx / dist
        const ny = dy / dist

        let angleDeg
        if (dist < MIN_RANGE) {
          angleDeg = Phaser.Math.RadToDeg(Math.atan2(-ny, -nx))
        } else if (dist > MAX_RANGE) {
          angleDeg = Phaser.Math.RadToDeg(Math.atan2(ny, nx))
        } else {
          const px = -ny * this.strafeDir
          const py = nx * this.strafeDir
          angleDeg = Phaser.Math.RadToDeg(Math.atan2(py, px))
        }

        this.scene.physics.velocityFromAngle(angleDeg, this.speed, this.body.velocity)
        break
      }
      case 'SHOOT': {
        this.body.setVelocity(0, 0)
        const angleRad = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y)
        const angleDeg = Phaser.Math.RadToDeg(angleRad)
        if (typeof this.scene.spawnEnemyProjectile === 'function') {
          this.scene.spawnEnemyProjectile(this.x, this.y, angleDeg)
        }
        this.setState('COOLDOWN')
        break
      }
      case 'COOLDOWN': {
        this.body.setVelocity(0, 0)
        if (this.stateTimer >= this.fireRate) {
          this.setState('TRACK')
        }
        break
      }
      default:
        this.body.setVelocity(0, 0)
    }
  }
}
