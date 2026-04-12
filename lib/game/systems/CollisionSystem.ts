import type { Game } from '../engine/Game';
import type { Entity } from '../entities/Entity';
import { Projectile } from '../entities/Projectile';
import { Enemy } from '../entities/enemies/Enemy';

export class CollisionSystem {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  update(): void {
    // Player projectiles vs enemies
    for (const projectile of this.game.projectiles) {
      if (!projectile.isActive || !projectile.isPlayerProjectile) continue;
      
      for (const enemy of this.game.enemies) {
        if (!enemy.isActive) continue;
        if (projectile.hasHit(enemy.id)) continue;
        
        if (this.checkCollision(projectile, enemy)) {
          enemy.takeDamage(projectile.damage);
          projectile.registerHit(enemy.id);
        }
      }
    }
    
    // Enemy projectiles vs player
    for (const projectile of this.game.projectiles) {
      if (!projectile.isActive || projectile.isPlayerProjectile) continue;
      
      if (this.checkCollision(projectile, this.game.player)) {
        this.game.player.takeDamage(projectile.damage);
        projectile.destroy();
      }
    }
    
    // Enemies vs player (contact damage)
    for (const enemy of this.game.enemies) {
      if (!enemy.isActive) continue;
      
      if (this.checkCollision(enemy, this.game.player)) {
        this.game.player.takeDamage(enemy.damage);
      }
    }
  }

  private checkCollision(a: Entity, b: Entity): boolean {
    const boundsA = a.getBounds();
    const boundsB = b.getBounds();
    
    return (
      boundsA.x < boundsB.x + boundsB.width &&
      boundsA.x + boundsA.width > boundsB.x &&
      boundsA.y < boundsB.y + boundsB.height &&
      boundsA.y + boundsA.height > boundsB.y
    );
  }

}
