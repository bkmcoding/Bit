import type { Game } from '../engine/Game';
import { Room } from '../rooms/Room';
import {
  buildRunRooms,
  ROOM_COUNT,
  type MinimapLayout,
} from '../rooms/roomData';
import {
  CHAPTER_1_LAST_ROOM_INDEX,
  CHAPTER_2_FIRST_ROOM_INDEX,
} from '../rooms/chapterConfig';
import { Spider } from '../entities/enemies/Spider';
import { Spitter } from '../entities/enemies/Spitter';
import { Dasher } from '../entities/enemies/Dasher';
import { WebSpinner } from '../entities/enemies/WebSpinner';
import { Broodmother } from '../entities/enemies/Broodmother';
import { Brute } from '../entities/enemies/Brute';
import { Skitter } from '../entities/enemies/Skitter';
import { Widow } from '../entities/enemies/Widow';
import { ToxicSpitter } from '../entities/enemies/ToxicSpitter';
import { TideCrawler } from '../entities/enemies/TideCrawler';
import { GillStalker } from '../entities/enemies/GillStalker';
import { MurkLeech } from '../entities/enemies/MurkLeech';
import { BrineScuttler } from '../entities/enemies/BrineScuttler';
import { TrenchMatriarch } from '../entities/enemies/TrenchMatriarch';
import {
  DIFFICULTY_SETTINGS,
  SPAWN_PROTECTION_MIN_SEC,
  type Direction,
} from '../utils/constants';
import { Vector2 } from '../utils/Vector2';
import { circleOverlapsObstacle, resolveCircleObstacles } from '../utils/obstacleCollision';
import { getRandomUpgrades } from '../upgrades/upgradePool';
import { AudioManager } from '../audio/AudioManager';

export class RoomManager {
  public currentRoom: Room | null = null;
  public currentRoomIndex: number = 0;
  public totalRooms: number = ROOM_COUNT;
  /** 2D layout for the HUD radar (rebuilt each run). */
  public minimapLayout: MinimapLayout = { positions: [], edges: [] };

  private game: Game;
  private rooms: Map<number, Room> = new Map();
  private visitedRooms: Set<number> = new Set();
  /** Chambers the player has stepped into (for HUD radar). */
  private enteredRooms: Set<number> = new Set();
  private lastDirection: Direction | null = null;

  constructor(game: Game) {
    this.game = game;
    this.rebuildRun(0x71b1e71d);
  }

  /** New dungeon geometry, doors, and procedural rooms (call at start of each run). */
  rebuildRun(runSeed: number): void {
    const { configs, connections, minimap } = buildRunRooms(runSeed);
    this.minimapLayout = minimap;
    this.totalRooms = configs.length;
    this.rooms.clear();
    this.visitedRooms.clear();
    this.enteredRooms.clear();
    this.currentRoom = null;
    this.currentRoomIndex = 0;
    this.lastDirection = null;

    for (const config of configs) {
      const room = new Room(config);
      const conn = connections.get(config.id);
      if (conn) {
        for (const [dir, targetRoom] of conn) {
          room.setDoorTarget(dir as Direction, targetRoom);
        }
      }
      this.rooms.set(config.id, room);
    }
  }

  getEnteredRoomsSnapshot(): number[] {
    return Array.from(this.enteredRooms).sort((a, b) => a - b);
  }

  reset(): void {
    this.visitedRooms.clear();
    this.enteredRooms.clear();
    this.currentRoom = null;
    this.currentRoomIndex = 0;
    this.lastDirection = null;

    for (const room of this.rooms.values()) {
      room.isCleared = false;
      room.closeDoors();
    }
  }

