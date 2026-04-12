import { Enemy } from './Enemy';
import { Spider } from './Spider';
import { Projectile } from '../Projectile';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS, GAME } from '../../utils/constants';
import { AudioManager } from '../../audio/AudioManager';
import type { Game } from '../../engine/Game';

type BossPhase = 'idle' | 'spawning' | 'shooting' | 'charging';

export class Broodmother extends Enemy {
  private phase: BossPhase = 'idle';
  private phaseTimer: number = 2;
  private spawnCooldown: number = 0;
  private shootCooldown: number = 0;
  private legAnimation: number = 0;
  private spawnedChildren: number = 0;
  private maxChildren: number = 4;

  constructor(position: Vector2, game: Game) {
    super(position, ENEMY.BROODMOTHER, game);
    // Play boss roar on spawn
    AudioManager.play('SFX_BOSS_ROAR');
  }

  protected updateBehavior(deltaTime: number): void {
    this.legAnimation += deltaTime * 4;
    this.phaseTimer -= deltaTime;
    
    // Count current children
    const currentChildren = this.game.enemies.filter(
      e => e instanceof Spider && e.isActive && !e.markedForDeletion
    ).length;
    
    // Phase transitions
    if (this.phaseTimer <= 0) {
      this.nextPhase(currentChildren);
    }
    
    // Execute current phase behavior
    switch (this.phase) {
      case 'idle':
        this.velocity.mulMut(0.95);
        break;
        
      case 'spawning':
        this.velocity.mulMut(0.95);
        this.spawnCooldown -= deltaTime;
        if (this.spawnCooldown <= 0 && currentChildren < this.maxChildren) {
          this.spawnChild();
          this.spawnCooldown = 0.8;
          this.spawnedChildren++;
        }
        break;
        
      case 'shooting':
        this.velocity.mulMut(0.95);
        this.shootCooldown -= deltaTime;
        if (this.shootCooldown <= 0) {
          this.shootSpread();
          this.shootCooldown = 0.6;
        }
        break;
        
      case 'charging':
        const dirToPlayer = this.getDirectionToPlayer();
        this.velocity = dirToPlayer.mul(this.speed * 2);
        break;
    }
    
    // Keep in bounds (boss is larger)
    const room = this.game.getCurrentRoom();
    if (room) {
      const halfSize = this.size / 2;
      const minX = room.wallThickness + halfSize;
      const maxX = GAME.NATIVE_WIDTH - room.wallThickness - halfSize;
      const minY = room.wallThickness + halfSize;
      const maxY = GAME.NATIVE_HEIGHT - room.wallThickness - halfSize;
      
      this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
      this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
    }
  }

  private nextPhase(currentChildren: number): void {
    // Choose next phase based on health and situation
    const healthPercent = this.health / this.maxHealth;
    
    if (healthPercent < 0.3) {
      // Low health: more aggressive
      this.phase = Math.random() < 0.6 ? 'charging' : 'shooting';
      this.phaseTimer = this.phase === 'charging' ? 2 : 3;
    } else if (currentChildren < 2 && Math.random() < 0.4) {
      // Few children, spawn more
      this.phase = 'spawning';
      this.phaseTimer = 3;
      this.spawnedChildren = 0;
    } else {
      // Random between shooting and charging
      const rand = Math.random();
      if (rand < 0.3) {
        this.phase = 'idle';
        this.phaseTimer = 1.5;
      } else if (rand < 0.6) {
        this.phase = 'shooting';
        this.phaseTimer = 2.5;
      } else {
        this.phase = 'charging';
        this.phaseTimer = 2;
      }
    }
  }

  private spawnChild(): void {
    // Spawn a spider at random offset from boss
    const angle = Math.random() * Math.PI * 2;
    const distance = this.size / 2 + 10;
    const spawnPos = this.position.add(new Vector2(
      Math.cos(angle) * distance,
      Math.sin(angle) * distance
    ));
    
    const spider = new Spider(spawnPos, this.game);
    this.game.spawnEnemy(spider);
  }

