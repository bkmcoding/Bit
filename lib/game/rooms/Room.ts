import { Vector2 } from '../utils/Vector2';
import {
  ROOM,
  COLORS,
  GAME,
  PLAYER,
  ROOM_THEME_PALETTES,
  type Direction,
  type RoomThemeId,
} from '../utils/constants';
import type { ObstacleRect } from '../utils/obstacleCollision';

export interface SpawnPoint {
  position: Vector2;
  enemyType:
    | 'spider'
    | 'spitter'
    | 'dasher'
    | 'webspinner'
    | 'brute'
    | 'skitter'
    | 'widow'
    | 'broodmother';
}

export interface Door {
  direction: Direction;
  isOpen: boolean;
  targetRoom: number;
}

export interface RoomObstacleConfig {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoomConfig {
  id: number;
  doors: Direction[];
  spawns: SpawnPoint[];
  isBossRoom?: boolean;
  /** Visual + collision palette */
  theme?: RoomThemeId;
  /** Interior crates / pillars (native coords, inside walls). */
  obstacles?: RoomObstacleConfig[];
}

export class Room {
  public id: number;
  public doors: Map<Direction, Door> = new Map();
  public spawns: SpawnPoint[];
  public wallThickness: number = ROOM.WALL_THICKNESS;
  public isCleared: boolean = false;
  public isBossRoom: boolean;
  public themeId: RoomThemeId;
  public obstacles: ObstacleRect[];

  constructor(config: RoomConfig) {
    this.id = config.id;
    this.spawns = config.spawns;
    this.isBossRoom = config.isBossRoom ?? false;
    this.themeId = config.theme ?? 'cellar';
    this.obstacles = (config.obstacles ?? []).map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
    
    // Initialize doors
    for (const dir of config.doors) {
      this.doors.set(dir, {
        direction: dir,
        isOpen: false,
        targetRoom: -1, // Will be set by RoomManager
      });
    }
  }

  setDoorTarget(direction: Direction, targetRoom: number): void {
    const door = this.doors.get(direction);
    if (door) {
      door.targetRoom = targetRoom;
    }
  }

  openDoors(): void {
    for (const door of this.doors.values()) {
      door.isOpen = true;
    }
    this.isCleared = true;
  }

  closeDoors(): void {
    for (const door of this.doors.values()) {
      door.isOpen = false;
    }
  }

  /**
   * Hit area for walking through a door. Extends into the room from the wall strip so the
   * player's center (clamped inside the inner playfield) can overlap an open door — the
   * visual door rect alone sits past maxX/maxY and never intersected the player.
   */
  private getDoorInteractionBounds(direction: Direction): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const w = GAME.NATIVE_WIDTH;
    const h = GAME.NATIVE_HEIGHT;
    const dw = ROOM.DOOR_WIDTH;
    const dh = ROOM.DOOR_HEIGHT;
    const wt = this.wallThickness;
    const margin = PLAYER.SIZE / 2 + 2;

    switch (direction) {
      case 'NORTH':
        return { x: (w - dw) / 2, y: 0, width: dw, height: wt + margin };
      case 'SOUTH':
        return { x: (w - dw) / 2, y: h - wt - margin, width: dw, height: wt + margin };
      case 'EAST':
        return { x: w - wt - margin, y: (h - dh) / 2, width: wt + margin, height: dh };
      case 'WEST':
        return { x: 0, y: (h - dh) / 2, width: wt + margin, height: dh };
    }
  }

  getObstacleRects(): ObstacleRect[] {
    return this.obstacles;
  }

  getDoorAt(position: Vector2): Door | null {
    for (const [direction, door] of this.doors) {
      const doorBounds = this.getDoorInteractionBounds(direction);
      if (
        position.x >= doorBounds.x &&
        position.x <= doorBounds.x + doorBounds.width &&
        position.y >= doorBounds.y &&
        position.y <= doorBounds.y + doorBounds.height
      ) {
        return door;
      }
    }
    return null;
  }

  getDoorBounds(direction: Direction): { x: number; y: number; width: number; height: number } {
    const w = GAME.NATIVE_WIDTH;
    const h = GAME.NATIVE_HEIGHT;
    const dw = ROOM.DOOR_WIDTH;
    const dh = ROOM.DOOR_HEIGHT;
    const wt = this.wallThickness;
    
    switch (direction) {
      case 'NORTH':
        return { x: (w - dw) / 2, y: 0, width: dw, height: wt };
      case 'SOUTH':
        return { x: (w - dw) / 2, y: h - wt, width: dw, height: wt };
      case 'EAST':
        return { x: w - wt, y: (h - dw) / 2, width: wt, height: dw };
      case 'WEST':
        return { x: 0, y: (h - dw) / 2, width: wt, height: dw };
    }
  }

