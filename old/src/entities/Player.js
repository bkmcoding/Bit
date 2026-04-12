import Phaser from 'phaser'
import { RunState } from '../systems/RunState.js'

export default class Player extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   */
  constructor(scene, x, y) {
    super(scene, x, y, 'player')
    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.speed = 120
    this.hp = 6
    this.maxHp = 6

    this.projectileDamage = 1
    this.fireRate = 500
    this.projectileSpeed = 200
    this.projectileRange = 200
    this.projectileSize = 3
    this.lastFired = 0

    this.invincible = false
    this.iFrameDuration = 800

    this.body.setCircle(5, 3, 3)
  }

  /**
   * @param {number} amount
   */
  takeDamage(amount) {
    if (this.invincible) return
    this.hp = Math.max(0, this.hp - amount)
    RunState.currentHealth = this.hp
    console.log('[Player] HP:', this.hp, '/', this.maxHp)

    this.invincible = true

    const flashHalf = 80
    const fullCycle = flashHalf * 2
    const numCycles = Math.max(1, Math.round(this.iFrameDuration / fullCycle))
    const repeat = numCycles - 1

    this.scene.tweens.add({
      targets: this,
      alpha: 0.2,
      duration: flashHalf,
      yoyo: true,
      repeat,
      onComplete: () => {
        this.alpha = 1
        this.invincible = false
      },
    })

    this.scene.game.events.emit('playerDamaged', this.hp, this.maxHp)
    if (this.hp <= 0) {
      this.scene.game.events.emit('playerDied')
    }
  }

  /**
   * @param {number} targetX
   * @param {number} targetY
   * @param {number} time
   * @param {Phaser.GameObjects.Group} projectileGroup
   */
  shoot(targetX, targetY, time, projectileGroup) {
    if (time - this.lastFired < this.fireRate) return

    const angleRad = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY)
    const angleDeg = Phaser.Math.RadToDeg(angleRad)

    const proj = projectileGroup.get(this.x, this.y)
    if (!proj) return

    proj.fire(
      this.x,
      this.y,
      angleDeg,
      this.projectileSpeed,
      this.projectileDamage,
      this.projectileRange,
      this.projectileSize,
    )
    this.lastFired = time
  }

  /**
   * @param {Phaser.Types.Input.Keyboard.CursorKeys} cursors
   * @param {{ up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key }} wasd
   * @param {number} time
   * @param {Phaser.Input.Pointer} pointer
   * @param {Phaser.GameObjects.Group} projectileGroup
   */
  update(cursors, wasd, time, pointer, projectileGroup) {
    let vx = 0
    let vy = 0

    if (cursors.left.isDown || wasd.left.isDown) vx -= 1
    if (cursors.right.isDown || wasd.right.isDown) vx += 1
    if (cursors.up.isDown || wasd.up.isDown) vy -= 1
    if (cursors.down.isDown || wasd.down.isDown) vy += 1

    if (vx !== 0 && vy !== 0) {
      const n = 1 / Math.sqrt(2)
      vx *= n
      vy *= n
    }

    if (vx === 0 && vy === 0) {
      this.body.setVelocity(0, 0)
    } else {
      this.body.setVelocity(vx * this.speed, vy * this.speed)
    }

    if (pointer.isDown) {
      this.shoot(pointer.worldX, pointer.worldY, time, projectileGroup)
    }
  }
}