  private shootSpread(): void {
    // Shoot 5 projectiles in a spread pattern
    const baseAngle = this.position.angleTo(this.game.player.position);
    const spread = Math.PI / 3; // 60 degree spread
    
    for (let i = 0; i < 5; i++) {
      const angle = baseAngle + (i - 2) * (spread / 4);
      const direction = new Vector2(Math.cos(angle), Math.sin(angle));
      
      const projectile = new Projectile({
        position: this.position.clone(),
        direction,
        isPlayerProjectile: false,
        damage: this.damage,
        speed: 70,
      });
      
      this.game.spawnProjectile(projectile);
    }
  }

  protected die(): void {
    // Boss death - screen shake
    this.game.shake(15);
    super.die();
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const legOffset = Math.sin(this.legAnimation) * 2;
    
    // Draw 8 large legs
    ctx.strokeStyle = '#0a0202';
    ctx.lineWidth = 2;
    
    for (let i = 0; i < 4; i++) {
      const offset = (i % 2 === 0 ? legOffset : -legOffset);
      const yPos = (i - 1.5) * 6;
      
      // Left legs (articulated)
      ctx.beginPath();
      ctx.moveTo(-8, yPos);
      ctx.lineTo(-16, yPos - 4 + offset);
      ctx.lineTo(-20 + offset, yPos + 2);
      ctx.stroke();
      
      // Right legs
      ctx.beginPath();
      ctx.moveTo(8, yPos);
      ctx.lineTo(16, yPos - 4 - offset);
      ctx.lineTo(20 - offset, yPos + 2);
      ctx.stroke();
    }
    
    // Main body (cephalothorax)
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.BROODMOTHER_BODY;
    ctx.beginPath();
    ctx.ellipse(0, -4, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Large abdomen
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#2a0808';
    ctx.beginPath();
    ctx.ellipse(0, 10, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Abdomen pattern
    ctx.fillStyle = '#400a0a';
    ctx.beginPath();
    ctx.ellipse(0, 8, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Multiple eyes (8 eyes for a spider!)
    ctx.fillStyle = COLORS.SPIDER_EYES;
    // Main eyes
    ctx.beginPath();
    ctx.arc(-4, -8, 2, 0, Math.PI * 2);
    ctx.arc(4, -8, 2, 0, Math.PI * 2);
    ctx.fill();
    // Secondary eyes
    ctx.beginPath();
    ctx.arc(-6, -5, 1.5, 0, Math.PI * 2);
    ctx.arc(6, -5, 1.5, 0, Math.PI * 2);
    ctx.arc(-2, -6, 1, 0, Math.PI * 2);
    ctx.arc(2, -6, 1, 0, Math.PI * 2);
    ctx.fill();
    
    // Fangs
    ctx.fillStyle = '#330000';
    ctx.beginPath();
    ctx.moveTo(-3, -2);
    ctx.lineTo(-4, 4);
    ctx.lineTo(-2, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3, -2);
    ctx.lineTo(4, 4);
    ctx.lineTo(2, 2);
    ctx.fill();
    
    // Phase indicator
    if (this.phase === 'charging') {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2 + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (this.phase === 'spawning') {
      ctx.fillStyle = '#ff00ff';
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.ellipse(0, 10, 14, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    
    // Health bar
    const healthPercent = this.health / this.maxHealth;
    const barWidth = 40;
    const barHeight = 4;
    
    ctx.fillStyle = '#333333';
    ctx.fillRect(-barWidth / 2, -this.size / 2 - 10, barWidth, barHeight);
    
    ctx.fillStyle = healthPercent > 0.3 ? '#ff0000' : '#ff6600';
    ctx.fillRect(-barWidth / 2, -this.size / 2 - 10, barWidth * healthPercent, barHeight);
  }
}
