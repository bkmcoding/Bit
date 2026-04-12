import { Enemy } from './Enemy';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS } from '../../utils/constants';
import type { Game } from '../../engine/Game';

interface WebTrap {
  position: Vector2;
  lifetime: number;
  radius: number;
}

export class WebSpinner extends Enemy {
  private webCooldown: number;
  private webs: WebTrap[] = [];
  private legAnimation: number = 0;
  private wanderDirection: Vector2;
  private wanderTimer: number;

  constructor(position: Vector2, game: Game) {
    super(position, ENEMY.WEBSPINNER, game);
    this.webCooldown = ENEMY.WEBSPINNER.webCooldown / 2;
    this.wanderDirection = new Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize();
    this.wanderTimer = Math.random() * 3 + 2;
  }

  protected updateBehavior(deltaTime: number): void {
    this.legAnimation += deltaTime * 6;
    
    // Slow wander
    this.wanderTimer -= deltaTime;
    if (this.wanderTimer <= 0) {
      this.wanderDirection = new Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize();
      this.wanderTimer = Math.random() * 3 + 2;
    }
    this.velocity = this.wanderDirection.mul(this.speed);
    
    // Web spawning
    this.webCooldown -= deltaTime;
    if (this.webCooldown <= 0) {
      this.spawnWeb();
      this.webCooldown = ENEMY.WEBSPINNER.webCooldown;
    }
    
    // Update existing webs
    for (let i = this.webs.length - 1; i >= 0; i--) {
      this.webs[i].lifetime -= deltaTime;
      if (this.webs[i].lifetime <= 0) {
        this.webs.splice(i, 1);
        continue;
      }
      
      // Check if player is in web
      const web = this.webs[i];
      const distToPlayer = web.position.distanceTo(this.game.player.position);
      if (distToPlayer < web.radius + this.game.player.size / 2) {
        // Slow player (applied in player update ideally, but we can reduce velocity here)
        this.game.player.velocity.mulMut(0.5);
      }
    }
  }

  private spawnWeb(): void {
    this.webs.push({
      position: this.position.clone(),
      lifetime: 8,
      radius: 15,
    });
  }

  protected die(): void {
    // Clear webs when dying
    this.webs = [];
    super.die();
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    // Draw webs first (so they appear under the spider)
    for (const web of this.webs) {
      this.renderWeb(ctx, web);
    }
    
    const legOffset = Math.sin(this.legAnimation) * 1;
    
    // Draw legs (8 legs)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 4; i++) {
      const offset = (i % 2 === 0 ? legOffset : -legOffset);
      // Left
      ctx.beginPath();
      ctx.moveTo(-4, (i - 1.5) * 3);
      ctx.lineTo(-8 + offset, (i - 1.5) * 4);
      ctx.stroke();
      // Right
      ctx.beginPath();
      ctx.moveTo(4, (i - 1.5) * 3);
      ctx.lineTo(8 - offset, (i - 1.5) * 4);
      ctx.stroke();
    }
    
    // Body (gray)
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.WEBSPINNER_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Large abdomen (where silk comes from)
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#4a4a4a';
    ctx.beginPath();
    ctx.ellipse(0, 6, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Web pattern on abdomen
    ctx.strokeStyle = COLORS.WEB;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(-3, 4);
    ctx.lineTo(0, 6);
    ctx.lineTo(3, 4);
    ctx.moveTo(-3, 8);
    ctx.lineTo(0, 6);
    ctx.lineTo(3, 8);
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    // Many eyes
    ctx.fillStyle = '#888888';
    ctx.beginPath();
    ctx.arc(-2, -2, 1, 0, Math.PI * 2);
    ctx.arc(2, -2, 1, 0, Math.PI * 2);
    ctx.arc(-1, -1, 0.5, 0, Math.PI * 2);
    ctx.arc(1, -1, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderWeb(ctx: CanvasRenderingContext2D, web: WebTrap): void {
    // Calculate position relative to spider (since we're in translated context)
    const relX = web.position.x - this.position.x;
    const relY = web.position.y - this.position.y;
    
    ctx.save();
    ctx.translate(relX, relY);
    
    // Fade out as lifetime decreases
    const alpha = Math.min(1, web.lifetime / 2);
    ctx.globalAlpha = alpha * 0.4;
    
    // Web circle
    ctx.strokeStyle = COLORS.WEB;
    ctx.lineWidth = 0.5;
    
    // Concentric circles
    for (let r = 5; r <= web.radius; r += 5) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Radial lines
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * web.radius, Math.sin(angle) * web.radius);
      ctx.stroke();
    }
    
    ctx.restore();
  }
}
