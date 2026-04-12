import { Vector2 } from '../utils/Vector2';
import { ROOM, COLORS, GAME, PLAYER, type Direction } from '../utils/constants';

export interface SpawnPoint {
  position: Vector2;
  enemyType: 'spider' | 'spitter' | 'dasher' | 'webspinner' | 'broodmother';
}

export interface Door {
  direction: Direction;
  isOpen: boolean;
  targetRoom: number;
}

export interface RoomConfig {
  id: number;
  doors: Direction[];
  spawns: SpawnPoint[];
  isBossRoom?: boolean;
}

export class Room {
  public id: number;
  public doors: Map<Direction, Door> = new Map();
  public spawns: SpawnPoint[];
  public wallThickness: number = ROOM.WALL_THICKNESS;
  public isCleared: boolean = false;
  public isBossRoom: boolean;

  constructor(config: RoomConfig) {
    this.id = config.id;
    this.spawns = config.spawns;
    this.isBossRoom = config.isBossRoom ?? false;
    
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
    
    // Draw walls
    ctx.fillStyle = COLORS.WALL;
    
    // Top wall
    ctx.fillRect(0, 0, w, wt);
    // Bottom wall
    ctx.fillRect(0, h - wt, w, wt);
    // Left wall
    ctx.fillRect(0, 0, wt, h);
    // Right wall
    ctx.fillRect(w - wt, 0, wt, h);
    
    // Wall inner shadow
    ctx.fillStyle = COLORS.WALL_DARK;
    ctx.fillRect(wt, wt, w - wt * 2, 2);
    ctx.fillRect(wt, wt, 2, h - wt * 2);
    
    // Draw doors
    for (const [direction, door] of this.doors) {
      this.renderDoor(ctx, direction, door.isOpen);
    }
    
    // Draw corner decorations (cobwebs)
    this.renderCornerWebs(ctx);
  }

  private renderDoor(ctx: CanvasRenderingContext2D, direction: Direction, isOpen: boolean): void {
    const bounds = this.getDoorBounds(direction);
    
    ctx.fillStyle = isOpen ? COLORS.DOOR_OPEN : COLORS.DOOR_CLOSED;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    
    // Door frame
    if (isOpen) {
      ctx.fillStyle = COLORS.WALL_DARK;
      if (direction === 'NORTH' || direction === 'SOUTH') {
        ctx.fillRect(bounds.x - 2, bounds.y, 2, bounds.height);
        ctx.fillRect(bounds.x + bounds.width, bounds.y, 2, bounds.height);
      } else {
        ctx.fillRect(bounds.x, bounds.y - 2, bounds.width, 2);
        ctx.fillRect(bounds.x, bounds.y + bounds.height, bounds.width, 2);
      }
    }
  }

  private renderCornerWebs(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = COLORS.WEB;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;
    
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
