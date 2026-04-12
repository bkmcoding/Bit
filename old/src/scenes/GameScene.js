import Phaser from 'phaser'
import Player from '../entities/Player.js'
import Projectile from '../entities/Projectile.js'
import { ENEMY_STATS } from '../data/enemies.js'
import RoomManager from '../systems/RoomManager.js'
import EnemySpawner from '../systems/EnemySpawner.js'
import UpgradeSystem from '../systems/UpgradeSystem.js'
import { RunState } from '../systems/RunState.js'
import {
  COLORS,
  PLAYER_DEPTH,
  ROOM_HEIGHT,
  ROOM_WIDTH,
  WALL_THICKNESS,
} from '../utils/constants.js'

const PLAYER_BODY_RADIUS = 5

/**
 * @param {Projectile} projectile
 * @param {Phaser.GameObjects.GameObject} _wall
 */
function onProjectileHitWall(projectile, _wall) {
  projectile.deactivate()
}

/**
 * @param {Projectile} projectile
 * @param {import('../entities/enemies/EnemyBase.js').default} enemy
 */
function onPlayerProjHitEnemy(projectile, enemy) {
  projectile.deactivate()
  const scene = /** @type {GameScene} */ (projectile.scene)
  const dmg = scene.player ? scene.player.projectileDamage : 1
  enemy.takeDamage(dmg)
}

/**
 * @param {Player} player
 * @param {Projectile} projectile
 */
