import Phaser from 'phaser'
import {
  COLORS,
  DOOR_SIZE,
  FLOOR_DEPTH,
  ROOM_HEIGHT,
  ROOM_WIDTH,
  WALL_DEPTH,
  WALL_THICKNESS,
} from '../utils/constants.js'
import { ROOM_TEMPLATES } from '../data/rooms.js'

/**
 * Loads room geometry from a template: floor, segmented walls with door gaps, door colliders, obstacles.
 */
export default class RoomManager {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene
    this.wallGroup = scene.physics.add.staticGroup()
    this.doorGroup = scene.physics.add.staticGroup()
    this.obstacleGroup = scene.physics.add.staticGroup()
    /** @type {Phaser.GameObjects.Graphics | null} */
    this.floorGraphics = null
    /** @type {import('../data/rooms.js').RoomTemplate | null} */
    this.currentTemplate = null
    this.doorsLocked = true

    this.currentRoomIndex = 0
    /** @type {import('../data/rooms.js').RoomTemplate[]} */
    this.roomSequence = []
    /** @type {number} */
    this.currentFloor = 1
  }

  /**
   * @param {number} floor
   */
  initFloor(floor) {
    this.currentFloor = floor
    this.roomSequence = Phaser.Utils.Array.Shuffle([...ROOM_TEMPLATES])
    this.currentRoomIndex = 0
    this.loadRoom(this.roomSequence[0])
  }

  /**
   * @param {import('../data/rooms.js').RoomTemplate} template
   */
  loadRoom(template) {
    this.destroyRoom()

    const g = this.scene.add.graphics()
    g.fillStyle(COLORS.FLOOR, 1)
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT)
    g.setDepth(FLOOR_DEPTH)
    this.floorGraphics = g

    const hasNorth = template.doors.includes('north')
    const hasSouth = template.doors.includes('south')
    const hasEast = template.doors.includes('east')
    const hasWest = template.doors.includes('west')

    this.#buildHorizontalWall(hasNorth, ROOM_WIDTH / 2, WALL_THICKNESS / 2)
    this.#buildHorizontalWall(hasSouth, ROOM_WIDTH / 2, ROOM_HEIGHT - WALL_THICKNESS / 2)
    this.#buildVerticalWall(hasWest, WALL_THICKNESS / 2, ROOM_HEIGHT / 2)
    this.#buildVerticalWall(hasEast, ROOM_WIDTH - WALL_THICKNESS / 2, ROOM_HEIGHT / 2)

    for (const side of template.doors) {
      this.#addDoor(side)
    }

    const innerW = ROOM_WIDTH - 2 * WALL_THICKNESS
    const innerH = ROOM_HEIGHT - 2 * WALL_THICKNESS

    for (const obs of template.obstacles) {
      const cx = WALL_THICKNESS + obs.xNorm * innerW
      const cy = WALL_THICKNESS + obs.yNorm * innerH
      const piece = this.obstacleGroup.create(cx, cy, 'wall_tile')
      piece.setOrigin(0.5, 0.5)
      piece.setDisplaySize(obs.w, obs.h)
      piece.setDepth(WALL_DEPTH)
      piece.refreshBody()
    }

    this.currentTemplate = template
    this.lockDoors()
  }

  /**
   * @returns {import('../data/rooms.js').RoomTemplate | null}
   */
  loadNextRoom() {
    this.destroyRoom()
    this.currentRoomIndex++
    if (this.currentRoomIndex >= this.roomSequence.length) {
      this.scene.game.events.emit('floorComplete')
      return null
    }
    const next = this.roomSequence[this.currentRoomIndex]
    this.loadRoom(next)
    this.lockDoors()
    return next
  }

  /**
   * @param {boolean} hasDoor
   * @param {number} roomCx
   * @param {number} wallCy
   */
  #buildHorizontalWall(hasDoor, roomCx, wallCy) {
    const fullW = ROOM_WIDTH
    if (!hasDoor) {
      this.#addWallSegment(roomCx, wallCy, fullW, WALL_THICKNESS)
      return
    }
    const halfGap = DOOR_SIZE / 2
    const leftW = roomCx - halfGap
    const rightW = fullW - (roomCx + halfGap)
    const leftCx = leftW / 2
    const rightCx = roomCx + halfGap + rightW / 2
    this.#addWallSegment(leftCx, wallCy, leftW, WALL_THICKNESS)
    this.#addWallSegment(rightCx, wallCy, rightW, WALL_THICKNESS)
  }

  /**
   * @param {boolean} hasDoor
   * @param {number} wallCx
   * @param {number} roomCy
   */
  #buildVerticalWall(hasDoor, wallCx, roomCy) {
    const fullH = ROOM_HEIGHT
    if (!hasDoor) {
      this.#addWallSegment(wallCx, roomCy, WALL_THICKNESS, fullH)
      return
    }
    const halfGap = DOOR_SIZE / 2
    const topH = roomCy - halfGap
    const bottomH = fullH - (roomCy + halfGap)
    const topCy = topH / 2
    const bottomCy = roomCy + halfGap + bottomH / 2
    this.#addWallSegment(wallCx, topCy, WALL_THICKNESS, topH)
    this.#addWallSegment(wallCx, bottomCy, WALL_THICKNESS, bottomH)
  }

  /**
   * @param {number} cx
   * @param {number} cy
   * @param {number} w
   * @param {number} h
   */
  #addWallSegment(cx, cy, w, h) {
    if (w <= 0 || h <= 0) return
    const s = this.wallGroup.create(cx, cy, 'wall_tile')
    s.setOrigin(0.5, 0.5)
    s.setDisplaySize(w, h)
    s.setDepth(WALL_DEPTH)
    s.refreshBody()
  }

  /**
   * @param {'north' | 'south' | 'east' | 'west'} side
   */
  #addDoor(side) {
    const roomCx = ROOM_WIDTH / 2
    const roomCy = ROOM_HEIGHT / 2
    let x = 0
    let y = 0
    let w = DOOR_SIZE
    let h = WALL_THICKNESS

    if (side === 'north') {
      x = roomCx
      y = WALL_THICKNESS / 2
      w = DOOR_SIZE
      h = WALL_THICKNESS
    } else if (side === 'south') {
      x = roomCx
      y = ROOM_HEIGHT - WALL_THICKNESS / 2
      w = DOOR_SIZE
      h = WALL_THICKNESS
    } else if (side === 'west') {
      x = WALL_THICKNESS / 2
      y = roomCy
      w = WALL_THICKNESS
      h = DOOR_SIZE
    } else if (side === 'east') {
      x = ROOM_WIDTH - WALL_THICKNESS / 2
      y = roomCy
      w = WALL_THICKNESS
      h = DOOR_SIZE
    }

    const door = this.scene.add.rectangle(x, y, w, h, COLORS.DOOR_LOCKED)
    door.setDepth(WALL_DEPTH + 1)
    this.scene.physics.add.existing(door, true)
    this.doorGroup.add(door)
    /** @type {Phaser.Physics.Arcade.StaticBody} */
    const body = door.body
    if (body) {
      body.updateFromGameObject()
    }
  }

  lockDoors() {
    this.doorsLocked = true
    this.doorGroup.getChildren().forEach((door) => {
      const body = /** @type {Phaser.Physics.Arcade.StaticBody} */ (door.body)
      if (body) {
        body.enable = true
      }
      if (door.setFillStyle) {
        door.setFillStyle(COLORS.DOOR_LOCKED)
      }
    })
  }

  unlockDoors() {
    this.doorsLocked = false
    const doors = this.doorGroup.getChildren()
    let pending = doors.length

    const emitUnlocked = () => {
      pending--
      if (pending <= 0) {
        this.scene.events.emit('doorsUnlocked')
      }
    }

    doors.forEach((door) => {
      const body = /** @type {Phaser.Physics.Arcade.StaticBody} */ (door.body)
      if (body) {
        body.enable = false
      }
      if (door.setFillStyle) {
        door.setFillStyle(COLORS.DOOR_OPEN)
      }
      door.setScale(1, 1)
      this.scene.tweens.add({
        targets: door,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 100,
        yoyo: true,
        ease: 'Sine.easeInOut',
        onComplete: emitUnlocked,
      })
    })

    if (pending === 0) {
      this.scene.events.emit('doorsUnlocked')
    }
  }

  destroyRoom() {
    if (this.floorGraphics) {
      this.floorGraphics.destroy()
      this.floorGraphics = null
    }
    this.wallGroup.clear(true, true)
    this.doorGroup.clear(true, true)
    this.obstacleGroup.clear(true, true)
    this.currentTemplate = null
  }
}
