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
import { walkableGridToWallRects, type ObstacleRect } from '../utils/obstacleCollision';

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
    | 'toxicspitter'
    | 'tidecrawler'
    | 'broodmother'
    | 'gillstalker'
    | 'murkleech'
    | 'brinescuttler'
    | 'trenchmatriarch';
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
  /** Room interior pixel size (defaults to full game viewport if omitted). */
  width?: number;
  height?: number;
  /**
   * When set, each cell is one 8×8 tile; `true` = walkable floor. Solid tiles render as
   * walls and contribute collision (merged) plus any `obstacles` props.
   */
  walkableGrid?: boolean[][];
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
  /** Crates / pillars only (not merged wall mass from `walkableGrid`). */
  public propObstacles: ObstacleRect[];
  /** Optional 8×8 tile walkability; `[ty][tx]`. */
  public readonly walkableGrid: boolean[][] | null;
  /** Playfield pixel width / height (room-local coordinates 0…width). */
  public readonly width: number;
  public readonly height: number;

  constructor(config: RoomConfig) {
    this.id = config.id;
    this.width = config.width ?? GAME.BUFFER_WIDTH;
    this.height = config.height ?? GAME.BUFFER_HEIGHT;
    this.spawns = config.spawns;
    this.isBossRoom = config.isBossRoom ?? false;
    this.themeId = config.theme ?? 'cellar';
    this.walkableGrid = config.walkableGrid ?? null;
    const props = (config.obstacles ?? []).map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
    this.propObstacles = props;
    if (this.walkableGrid) {
      const walls = walkableGridToWallRects(this.walkableGrid, 8);
      this.obstacles = [...walls, ...props];
    } else {
      this.obstacles = props;
    }
    
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
    const w = this.width;
    const h = this.height;
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

  /** Geometric center of walkable tiles, or bbox center when no grid. */
  getSafeRoomCenter(): Vector2 {
    if (!this.walkableGrid) {
      return new Vector2(this.width / 2, this.height / 2);
    }
    const g = this.walkableGrid;
    const th = g.length;
    const tw = g[0]?.length ?? 0;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let ty = 0; ty < th; ty++) {
      for (let tx = 0; tx < tw; tx++) {
        if (g[ty][tx]) {
          sx += tx * 8 + 4;
          sy += ty * 8 + 4;
          n++;
        }
      }
    }
    if (n === 0) return new Vector2(this.width / 2, this.height / 2);
    return new Vector2(sx / n, sy / n);
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
    const w = this.width;
    const h = this.height;
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
    const w = this.width;
    const h = this.height;
    const offset = this.wallThickness + 15;
    
    if (!fromDirection) {
      return this.getSafeRoomCenter();
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
    const w = this.width;
    const h = this.height;
    const wt = this.wallThickness;
    const pal = ROOM_THEME_PALETTES[this.themeId];

    if (this.walkableGrid) {
      this.renderTileRoom(ctx, w, h, wt, pal);
      return;
    }

    ctx.fillStyle = pal.floor;
    ctx.fillRect(0, 0, w, h);

    this.renderFloorVariation(ctx, w, h, wt, pal);

    this.renderAmbientDecor(ctx, w, h, wt, pal);

    this.renderObstaclesList(ctx, pal, this.propObstacles);

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

  private renderTileRoom(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    wt: number,
    pal: (typeof ROOM_THEME_PALETTES)[RoomThemeId]
  ): void {
    const g = this.walkableGrid!;
    const th = g.length;
    const tw = g[0]?.length ?? 0;
    const ts = 8;

    for (let ty = 0; ty < th; ty++) {
      for (let tx = 0; tx < tw; tx++) {
        const wx = tx * ts;
        const wy = ty * ts;
        const ok = g[ty][tx];
        ctx.fillStyle = ok ? pal.floor : pal.wall;
        ctx.fillRect(wx, wy, ts, ts);
      }
    }

    this.renderTileFloorAccents(ctx, g, tw, th, pal);

    ctx.fillStyle = pal.wallDark;
    for (let ty = 0; ty < th; ty++) {
      for (let tx = 0; tx < tw; tx++) {
        if (g[ty][tx]) continue;
        const wx = tx * ts;
        const wy = ty * ts;
        const up = ty > 0 && g[ty - 1][tx];
        const left = tx > 0 && g[ty][tx - 1];
        if (up) ctx.fillRect(wx, wy, ts, 1);
        if (left) ctx.fillRect(wx, wy, 1, ts);
      }
    }

    this.renderAmbientDecor(ctx, w, h, wt, pal);
    this.renderObstaclesList(ctx, pal, this.propObstacles);

    for (const [direction, door] of this.doors) {
      this.renderDoor(ctx, direction, door.isOpen, pal);
    }

    this.renderCornerWebs(ctx, pal);
  }

  private renderTileFloorAccents(
    ctx: CanvasRenderingContext2D,
    g: boolean[][],
    tw: number,
    th: number,
    pal: (typeof ROOM_THEME_PALETTES)[RoomThemeId]
  ): void {
    ctx.save();
    ctx.strokeStyle = pal.floorAccent;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 0.5;
    const step = 3;
    for (let ty = 0; ty < th; ty += step) {
      for (let tx = 0; tx < tw; tx += step) {
        if (!g[ty]?.[tx]) continue;
        const x = tx * 8;
        const y = ty * 8;
        ctx.strokeRect(x + 0.5, y + 0.5, 7, 7);
      }
    }
    ctx.restore();
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

  private renderObstaclesList(
    ctx: CanvasRenderingContext2D,
    pal: (typeof ROOM_THEME_PALETTES)[RoomThemeId],
    list: ObstacleRect[]
  ): void {
    for (const o of list) {
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

  /** Deterministic 0–1 for decor placement from room id. */
  private decorRand(k: number): number {
    const x = Math.sin(this.id * 12.9898 + k * 78.233 + this.themeId.length * 2.91) * 43758.5453;
    return x - Math.floor(x);
  }

  /**
   * Floor and wall-adjacent grime: vines, moss, mold, water stains, rust — theme-weighted.
   */
  private renderAmbientDecor(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    wt: number,
    pal: (typeof ROOM_THEME_PALETTES)[RoomThemeId]
  ): void {
    const innerW = w - wt * 2;
    const innerH = h - wt * 2;
    ctx.save();

    const drawMoldBlob = (cx: number, cy: number, rw: number, rh: number, rot: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw, rh, rot, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.ellipse(cx + 2, cy - 1, rw * 0.45, rh * 0.5, rot + 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const drawWaterPuddle = (cx: number, cy: number, rw: number, rh: number, alpha: number) => {
      ctx.fillStyle = `rgba(38,52,68,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw, rh, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(55,72,92,${alpha * 0.55})`;
      ctx.beginPath();
      ctx.ellipse(cx - 2, cy + 1, rw * 0.55, rh * 0.45, -0.2, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawRustStreak = (x0: number, y0: number, len: number, vertical: boolean) => {
      ctx.strokeStyle = 'rgba(110,55,28,0.55)';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      if (vertical) {
        ctx.moveTo(x0, y0);
        for (let t = 0; t <= 6; t++) {
          const yy = y0 + (len * t) / 6;
          const xx = x0 + Math.sin(t * 1.2 + this.id) * 1.2;
          ctx.lineTo(xx, yy);
        }
      } else {
        ctx.moveTo(x0, y0);
        for (let t = 0; t <= 6; t++) {
          const xx = x0 + (len * t) / 6;
          const yy = y0 + Math.cos(t * 1.1) * 1;
          ctx.lineTo(xx, yy);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const drawVineColumn = (x: number, y0: number, y1: number, phase: number, col: string) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.55;
      let y = y0;
      let px = x;
      while (y < y1) {
        const ny = Math.min(y + 5 + (this.decorRand(Math.floor(y)) * 3) | 0, y1);
        const nx = x + Math.sin(y * 0.11 + phase) * 2.5;
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        px = nx;
        y = ny;
      }
      ctx.globalAlpha = 0.35;
      for (let k = 0; k < 3; k++) {
        const ly = y0 + this.decorRand(30 + k) * (y1 - y0);
        ctx.beginPath();
        ctx.arc(x + Math.sin(ly * 0.09) * 2, ly, 2 + k, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    // Theme-specific layers
    switch (this.themeId) {
      case 'moss': {
        drawVineColumn(wt + 2, wt + 4, h - wt - 4, 0, '#2a4a32');
        drawVineColumn(wt + 5, wt + 10, h - wt - 12, 1.2, '#1f3a28');
        drawVineColumn(w - wt - 3, wt + 6, h - wt - 8, 2.1, '#2d5234');
        for (let i = 0; i < 6; i++) {
          const mx = wt + 8 + this.decorRand(i) * (innerW - 16);
          const my = wt + 6 + this.decorRand(i + 50) * (innerH - 12);
          drawMoldBlob(mx, my, 5 + this.decorRand(i + 2) * 6, 4 + this.decorRand(i + 3) * 4, this.decorRand(i + 4) * 0.5, '#1c3020');
        }
        drawWaterPuddle(
          wt + innerW * 0.72,
          h - wt - innerH * 0.22,
          10 + this.decorRand(7) * 8,
          6 + this.decorRand(8) * 4,
          0.28
        );
        break;
      }
      case 'cellar': {
        for (let i = 0; i < 8; i++) {
          const mx = wt + 6 + this.decorRand(i * 3) * (innerW - 12);
          const my = wt + 8 + this.decorRand(i * 3 + 1) * (innerH - 16);
          drawMoldBlob(mx, my, 4 + this.decorRand(i + 9) * 5, 3 + this.decorRand(i + 10) * 5, 0.2 * i, '#141210');
        }
        drawWaterPuddle(wt + innerW * 0.2, h - wt - 14, 14, 8, 0.32);
        drawWaterPuddle(w - wt - 26, wt + innerH * 0.35, 9, 6, 0.22);
        drawVineColumn(wt + 1, wt + 18, h - wt - 20, 0.5, '#2a3020');
        break;
      }
      case 'ash': {
        ctx.fillStyle = 'rgba(55,52,48,0.4)';
        for (let i = 0; i < 5; i++) {
          const sx = wt + this.decorRand(i + 11) * innerW;
          const sy = wt + this.decorRand(i + 22) * innerH;
          ctx.beginPath();
          ctx.ellipse(sx, sy, 8 + i * 2, 5, this.decorRand(i) * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = 0; i < 4; i++) {
          drawMoldBlob(
            wt + 10 + this.decorRand(i + 40) * (innerW - 20),
            wt + 10 + this.decorRand(i + 41) * (innerH - 20),
            5,
            4,
            0.3,
            '#1c1a18'
          );
        }
        drawRustStreak(w - wt - 2, wt + 12, innerH - 24, true);
        break;
      }
      case 'deep': {
        for (let i = 0; i < 7; i++) {
          drawMoldBlob(
            wt + 4 + this.decorRand(i + 60) * (innerW - 8),
            wt + 4 + this.decorRand(i + 61) * (innerH - 8),
            5 + this.decorRand(i + 62) * 7,
            4 + this.decorRand(i + 63) * 5,
            this.decorRand(i) * 0.8,
            '#120c18'
          );
        }
        drawWaterPuddle(w / 2 - 6, h - wt - 20, 18, 10, 0.38);
        drawWaterPuddle(wt + 16, wt + innerH * 0.55, 12, 7, 0.26);
        drawVineColumn(w - wt - 2, wt + 4, h - wt - 6, 0.8, '#1a1422');
        drawVineColumn(wt + 3, wt + 8, h * 0.55, 1.4, '#161020');
        break;
      }
      case 'rust': {
        for (let s = 0; s < 5; s++) {
          drawRustStreak(wt + 3 + s * 4, wt + 10 + s * 13, innerH - 20, true);
        }
        drawRustStreak(wt + 20, h - wt - 4, innerW - 40, false);
        ctx.fillStyle = 'rgba(90,42,22,0.28)';
        for (let i = 0; i < 6; i++) {
          const rx = wt + this.decorRand(i + 80) * innerW;
          const ry = wt + this.decorRand(i + 81) * innerH;
          ctx.beginPath();
          ctx.ellipse(rx, ry, 7, 5, this.decorRand(i) * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        drawWaterPuddle(w - wt - 30, h - wt - 18, 11, 7, 0.2);
        drawMoldBlob(wt + innerW * 0.45, wt + 12, 6, 5, 0.1, '#1a1410');
        break;
      }
      case 'flooded': {
        for (let i = 0; i < 12; i++) {
          drawWaterPuddle(
            wt + 10 + this.decorRand(140 + i) * (innerW - 20),
            wt + 8 + this.decorRand(160 + i) * (innerH - 16),
            8 + this.decorRand(180 + i) * 14,
            4 + this.decorRand(200 + i) * 7,
            0.34 + this.decorRand(210 + i) * 0.12
          );
        }
        for (let i = 0; i < 22; i++) {
          const bx = wt + 6 + this.decorRand(400 + i) * (innerW - 12);
          const by = wt + 6 + this.decorRand(500 + i) * (innerH - 12);
          ctx.fillStyle = `rgba(130, 230, 255, ${0.07 + this.decorRand(600 + i) * 0.12})`;
          ctx.beginPath();
          ctx.arc(bx, by, 0.9 + this.decorRand(700 + i) * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(55, 95, 110, 0.35)';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.45;
        for (let s = 0; s < 5; s++) {
          const y0 = wt + 14 + s * (innerH / 5);
          ctx.beginPath();
          ctx.moveTo(wt + 4, y0);
          for (let x = 0; x < 9; x++) {
            const xx = wt + 8 + (x * innerW) / 8;
            ctx.lineTo(xx + Math.sin(x * 1.1 + s) * 3, y0 + x * 1.2);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        drawVineColumn(wt + 2, wt + 5, h - wt - 5, 0.2, '#275460');
        drawVineColumn(w - wt - 2, wt + 8, h - wt - 10, 1.6, '#1d4551');
        drawVineColumn(w * 0.48, wt + 4, h * 0.55, 0.9, '#2f6570');
        break;
      }
      case 'toxicworks': {
        for (let i = 0; i < 10; i++) {
          drawWaterPuddle(
            wt + 12 + this.decorRand(220 + i) * (innerW - 24),
            wt + 8 + this.decorRand(250 + i) * (innerH - 18),
            7 + this.decorRand(300 + i) * 11,
            5 + this.decorRand(340 + i) * 6,
            0.28 + this.decorRand(350 + i) * 0.14
          );
        }
        for (let i = 0; i < 5; i++) {
          drawRustStreak(wt + 6 + i * 9, wt + 8 + i * 10, innerH - 18, true);
        }
        for (let i = 0; i < 18; i++) {
          const gx = wt + 10 + this.decorRand(800 + i) * (innerW - 20);
          const gy = wt + 10 + this.decorRand(820 + i) * (innerH - 20);
          ctx.fillStyle = `rgba(110, 255, 130, ${0.05 + this.decorRand(840 + i) * 0.09})`;
          ctx.beginPath();
          ctx.arc(gx, gy, 1 + this.decorRand(860 + i) * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(40, 70, 32, 0.55)';
        ctx.lineWidth = 1.2;
        for (let p = 0; p < 4; p++) {
          const x0 = wt + 10 + p * (innerW / 4);
          ctx.beginPath();
          ctx.moveTo(x0, h - wt - 6);
          ctx.lineTo(x0 + 3, h - wt - 22 - p * 5);
          ctx.stroke();
        }
        drawMoldBlob(w * 0.45, h * 0.48, 10, 8, 0.2, '#203018');
        drawMoldBlob(w * 0.62, h * 0.58, 8, 6, -0.3, '#1a2a12');
        drawMoldBlob(w * 0.28, h * 0.35, 9, 7, 0.4, '#243820');
        break;
      }
    }

    if (this.isBossRoom) {
      drawWaterPuddle(w * 0.35, h - wt - 14, 22, 11, 0.34);
      drawWaterPuddle(w * 0.62, wt + 18, 16, 9, 0.28);
      drawMoldBlob(w / 2, h / 2 + 8, 14, 10, 0.2, '#0c080e');
      drawRustStreak(wt + 1, wt + 6, innerH - 10, true);
    }

    // Light corner mold on all themes
    ctx.globalAlpha = 0.25;
    ctx.fillStyle =
      this.themeId === 'moss'
        ? '#1a2820'
        : this.themeId === 'flooded'
          ? '#10222a'
          : this.themeId === 'toxicworks'
            ? '#1a2612'
            : '#141210';
    const corners = [
      [wt + 6, wt + 6],
      [w - wt - 10, wt + 6],
      [wt + 8, h - wt - 10],
      [w - wt - 12, h - wt - 12],
    ] as const;
    for (let c = 0; c < corners.length; c++) {
      const [cx, cy] = corners[c];
      ctx.beginPath();
      ctx.arc(cx, cy, 5 + (c % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
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
    const w = this.width;
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
