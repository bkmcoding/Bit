/** @typedef {{ id: string, name: string, description: string, rarity: 'common'|'rare', icon: string, apply: (runState: object) => void }} UpgradeDef */

/** @type {UpgradeDef[]} */
export const UPGRADES = [
  {
    id: 'damage_up',
    name: 'Sharpened Bite',
    description: '+1 projectile damage',
    rarity: 'common',
    icon: 'icon_tooth',
    apply: (runState) => {
      runState.projectileDamage += 1
    },
  },
  {
    id: 'fire_rate_up',
    name: 'Quick Mandibles',
    description: 'Fire 75ms faster (min 150ms)',
    rarity: 'common',
    icon: 'icon_rate',
    apply: (runState) => {
      runState.fireRate = Math.max(150, runState.fireRate - 75)
    },
  },
  {
    id: 'speed_up',
    name: 'Skittering Step',
    description: '+15 move speed',
    rarity: 'common',
    icon: 'icon_speed',
    apply: (runState) => {
      runState.speed += 15
    },
  },
  {
    id: 'max_hp_up',
    name: 'Thick Carapace',
    description: '+2 max HP (heal 2)',
    rarity: 'rare',
    icon: 'icon_hp',
    apply: (runState) => {
      runState.maxHealth += 2
      runState.currentHealth += 2
    },
  },
  {
    id: 'heal_1',
    name: 'Molt & Mend',
    description: 'Restore 2 HP (up to max)',
    rarity: 'common',
    icon: 'icon_heal',
    apply: (runState) => {
      runState.currentHealth = Math.min(runState.currentHealth + 2, runState.maxHealth)
    },
  },
  {
    id: 'range_up',
    name: 'Long Webbing',
    description: '+60 projectile range',
    rarity: 'common',
    icon: 'icon_range',
    apply: (runState) => {
      runState.projectileRange += 60
    },
  },
]