  getPlayerSpawnPosition(fromDirection: Direction | null): Vector2 {
    const w = GAME.NATIVE_WIDTH;
    const h = GAME.NATIVE_HEIGHT;
    const offset = this.wallThickness + 15;
    
    if (!fromDirection) {
      // Start of game, spawn in center
      return new Vector2(w / 2, h / 2);
    }
    
    // Spawn near the door we came from (opposite side)
    switch (fromDirection) {
      case 'NORTH':
        return new Vector2(w / 2, offset);
      case 'SOUTH':
        return new Vector2(w / 2, h - offset);
      case 'EAST':
        return new Vector2(w - offset, h / 2);
      case 'WEST':
        return new Vector2(offset, h / 2);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const w = GAME.NATIVE_WIDTH;
    const h = GAME.NATIVE_HEIGHT;
    const wt = this.wallThickness;
    const pal = ROOM_THEME_PALETTES[this.themeId];

    ctx.fillStyle = pal.floor;
    ctx.fillRect(0, 0, w, h);

    this.renderFloorVariation(ctx, w, h, wt, pal);

    this.renderObstacles(ctx, pal);

    ctx.fillStyle = pal.wall;

    ctx.fillRect(0, 0, w, wt);
    ctx.fillRect(0, h - wt, w, wt);
    ctx.fillRect(0, 0, wt, h);
    ctx.fillRect(w - wt, 0, wt, h);

    ctx.fillStyle = pal.wallDark;
    ctx.fillRect(wt, wt, w - wt * 2, 2);
    ctx.fillRect(wt, wt, 2, h - wt * 2);

    for (const [direction, door] of this.doors) {
      this.renderDoor(ctx, direction, door.isOpen, pal);
    }

    this.renderCornerWebs(ctx, pal);
  }

  private renderFloorVariation(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    wt: number,
    pal: (typeof ROOM_THEME_PALETTES)[RoomThemeId]
  ): void {
    const innerW = w - wt * 2;
    const innerH = h - wt * 2;
    ctx.save();
    ctx.strokeStyle = pal.floorAccent;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 0.5;

    const seed = this.id * 17;
    const step = 20 + (seed % 8);
    for (let x = wt; x < w - wt; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, wt);
      ctx.lineTo(x, h - wt);
      ctx.stroke();
    }
    for (let y = wt; y < h - wt; y += step) {
      ctx.beginPath();
      ctx.moveTo(wt, y);
      ctx.lineTo(w - wt, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 3; i++) {
      const ox = wt + ((seed + i * 41) % Math.max(1, innerW - 24));
      const oy = wt + ((seed + i * 59) % Math.max(1, innerH - 24));
      ctx.fillStyle = pal.floorAccent;
      ctx.fillRect(ox, oy, 10 + (i % 3) * 4, 8);
    }

    ctx.globalAlpha = 0.14;
    for (let s = 0; s < 5; s++) {
      const sx = wt + ((seed + s * 73) % Math.max(8, innerW - 20));
      const sy = wt + ((seed + s * 91) % Math.max(8, innerH - 16));
      const rw = 14 + (s % 3) * 6;
      const rh = 10 + (s % 2) * 5;
      ctx.fillStyle = '#1a0808';
      ctx.beginPath();
      ctx.ellipse(sx, sy, rw * 0.5, rh * 0.5, 0.3 + s * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderObstacles(
    ctx: CanvasRenderingContext2D,
    pal: (typeof ROOM_THEME_PALETTES)[RoomThemeId]
  ): void {
    for (const o of this.obstacles) {
      ctx.fillStyle = pal.obstacle;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = pal.obstacleTop;
      ctx.fillRect(o.x, o.y, o.w, 2);
      ctx.strokeStyle = pal.wallDark;
      ctx.lineWidth = 1;
      ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
    }
  }

  private renderDoor(
    ctx: CanvasRenderingContext2D,
    direction: Direction,
    isOpen: boolean,
    pal: (typeof ROOM_THEME_PALETTES)[RoomThemeId]
  ): void {
    const bounds = this.getDoorBounds(direction);

    ctx.fillStyle = isOpen ? COLORS.DOOR_OPEN : COLORS.DOOR_CLOSED;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    
    // Door frame
    if (isOpen) {
      ctx.fillStyle = pal.wallDark;
      if (direction === 'NORTH' || direction === 'SOUTH') {
        ctx.fillRect(bounds.x - 2, bounds.y, 2, bounds.height);
        ctx.fillRect(bounds.x + bounds.width, bounds.y, 2, bounds.height);
      } else {
        ctx.fillRect(bounds.x, bounds.y - 2, bounds.width, 2);
        ctx.fillRect(bounds.x, bounds.y + bounds.height, bounds.width, 2);
      }
    }
  }

  private renderCornerWebs(
    ctx: CanvasRenderingContext2D,
    _pal: (typeof ROOM_THEME_PALETTES)[RoomThemeId]
  ): void {
    ctx.strokeStyle = 'rgba(120, 110, 118, 0.55)';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.48;
    
    const wt = this.wallThickness;
    const webSize = 12;
    
    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(wt, wt);
    ctx.lineTo(wt + webSize, wt);
    ctx.moveTo(wt, wt);
    ctx.lineTo(wt, wt + webSize);
    ctx.moveTo(wt, wt);
    ctx.lineTo(wt + webSize * 0.7, wt + webSize * 0.7);
    ctx.stroke();
    
    // Top-right corner
    const w = GAME.NATIVE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(w - wt, wt);
    ctx.lineTo(w - wt - webSize, wt);
    ctx.moveTo(w - wt, wt);
    ctx.lineTo(w - wt, wt + webSize);
    ctx.moveTo(w - wt, wt);
    ctx.lineTo(w - wt - webSize * 0.7, wt + webSize * 0.7);
    ctx.stroke();
    
    ctx.globalAlpha = 1;
  }
}
