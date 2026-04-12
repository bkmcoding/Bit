import { Vector2 } from '../utils/Vector2';

interface Particle {
  position: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];

  update(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Update position
      p.position.addMut(p.velocity.mul(deltaTime));
      
      // Apply gravity/friction
      p.velocity.mulMut(0.95);
      
      // Decrease life
      p.life -= deltaTime;
      
      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      
      const size = p.size * alpha;
      ctx.fillRect(
        Math.round(p.position.x - size / 2),
        Math.round(p.position.y - size / 2),
        Math.ceil(size),
        Math.ceil(size)
      );
    }
    ctx.globalAlpha = 1;
  }

  // Spawn particles at a position
  emit(position: Vector2, color: string, count: number = 5, speed: number = 50): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = new Vector2(
        Math.cos(angle) * speed * (0.5 + Math.random() * 0.5),
        Math.sin(angle) * speed * (0.5 + Math.random() * 0.5)
      );
      
      this.particles.push({
        position: position.clone(),
        velocity,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        color,
        size: 2 + Math.random() * 2,
      });
    }
  }

  // Hit effect (directional)
  emitHit(position: Vector2, direction: Vector2, color: string): void {
    for (let i = 0; i < 4; i++) {
      const spread = (Math.random() - 0.5) * 0.5;
      const dir = direction.rotate(spread);
      const velocity = dir.mul(30 + Math.random() * 30);
      
      this.particles.push({
        position: position.clone(),
        velocity,
        life: 0.2 + Math.random() * 0.2,
        maxLife: 0.4,
        color,
        size: 2,
      });
    }
  }

  // Death explosion
  emitDeath(position: Vector2, color: string): void {
    this.emit(position, color, 12, 80);
  }

  clear(): void {
    this.particles = [];
  }
}
