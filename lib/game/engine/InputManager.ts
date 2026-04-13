import { Vector2 } from '../utils/Vector2';
import { GAME } from '../utils/constants';

export class InputManager {
  private keys: Set<string> = new Set();
  private keysJustPressed: Set<string> = new Set();
  private keysJustReleased: Set<string> = new Set();
  
  private mousePosition: Vector2 = new Vector2();
  private mouseDown: boolean = false;
  private mouseJustPressed: boolean = false;
  private mouseJustReleased: boolean = false;
  
  private canvas: HTMLCanvasElement | null = null;
  
  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  detach(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.handleMouseMove);
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('mouseup', this.handleMouseUp);
      this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    }
    
    this.canvas = null;
  }

  // Call at end of each frame to clear "just pressed" states
  update(): void {
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
    this.mouseJustPressed = false;
    this.mouseJustReleased = false;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    if (!this.keys.has(key)) {
      this.keysJustPressed.add(key);
    }
    this.keys.add(key);
    
    // Prevent default for game keys
    if (['w', 'a', 's', 'd', ' ', 'escape'].includes(key)) {
      e.preventDefault();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    this.keys.delete(key);
    this.keysJustReleased.add(key);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.canvas) return;
    
    const rect = this.canvas.getBoundingClientRect();
    // Convert screen coordinates to *buffer* game coordinates (352x208).
    // This stays correct even if the canvas is CSS-scaled to fit the viewport.
    const sx = rect.width / GAME.BUFFER_WIDTH;
    const sy = rect.height / GAME.BUFFER_HEIGHT;
    this.mousePosition.set((e.clientX - rect.left) / sx, (e.clientY - rect.top) / sy);
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button === 0) { // Left click
      this.mouseDown = true;
      this.mouseJustPressed = true;
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseDown = false;
      this.mouseJustReleased = true;
    }
  }

  private handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
  }

  // Key state queries
  isKeyDown(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  isKeyJustPressed(key: string): boolean {
    return this.keysJustPressed.has(key.toLowerCase());
  }

  isKeyJustReleased(key: string): boolean {
    return this.keysJustReleased.has(key.toLowerCase());
  }

  // Mouse state queries
  isMouseDown(): boolean {
    return this.mouseDown;
  }

  isMouseJustPressed(): boolean {
    return this.mouseJustPressed;
  }

  isMouseJustReleased(): boolean {
    return this.mouseJustReleased;
  }

  getMousePosition(): Vector2 {
    return this.mousePosition.clone();
  }

  // Movement helper — opposing keys on an axis cancel (no net horizontal/vertical).
  getMovementDirection(): Vector2 {
    const dir = new Vector2();

    const up = this.isKeyDown('w') || this.isKeyDown('arrowup');
    const down = this.isKeyDown('s') || this.isKeyDown('arrowdown');
    const left = this.isKeyDown('a') || this.isKeyDown('arrowleft');
    const right = this.isKeyDown('d') || this.isKeyDown('arrowright');

    if (up !== down) dir.y += down ? 1 : -1;
    if (left !== right) dir.x += right ? 1 : -1;

    if (dir.magnitudeSq() > 0) {
      dir.normalizeMut();
    }

    return dir;
  }

  // Get aim direction from position to mouse
  getAimDirection(fromPosition: Vector2): Vector2 {
    return this.mousePosition.sub(fromPosition).normalize();
  }
}
