import Phaser from 'phaser'
import { UPGRADES } from '../data/upgrades.js'

export default class UpgradeSystem {
  constructor() {
    this.pool = [...UPGRADES]
  }

  /**
   * @param {number} [count]
   */
  draw(count = 3) {
    const shuffled = Phaser.Utils.Array.Shuffle([...this.pool])
    return shuffled.slice(0, count)
  }

  /**
   * @param {string} upgradeId
   * @param {object} runState
   */
  applyUpgrade(upgradeId, runState) {
    const upgrade = this.pool.find((u) => u.id === upgradeId)
    if (!upgrade) return
    upgrade.apply(runState)
    runState.upgradesAcquired.push(upgradeId)
  }
}
