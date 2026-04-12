import Phaser from 'phaser'
import { ROOM_HEIGHT, ROOM_WIDTH, WALL_THICKNESS } from '../utils/constants.js'
import SpiderSpitter from '../entities/enemies/SpiderSpitter.js'

export default class EnemySpawner {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene
    this.enemyGroup = scene.physics.add.group()
    /** @type {import('../entities/enemies/EnemyBase.js').default[]} */
    this.activeEnemies = []
  }

  clear() {
    this.enemyGroup.clear(true, true)
    this.activeEnemies = []
  }

  /**
   * @param {{ enemySlots: Array<{ xNorm: number, yNorm: number }> }} template
   * @param {number} [floor]
   * @param {number} [roomIndex]
   */
  spawnFromTemplate(template, floor = 1, roomIndex = 0) {
    const count = Math.min(floor + roomIndex + 1, 5)
    const slots = Phaser.Utils.Array.Shuffle([...template.enemySlots]).slice(0, count)
    const innerW = ROOM_WIDTH - WALL_THICKNESS * 2
    const innerH = ROOM_HEIGHT - WALL_THICKNESS * 2

    slots.forEach((slot) => {
      const x = WALL_THICKNESS + slot.xNorm * innerW
      const y = WALL_THICKNESS + slot.yNorm * innerH
      const enemy = new SpiderSpitter(this.scene, x, y)
      this.enemyGroup.add(enemy)
      this.activeEnemies.push(enemy)
    })
  }

  getAliveCount() {
    return this.activeEnemies.filter((e) => !e.isDead).length
  }

  /**
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    this.activeEnemies.forEach((e) => {
      if (!e.isDead && e.active) e.update(time, delta)
    })
    this.activeEnemies = this.activeEnemies.filter((e) => !e.isDead && e.active)
  }
}