  loadRoom(roomIndex: number): void {
    const room = this.rooms.get(roomIndex);
    if (!room) return;

    this.currentRoom = room;
    this.currentRoomIndex = roomIndex;

    this.game.enemies = [];
    this.game.projectiles = [];

    const firstVisit = !this.visitedRooms.has(roomIndex);
    const doorSpawn = room.getPlayerSpawnPosition(this.lastDirection);

    if (firstVisit && room.spawns.length > 0) {
      this.spawnEnemies(room);
      this.resolveEnemySpawnSpread();
      const best = this.findBestPlayerSpawnPosition(room, doorSpawn);
      this.game.player.setPosition(best);
      this.resolvePlayerSpawnClearance();
      this.resolvePlayerOutOfObstacles();
      const sec = Math.max(
        DIFFICULTY_SETTINGS[this.game.difficulty].spawnProtectionSec,
        SPAWN_PROTECTION_MIN_SEC
      );
      this.game.player.grantSpawnProtection(sec);
      room.closeDoors();
      this.game.beginBossIntroIfNeeded(roomIndex, room);
    } else if (firstVisit) {
      this.game.player.setPosition(doorSpawn);
      this.resolvePlayerOutOfObstacles();
      room.isCleared = true;
      room.openDoors();
      this.visitedRooms.add(roomIndex);
    } else {
      this.game.player.setPosition(doorSpawn);
      this.resolvePlayerOutOfObstacles();
      room.openDoors();
    }

    this.enteredRooms.add(roomIndex);
    this.game.notifyRoomChange();

    if (this.game.state === 'PLAYING') {
      const track = room.isBossRoom ? 'MUSIC_BOSS' : 'MUSIC_GAME';
      void AudioManager.playMusic(track);
    }
  }

  private resolvePlayerOutOfObstacles(): void {
    const room = this.currentRoom;
    if (!room) return;
    const p = this.game.player;
    const half = p.size / 2;
    const obs = room.getObstacleRects();
    for (let i = 0; i < 6; i++) {
      resolveCircleObstacles(p.position, half, obs);
      this.clampPlayerToCurrentRoom();
    }
  }

  private clampPointToPlayfield(p: Vector2, half: number, room: Room): void {
    const wt = room.wallThickness;
    const w = room.width;
    const h = room.height;
    p.x = Math.max(wt + half, Math.min(w - wt - half, p.x));
    p.y = Math.max(wt + half, Math.min(h - wt - half, p.y));
  }

  /** Stay near the entry door, stepping inward only as needed for clearance. */
  private findBestPlayerSpawnPosition(room: Room, doorSpawn: Vector2): Vector2 {
    const safe = room.getSafeRoomCenter();
    const cx = safe.x;
    const cy = safe.y;
    const obs = room.getObstacleRects();
    const ph = this.game.player.size / 2;

    let dx = cx - doorSpawn.x;
    let dy = cy - doorSpawn.y;
    if (dx * dx + dy * dy < 4) {
      dx = 0;
      dy = 1;
    }
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;

    const candidates: Vector2[] = [];
    candidates.push(doorSpawn.clone());
    for (let s = 7; s <= 40; s += 6) {
      candidates.push(new Vector2(doorSpawn.x + dx * s, doorSpawn.y + dy * s));
    }

    const minComfort = 20;
    const minMoveFreedom = 3;

    const minObstacleEdgeDistance = (p: Vector2): number => {
      let best = Number.POSITIVE_INFINITY;
      for (const o of obs) {
        const cx = Math.max(o.x, Math.min(o.x + o.w, p.x));
        const cy = Math.max(o.y, Math.min(o.y + o.h, p.y));
        const d = Math.hypot(p.x - cx, p.y - cy) - ph;
        if (d < best) best = d;
      }
      return Number.isFinite(best) ? best : 999;
    };

    const hasMovementFreedom = (p: Vector2): boolean => {
      const step = Math.max(8, ph + 3);
      let freeDirs = 0;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        const q = new Vector2(p.x + Math.cos(a) * step, p.y + Math.sin(a) * step);
        this.clampPointToPlayfield(q, ph, room);
        if (!circleOverlapsObstacle(q.x, q.y, ph - 0.2, obs)) {
          freeDirs++;
        }
      }
      return freeDirs >= minMoveFreedom;
    };

    type Scored = { p: Vector2; minEdge: number; obsEdge: number; doorDist: number };
    const scored: Scored[] = [];

