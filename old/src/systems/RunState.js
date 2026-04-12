export const RunState = {
  maxHealth: 6,
  currentHealth: 6,
  speed: 120,
  projectileDamage: 1,
  fireRate: 500,
  projectileSpeed: 200,
  projectileSize: 3,
  projectileRange: 200,
  iFrameDuration: 800,

  floor: 1,
  roomsCleared: 0,
  upgradesAcquired: [],

  hasTripleShot: false,
  hasBouncyShots: false,
  hasPiercing: false,
  shieldCharges: 0,

  reset() {
    Object.assign(this, {
      maxHealth: 6,
      currentHealth: 6,
      speed: 120,
      projectileDamage: 1,
      fireRate: 500,
      projectileSpeed: 200,
      projectileSize: 3,
      projectileRange: 200,
      iFrameDuration: 800,
      floor: 1,
      roomsCleared: 0,
      upgradesAcquired: [],
      hasTripleShot: false,
      hasBouncyShots: false,
      hasPiercing: false,
      shieldCharges: 0,
    })
  },
}
