import { InputManager } from './InputManager';
import { Entity } from '../entities/Entity';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Enemy } from '../entities/enemies/Enemy';
import { Room } from '../rooms/Room';
import { RoomManager } from '../systems/RoomManager';
import { CollisionSystem } from '../systems/CollisionSystem';
import { GAME, COLORS, type GameState } from '../utils/constants';
import { Vector2 } from '../utils/Vector2';
import { ParticleSystem } from '../rendering/particles';
import { AudioManager } from '../audio/AudioManager';
import type { Upgrade } from '../upgrades/Upgrade';

export interface GameCallbacks {
  onStateChange?: (state: GameState) => void;
  onHealthChange?: (health: number, maxHealth: number) => void;
  onRoomChange?: (roomIndex: number, totalRooms: number) => void;
  onUpgradeSelect?: (upgrades: Upgrade[]) => void;
  onGameOver?: (victory: boolean) => void;
}

export class Game {
  public state: GameState = 'MENU';
  public player: Player;
  public entities: Entity[] = [];
  public projectiles: Projectile[] = [];
  public enemies: Enemy[] = [];
  
  public input: InputManager;
  public roomManager: RoomManager;
  public collisionSystem: CollisionSystem;
  public particles: ParticleSystem;
  
  private ctx: CanvasRenderingContext2D;
  private lastTime: number = 0;
  private animationFrameId: number = 0;
  private callbacks: GameCallbacks;
  
  // Screen shake
  private shakeIntensity: number = 0;
  private shakeDecay: number = 0.9;

  constructor(ctx: CanvasRenderingContext2D, callbacks: GameCallbacks = {}) {
    this.ctx = ctx;
    this.callbacks = callbacks;
    
    this.input = new InputManager();
    this.roomManager = new RoomManager(this);
    this.collisionSystem = new CollisionSystem(this);
    this.particles = new ParticleSystem();
    
    // Create player at center of first room
    this.player = new Player(
      new Vector2(GAME.NATIVE_WIDTH / 2, GAME.NATIVE_HEIGHT / 2),
      this
    );
  }

  attach(canvas: HTMLCanvasElement): void {
    this.input.attach(canvas);
  }

  detach(): void {
    this.input.detach();
    this.stop();
  }

  start(): void {
    this.state = 'PLAYING';
    this.callbacks.onStateChange?.(this.state);
    this.roomManager.loadRoom(0);
    this.lastTime = performance.now();
    this.loop();
  }

  stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  restart(): void {
    // Reset game state
    this.entities = [];
    this.projectiles = [];
    this.enemies = [];
    this.particles.clear();
    
    // Reset player
    this.player = new Player(
      new Vector2(GAME.NATIVE_WIDTH / 2, GAME.NATIVE_HEIGHT / 2),
      this
    );
    
    // Reset room manager
    this.roomManager.reset();
    
    // Start fresh
    this.start();
  }

  setState(newState: GameState): void {
    this.state = newState;
    this.callbacks.onStateChange?.(newState);
    
    if (newState === 'GAME_OVER') {
      AudioManager.play('SFX_GAME_OVER');
      this.callbacks.onGameOver?.(false);
    } else if (newState === 'VICTORY') {
      AudioManager.play('SFX_VICTORY');
      this.callbacks.onGameOver?.(true);
    }
  }

  private loop = (): void => {
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();
    
    this.input.update();
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(deltaTime: number): void {
    // Handle pause toggle
    if (this.input.isKeyJustPressed('escape')) {
      if (this.state === 'PLAYING') {
        this.setState('PAUSED');
        return;
      } else if (this.state === 'PAUSED') {
        this.setState('PLAYING');
      }
    }

    if (this.state !== 'PLAYING') return;

    // Update player
    this.player.update(deltaTime);

    // Update enemies
    for (const enemy of this.enemies) {
      if (enemy.isActive) {
        enemy.update(deltaTime);
      }
    }

    // Update projectiles
    for (const projectile of this.projectiles) {
      if (projectile.isActive) {
        projectile.update(deltaTime);
      }
    }

    // Check collisions
    this.collisionSystem.update();

    // Update particles
    this.particles.update(deltaTime);

    // Clean up dead entities
    this.cleanupEntities();

    // Check room cleared
    this.roomManager.checkRoomCleared();

    // Check door transitions
    this.checkDoorTransition();

    // Update screen shake
    if (this.shakeIntensity > 0.1) {
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeIntensity = 0;
    }
  }

  private cleanupEntities(): void {
    this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);
    this.enemies = this.enemies.filter(e => !e.markedForDeletion);
  }

  private render(): void {
    const ctx = this.ctx;
    
    // Apply screen shake
    ctx.save();
    if (this.shakeIntensity > 0) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(shakeX, shakeY);
    }

    // Clear with floor color
    ctx.fillStyle = COLORS.FLOOR;
    ctx.fillRect(0, 0, GAME.NATIVE_WIDTH, GAME.NATIVE_HEIGHT);

    // Render current room
    this.roomManager.render(ctx);

    // Render enemies
    for (const enemy of this.enemies) {
      if (enemy.isActive) {
        enemy.render(ctx);
      }
    }

    // Render projectiles
    for (const projectile of this.projectiles) {
      if (projectile.isActive) {
        projectile.render(ctx);
      }
    }

    // Render player
    this.player.render(ctx);

    // Render particles on top
    this.particles.render(ctx);

    ctx.restore();
  }

  // Check if player is touching an open door and transition
  private checkDoorTransition(): void {
    const room = this.roomManager.currentRoom;
    if (!room) return;

    const door = room.getDoorAt(this.player.position);
    if (door && door.isOpen && door.targetRoom >= 0) {
      this.roomManager.transitionToRoom(door.targetRoom, door.direction);
    }
  }

  // Add a projectile to the game
  spawnProjectile(projectile: Projectile): void {
    this.projectiles.push(projectile);
  }

  // Add an enemy to the game
  spawnEnemy(enemy: Enemy): void {
    this.enemies.push(enemy);
  }

  // Trigger screen shake
  shake(intensity: number = 5): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  // Get current room
  getCurrentRoom(): Room | null {
    return this.roomManager.currentRoom;
  }

  // Notify UI of health change
  notifyHealthChange(): void {
    this.callbacks.onHealthChange?.(this.player.health, this.player.maxHealth);
  }

  // Notify UI of room change
  notifyRoomChange(): void {
    this.callbacks.onRoomChange?.(
      this.roomManager.currentRoomIndex,
      this.roomManager.totalRooms
    );
  }

  // Show upgrade selection
  showUpgradeSelection(upgrades: Upgrade[]): void {
    this.setState('UPGRADE');
    this.callbacks.onUpgradeSelect?.(upgrades);
  }

  // Apply selected upgrade
  applyUpgrade(upgrade: Upgrade): void {
    AudioManager.play('SFX_UPGRADE');
    upgrade.apply(this.player);
    this.setState('PLAYING');
  }
}