    for (const raw of candidates) {
      const p = raw.clone();
      this.clampPointToPlayfield(p, ph, room);
      for (let k = 0; k < 4; k++) {
        resolveCircleObstacles(p, ph, obs);
        this.clampPointToPlayfield(p, ph, room);
      }
      if (circleOverlapsObstacle(p.x, p.y, ph - 0.25, obs)) continue;
      if (!hasMovementFreedom(p)) continue;
      let minEdge = 1e9;
      for (const e of this.game.enemies) {
        if (!e.isActive || e.markedForDeletion) continue;
        const edge = p.distanceTo(e.position) - ph - e.size / 2;
        minEdge = Math.min(minEdge, edge);
      }
      const obsEdge = minObstacleEdgeDistance(p);
      scored.push({ p, minEdge, obsEdge, doorDist: p.distanceTo(doorSpawn) });
    }

    if (scored.length === 0) {
      const fallback = safe.clone();
      this.clampPointToPlayfield(fallback, ph, room);
      for (let k = 0; k < 5; k++) {
        resolveCircleObstacles(fallback, ph, obs);
        this.clampPointToPlayfield(fallback, ph, room);
      }
      return fallback;
    }

    const ok = scored.filter((s) => s.minEdge >= minComfort && s.obsEdge >= 2);
    const pool = ok.length > 0 ? ok : scored;
    pool.sort((a, b) => {
      if (b.obsEdge !== a.obsEdge) return b.obsEdge - a.obsEdge;
      if (a.doorDist !== b.doorDist) return a.doorDist - b.doorDist;
      return b.minEdge - a.minEdge;
    });
    return pool[0]!.p.clone();
  }

  /** Push enemies apart on spawn so they do not start stacked. */
  private resolveEnemySpawnSpread(): void {
    const room = this.currentRoom;
    if (!room) return;
    const wt = room.wallThickness;
    const w = room.width;
    const h = room.height;

    for (let iter = 0; iter < 14; iter++) {
      for (let i = 0; i < this.game.enemies.length; i++) {
        const a = this.game.enemies[i];
        if (!a.isActive || a.markedForDeletion) continue;
        for (let j = i + 1; j < this.game.enemies.length; j++) {
          const b = this.game.enemies[j];
          if (!b.isActive || b.markedForDeletion) continue;
          const need = (a.size + b.size) / 2 + 3;
          let diff = a.position.sub(b.position);
          const dist = diff.magnitude();
          if (dist < need && dist > 1e-4) {
            diff.normalizeMut();
            const push = (need - dist) * 0.55;
            a.position.addMut(diff.mul(push));
            b.position.addMut(diff.mul(-push));
          } else if (dist <= 1e-4) {
            const n = new Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize();
            a.position.addMut(n.mul(2));
            b.position.addMut(n.mul(-2));
          }
        }
      }
      for (const e of this.game.enemies) {
        if (!e.isActive) continue;
        const half = e.size / 2;
        e.position.x = Math.max(wt + half, Math.min(w - wt - half, e.position.x));
        e.position.y = Math.max(wt + half, Math.min(h - wt - half, e.position.y));
        resolveCircleObstacles(e.position, half, room.getObstacleRects());
        e.position.x = Math.max(wt + half, Math.min(w - wt - half, e.position.x));
        e.position.y = Math.max(wt + half, Math.min(h - wt - half, e.position.y));
      }
    }
  }

  private resolvePlayerSpawnClearance(): void {
    const room = this.currentRoom;
    if (!room) return;
    const player = this.game.player;
    const pad = 10;

    for (let iter = 0; iter < 28; iter++) {
      let overlapped = false;
      for (const enemy of this.game.enemies) {
        if (!enemy.isActive || enemy.markedForDeletion) continue;
        const need = player.size / 2 + enemy.size / 2 + pad;
        const dist = player.position.distanceTo(enemy.position);
        if (dist < need) {
          overlapped = true;
          let away = player.position.sub(enemy.position);
          if (away.magnitudeSq() < 1e-4) {
            away = new Vector2(1, 0);
          } else {
            away.normalizeMut();
          }
          const push = Math.min(need - dist + 1.2, 8);
          player.position.addMut(away.mul(push));
        }
      }
      this.clampPlayerToCurrentRoom();
      resolveCircleObstacles(player.position, player.size / 2, room.getObstacleRects());
      this.clampPlayerToCurrentRoom();
      if (!overlapped) break;
    }
  }

  private clampPlayerToCurrentRoom(): void {
    const room = this.currentRoom;
    if (!room) return;
    const half = this.game.player.size / 2;
    const wt = room.wallThickness;
    const w = room.width;
    const h = room.height;
    const p = this.game.player.position;
    p.x = Math.max(wt + half, Math.min(w - wt - half, p.x));
    p.y = Math.max(wt + half, Math.min(h - wt - half, p.y));
  }

  private spawnEnemies(room: Room): void {
    for (const spawn of room.spawns) {
      let enemy;

      switch (spawn.enemyType) {
        case 'spider':
          enemy = new Spider(spawn.position.clone(), this.game);
          break;
        case 'spitter':
          enemy = new Spitter(spawn.position.clone(), this.game);
          break;
        case 'dasher':
          enemy = new Dasher(spawn.position.clone(), this.game);
          break;
        case 'webspinner':
          enemy = new WebSpinner(spawn.position.clone(), this.game);
          break;
        case 'brute':
          enemy = new Brute(spawn.position.clone(), this.game);
          break;
        case 'skitter':
          enemy = new Skitter(spawn.position.clone(), this.game);
          break;
        case 'widow':
          enemy = new Widow(spawn.position.clone(), this.game);
          break;
        case 'toxicspitter':
          enemy = new ToxicSpitter(spawn.position.clone(), this.game);
          break;
        case 'tidecrawler':
          enemy = new TideCrawler(spawn.position.clone(), this.game);
          break;
        case 'broodmother': {
          const variant =
            this.currentRoomIndex === ROOM_COUNT - 1
              ? ('flooded' as const)
              : ('standard' as const);
          enemy = new Broodmother(spawn.position.clone(), this.game, variant);
          break;
        }
        case 'gillstalker':
          enemy = new GillStalker(spawn.position.clone(), this.game);
          break;
        case 'murkleech':
          enemy = new MurkLeech(spawn.position.clone(), this.game);
          break;
        case 'brinescuttler':
          enemy = new BrineScuttler(spawn.position.clone(), this.game);
          break;
        case 'trenchmatriarch':
          enemy = new TrenchMatriarch(spawn.position.clone(), this.game);
          break;
      }

      if (enemy) {
        this.game.spawnEnemy(enemy);
      }
    }
  }

  transitionToRoom(roomIndex: number, fromDirection: Direction): void {
    const oppositeDirections: Record<Direction, Direction> = {
      NORTH: 'SOUTH',
      SOUTH: 'NORTH',
      EAST: 'WEST',
      WEST: 'EAST',
    };
    this.lastDirection = oppositeDirections[fromDirection];

    AudioManager.play('SFX_DOOR_PASS', 0.88);
    this.loadRoom(roomIndex);
  }

  /** Direction of the door from `fromIndex` that leads to `toIndex`, if any. */
  findDirectionToRoom(fromIndex: number, toIndex: number): Direction | null {
    const room = this.rooms.get(fromIndex);
    if (!room) return null;
    for (const [dir, door] of room.doors) {
      if (door.targetRoom === toIndex) return dir;
    }
    return null;
  }

  checkRoomCleared(): void {
    if (!this.currentRoom || this.currentRoom.isCleared) return;

    const aliveEnemies = this.game.enemies.filter((e) => e.isActive && !e.markedForDeletion);

    if (aliveEnemies.length === 0 && this.currentRoom.spawns.length > 0) {
      this.onRoomCleared();
    }
  }

  private onRoomCleared(): void {
    if (!this.currentRoom) return;

    AudioManager.play('SFX_DOOR_OPEN');
    this.currentRoom.openDoors();
    this.visitedRooms.add(this.currentRoomIndex);

    if (this.currentRoom.isBossRoom) {
      this.game.setState('VICTORY');
      return;
    }

    if (this.currentRoomIndex === CHAPTER_1_LAST_ROOM_INDEX) {
      this.game.markChapterBridgePending();
    }

    if (this.currentRoomIndex === 1) {
      this.game.unlockDash();
    }

    if (this.currentRoomIndex > 0) {
      const upgrades = getRandomUpgrades(3, {
        roomIndex: this.currentRoomIndex,
        theme: this.currentRoom.themeId,
        difficulty: this.game.difficulty,
        dashUnlocked: this.game.player.dashUnlocked,
      });
      this.game.showUpgradeSelection(upgrades);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.currentRoom) {
      this.currentRoom.render(ctx);
    }
  }
}
