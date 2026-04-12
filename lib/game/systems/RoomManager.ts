import type { Game } from '../engine/Game';
import { Room } from '../rooms/Room';
import { ROOM_CONFIGS, ROOM_CONNECTIONS } from '../rooms/roomData';
import { Spider } from '../entities/enemies/Spider';
import { Spitter } from '../entities/enemies/Spitter';
import { Dasher } from '../entities/enemies/Dasher';
import { WebSpinner } from '../entities/enemies/WebSpinner';
import { Broodmother } from '../entities/enemies/Broodmother';
import type { Direction } from '../utils/constants';
import { getRandomUpgrades } from '../upgrades/upgradePool';
import { AudioManager } from '../audio/AudioManager';

export class RoomManager {
  public currentRoom: Room | null = null;
  public currentRoomIndex: number = 0;
  public totalRooms: number = ROOM_CONFIGS.length;
  
  private game: Game;
  private rooms: Map<number, Room> = new Map();
  private visitedRooms: Set<number> = new Set();
  private lastDirection: Direction | null = null;

  constructor(game: Game) {
    this.game = game;
    this.initializeRooms();
  }

  private initializeRooms(): void {
    // Create all rooms from config
    for (const config of ROOM_CONFIGS) {
      const room = new Room(config);
      
      // Set door targets
      const connections = ROOM_CONNECTIONS.get(config.id);
      if (connections) {
        for (const [dir, targetRoom] of connections) {
          room.setDoorTarget(dir as Direction, targetRoom);
        }
      }
      
      this.rooms.set(config.id, room);
    }
  }

  reset(): void {
    this.visitedRooms.clear();
    this.currentRoom = null;
    this.currentRoomIndex = 0;
    this.lastDirection = null;
    
    // Reset all rooms
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
    
    // Clear existing entities
    this.game.enemies = [];
    this.game.projectiles = [];
    
    // Position player
    const spawnPos = room.getPlayerSpawnPosition(this.lastDirection);
    this.game.player.setPosition(spawnPos);
    
    // Spawn enemies if room not visited
    if (!this.visitedRooms.has(roomIndex)) {
      this.spawnEnemies(room);
      if (room.spawns.length > 0) {
        room.closeDoors();
      } else {
        // No enemies, room is already clear
        room.isCleared = true;
        room.openDoors();
        this.visitedRooms.add(roomIndex);
      }
    } else {
      // Already visited and cleared
      room.openDoors();
    }
    
    this.game.notifyRoomChange();

    if (this.game.state === 'PLAYING') {
      const track = room.isBossRoom ? 'MUSIC_BOSS' : 'MUSIC_GAME';
      void AudioManager.playMusic(track);
    }
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
        case 'broodmother':
          enemy = new Broodmother(spawn.position.clone(), this.game);
          break;
      }
      
      if (enemy) {
        this.game.spawnEnemy(enemy);
      }
    }
  }

  transitionToRoom(roomIndex: number, fromDirection: Direction): void {
    // Set direction for spawn positioning (opposite of where we came from)
    const oppositeDirections: Record<Direction, Direction> = {
      'NORTH': 'SOUTH',
      'SOUTH': 'NORTH',
      'EAST': 'WEST',
      'WEST': 'EAST',
    };
    this.lastDirection = oppositeDirections[fromDirection];
    
    this.loadRoom(roomIndex);
  }

  checkRoomCleared(): void {
    if (!this.currentRoom || this.currentRoom.isCleared) return;
    
    // Check if all enemies are dead
    const aliveEnemies = this.game.enemies.filter(e => e.isActive && !e.markedForDeletion);
    
    if (aliveEnemies.length === 0 && this.currentRoom.spawns.length > 0) {
      this.onRoomCleared();
    }
  }

  private onRoomCleared(): void {
    if (!this.currentRoom) return;
    
    AudioManager.play('SFX_DOOR_OPEN');
    this.currentRoom.openDoors();
    this.visitedRooms.add(this.currentRoomIndex);
    
    // Check for victory (boss room cleared)
    if (this.currentRoom.isBossRoom) {
      this.game.setState('VICTORY');
      return;
    }
    
    // Show upgrade selection (if not starting room)
    if (this.currentRoomIndex > 0) {
      const upgrades = getRandomUpgrades(3);
      this.game.showUpgradeSelection(upgrades);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.currentRoom) {
      this.currentRoom.render(ctx);
    }
  }
}