function onEnemyProjHitPlayer(player, projectile) {
  projectile.deactivate()
  player.takeDamage(projectile.damage)
}

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' })
    /** @type {Phaser.Physics.Arcade.Collider[]} */
    this._colliders = []
    this._enteringDoor = false
  }

  create() {
    this._colliders = []
    this._enteringDoor = false

    this.cameras.main.setBackgroundColor(COLORS.FLOOR)

    this.roomManager = new RoomManager(this)
    this.roomManager.initFloor(RunState.floor)

    this.upgradeSystem = new UpgradeSystem()

    const innerPad = WALL_THICKNESS + PLAYER_BODY_RADIUS
    this.physics.world.setBounds(
      innerPad,
      innerPad,
      ROOM_WIDTH - 2 * innerPad,
      ROOM_HEIGHT - 2 * innerPad,
    )

    this.player = new Player(this, ROOM_WIDTH / 2, ROOM_HEIGHT / 2)
    this.player.setDepth(PLAYER_DEPTH)
    this.player.body.setCollideWorldBounds(true)
    this.syncPlayerFromRunState()

    this.enemySpawner = new EnemySpawner(this)
    const initialTpl = this.roomManager.currentTemplate
    if (initialTpl) {
      this.enemySpawner.spawnFromTemplate(
        initialTpl,
        RunState.floor,
        this.roomManager.currentRoomIndex,
      )
    }

    this.playerProjectiles = this.physics.add.group({
      classType: Projectile,
      maxSize: 30,
      runChildUpdate: true,
      key: 'projectile',
    })

    this.enemyProjectiles = this.physics.add.group({
      classType: Projectile,
      maxSize: 20,
      runChildUpdate: true,
      key: 'enemy_proj',
    })

    this.addPhysicsColliders()

    this._onEnemyDied = () => {
      if (this.enemySpawner.getAliveCount() === 0) {
        this.roomManager.unlockDoors()
      }
    }
    this.game.events.on('enemyDied', this._onEnemyDied)

    this.events.on('doorsUnlocked', () => {})

    this.events.on('resume', () => {
      this.syncPlayerFromRunState()
      let nextTpl = this.roomManager.loadNextRoom()
      if (!nextTpl) {
        this.roomManager.initFloor(RunState.floor)
        nextTpl = this.roomManager.currentTemplate
      }
      this.enemySpawner.clear()
      if (nextTpl) {
        this.enemySpawner.spawnFromTemplate(
          nextTpl,
          RunState.floor,
          this.roomManager.currentRoomIndex,
        )
      }
      this.player.setPosition(ROOM_WIDTH / 2, ROOM_HEIGHT / 2)
      this.rewireColliders()
      this._enteringDoor = false
    })

    this.game.events.on('floorComplete', () => {
      console.log('[Run] Floor complete (looping layout for now)')
    })

    this.events.once('shutdown', () => {
      this.game.events.off('enemyDied', this._onEnemyDied)
    })

    this.input.setPollAlways()

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    })
  }

  /**
   * @param {Phaser.Physics.Arcade.Collider} col
   */
  _pushCollider(col) {
    this._colliders.push(col)
  }

  clearPhysicsColliders() {
    this._colliders.forEach((c) => c.destroy())
    this._colliders = []
  }

  addPhysicsColliders() {
    this._pushCollider(
      this.physics.add.overlap(
        this.playerProjectiles,
        this.roomManager.wallGroup,
        onProjectileHitWall,
        (proj) => proj.active,
      ),
    )
    this._pushCollider(
      this.physics.add.overlap(
        this.playerProjectiles,
        this.roomManager.obstacleGroup,
        onProjectileHitWall,
        (proj) => proj.active,
      ),
    )
    this._pushCollider(
      this.physics.add.overlap(
        this.enemyProjectiles,
        this.roomManager.wallGroup,
        onProjectileHitWall,
        (proj) => proj.active,
      ),
    )
    this._pushCollider(
      this.physics.add.overlap(
        this.enemyProjectiles,
        this.roomManager.obstacleGroup,
        onProjectileHitWall,
        (proj) => proj.active,
      ),
    )

    this._pushCollider(
      this.physics.add.overlap(
        this.playerProjectiles,
        this.enemySpawner.enemyGroup,
        onPlayerProjHitEnemy,
        (proj, enemy) => proj.active && enemy.active && !enemy.isDead,
      ),
    )

    this._pushCollider(
      this.physics.add.overlap(
        this.player,
        this.enemyProjectiles,
        onEnemyProjHitPlayer,
        (playerObj, proj) => proj.active && !playerObj.invincible,
      ),
    )

    this._pushCollider(this.physics.add.collider(this.player, this.roomManager.wallGroup))
    this._pushCollider(this.physics.add.collider(this.player, this.roomManager.obstacleGroup))
    this._pushCollider(this.physics.add.collider(this.player, this.roomManager.doorGroup))

    this._pushCollider(
      this.physics.add.collider(this.enemySpawner.enemyGroup, this.roomManager.wallGroup),
    )
    this._pushCollider(
      this.physics.add.collider(this.enemySpawner.enemyGroup, this.roomManager.obstacleGroup),
    )
  }

  rewireColliders() {
    this.clearPhysicsColliders()
    this.addPhysicsColliders()
  }

  checkPlayerDoorOverlap() {
    if (this.roomManager.doorsLocked || this._enteringDoor) return
    if (!this.roomManager.currentTemplate) return

    const pb = this.player.getBounds()
    const doors = this.roomManager.doorGroup.getChildren()
    for (let i = 0; i < doors.length; i++) {
      const door = /** @type {Phaser.GameObjects.Rectangle} */ (doors[i])
      const db = door.getBounds()
      if (Phaser.Geom.Rectangle.Overlaps(pb, db)) {
        this.onPlayerEntersDoor()
        break
      }
    }
  }

  onPlayerEntersDoor() {
    if (this.roomManager.doorsLocked || this._enteringDoor) return
    this._enteringDoor = true
    RunState.roomsCleared++
    this.scene.pause('GameScene')
    this.scene.launch('UpgradeScene', {
      upgrades: this.upgradeSystem.draw(3),
    })
  }

  syncPlayerFromRunState() {
    this.player.speed = RunState.speed
    this.player.projectileDamage = RunState.projectileDamage
    this.player.fireRate = RunState.fireRate
    this.player.projectileSpeed = RunState.projectileSpeed
    this.player.projectileRange = RunState.projectileRange
    this.player.projectileSize = RunState.projectileSize
    this.player.maxHp = RunState.maxHealth
    this.player.hp = RunState.currentHealth
    this.player.iFrameDuration = RunState.iFrameDuration
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} angleDeg
   */
  spawnEnemyProjectile(x, y, angleDeg) {
    const proj = this.enemyProjectiles.get(x, y)
    if (!proj) return
    proj.fire(x, y, angleDeg, ENEMY_STATS.spiderSpitter.projSpeed, 1, 300, 3)
  }

  update(time, delta) {
    this.enemySpawner.update(time, delta)
    this.player.update(this.cursors, this.wasd, time, this.input.activePointer, this.playerProjectiles)
    this.checkPlayerDoorOverlap()
  }
}
