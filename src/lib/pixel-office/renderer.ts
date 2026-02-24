// ---------------------------------------------------------------------------
// Pixel Office V2 — Canvas Renderer
// ---------------------------------------------------------------------------

import type {
  OfficeState,
  SpriteData,
  Character,
  Cat,
  Particle,
  Furniture,
  ServerLed,
  MonitorState,
  RenderEntity,
  TileInfo,
} from "./types";
import { TILE_SIZE, ZOOM, GRID_COLS, GRID_ROWS, COLORS } from "./types";
import { buildTileMap } from "./tilemap";
import { getWindowColors, getClockAngles, formatClockTime, getWindowRect } from "./effects";
import { CAT_SPRITES } from "./sprites";

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export class PixelOfficeRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bgCanvas: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private tileMap: TileInfo[][];
  private bgDirty = true;
  private canvasWidth = 0;
  private canvasHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2d context");
    this.ctx = ctx;

    this.bgCanvas = document.createElement("canvas");
    const bgCtx = this.bgCanvas.getContext("2d");
    if (!bgCtx) throw new Error("Failed to get offscreen 2d context");
    this.bgCtx = bgCtx;

    this.tileMap = buildTileMap();
    this.resize();
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;

    this.canvasWidth = w;
    this.canvasHeight = h;

    // Background canvas matches the pixel art size
    const bgW = GRID_COLS * TILE_SIZE;
    const bgH = GRID_ROWS * TILE_SIZE;
    this.bgCanvas.width = bgW;
    this.bgCanvas.height = bgH;
    const freshBgCtx = this.bgCanvas.getContext("2d");
    if (freshBgCtx) {
      this.bgCtx = freshBgCtx;
      this.bgCtx.imageSmoothingEnabled = false;
    }

    this.bgDirty = true;
  }

  getEntityAt(
    clientX: number,
    clientY: number,
    state: OfficeState,
  ): { type: "agent" | "cat"; id: string } | null {
    const rect = this.canvas.getBoundingClientRect();
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;

    // Convert to pixel art coordinates
    const officeW = GRID_COLS * TILE_SIZE * ZOOM;
    const officeH = GRID_ROWS * TILE_SIZE * ZOOM;
    const offsetX = Math.max(0, (this.canvasWidth - officeW) / 2);
    const offsetY = Math.max(0, (this.canvasHeight - officeH) / 2);

    const px = (cssX - offsetX) / ZOOM;
    const py = (cssY - offsetY) / ZOOM;

    // Check characters (reverse order for top-most first)
    for (let i = state.characters.length - 1; i >= 0; i--) {
      const char = state.characters[i];
      if (px >= char.x && px < char.x + 16 && py >= char.y && py < char.y + 16) {
        return { type: "agent", id: char.id };
      }
    }

    // Check cat
    const cat = state.cat;
    if (px >= cat.x && px < cat.x + 8 && py >= cat.y && py < cat.y + 8) {
      return { type: "cat", id: "cat" };
    }

    return null;
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  render(state: OfficeState, _dt: number): void {
    const ctx = this.ctx;
    const officeW = GRID_COLS * TILE_SIZE;
    const officeH = GRID_ROWS * TILE_SIZE;

    // Draw background (cached)
    if (this.bgDirty) {
      this.drawBackground(this.bgCtx, state);
      this.bgDirty = false;
    }

    // Clear
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Center the office in the canvas
    const scaledW = officeW * ZOOM;
    const scaledH = officeH * ZOOM;
    const offsetX = Math.max(0, (this.canvasWidth - scaledW) / 2);
    const offsetY = Math.max(0, (this.canvasHeight - scaledH) / 2);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(ZOOM, ZOOM);
    ctx.imageSmoothingEnabled = false;

    // Draw cached background
    ctx.drawImage(this.bgCanvas, 0, 0);

    // Draw window (animated, not cached)
    this.drawWindow(ctx, state);

    // Draw clock
    this.drawClock(ctx, state);

    // Collect z-sortable entities
    const entities: RenderEntity[] = [];

    // Furniture entities
    for (const f of state.furniture) {
      const fRef = f;
      entities.push({
        type: "furniture",
        zSortY: f.zSortY,
        id: `furniture_${f.type}_${f.col}_${f.row}`,
        render: (c) => this.drawSprite(c, fRef.sprite, fRef.col * TILE_SIZE, fRef.row * TILE_SIZE),
      });
    }

    // Character entities
    for (const char of state.characters) {
      const charRef = char;
      entities.push({
        type: "character",
        zSortY: char.y + 16,
        id: char.id,
        render: (c, frame) => this.drawCharacter(c, charRef, frame),
      });
    }

    // Cat entity
    entities.push({
      type: "cat",
      zSortY: state.cat.y + 8,
      id: "cat",
      render: (c, frame) => this.drawCat(c, state.cat, frame),
    });

    // Z-sort (lower y = further back = drawn first)
    entities.sort((a, b) => a.zSortY - b.zSortY);

    // Draw all entities
    for (const entity of entities) {
      entity.render(ctx, state.frame);
    }

    // Draw monitor screens (on top of desk/monitor furniture)
    this.drawMonitorScreens(ctx, state);

    // Draw server LEDs
    this.drawServerLeds(ctx, state.serverLeds);

    // Draw particles
    this.drawParticles(ctx, state.particles, state.frame);

    // Draw speech/thought bubbles
    for (const char of state.characters) {
      this.drawCharacterOverlay(ctx, char, state.frame);
    }

    // Draw name labels
    for (const char of state.characters) {
      this.drawNameLabel(ctx, char);
    }

    // Night overlay
    if (state.environment.nightOverlayAlpha > 0) {
      ctx.fillStyle = `rgba(0,0,20,${state.environment.nightOverlayAlpha})`;
      ctx.fillRect(0, 0, officeW, officeH);
    }

    ctx.restore();

    // Draw Athens time overlay (top-right, outside the scaled area)
    this.drawTimeOverlay(ctx, state, offsetX, scaledW);
  }

  // -----------------------------------------------------------------------
  // Background (static, cached)
  // -----------------------------------------------------------------------

  private drawBackground(ctx: CanvasRenderingContext2D, state: OfficeState): void {
    const w = GRID_COLS * TILE_SIZE;
    const h = GRID_ROWS * TILE_SIZE;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, w, h);

    // Draw floor tiles
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = this.tileMap[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        switch (tile.type) {
          case "floor_work":
            ctx.fillStyle = tile.variant === 0 ? COLORS.FLOOR_WORK_A : COLORS.FLOOR_WORK_B;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            break;
          case "floor_kitchen":
            ctx.fillStyle = tile.variant === 0 ? COLORS.FLOOR_KITCHEN_A : COLORS.FLOOR_KITCHEN_B;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            break;
          case "floor_server":
            ctx.fillStyle = tile.variant === 0 ? COLORS.FLOOR_SERVER_A : COLORS.FLOOR_SERVER_B;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            break;
          case "floor_lounge":
            ctx.fillStyle = tile.variant === 0 ? COLORS.FLOOR_LOUNGE_A : COLORS.FLOOR_LOUNGE_B;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            break;
          case "door":
            ctx.fillStyle = COLORS.FLOOR_WORK_A;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            break;
          case "wall":
            ctx.fillStyle = COLORS.WALL;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            // Accent line on bottom edge of top walls, right edge of left walls
            if (r === 0 || (r > 0 && this.tileMap[r - 1][c].type !== "wall")) {
              ctx.fillStyle = COLORS.WALL_ACCENT;
              ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 2);
            }
            break;
          case "window":
            // Will be drawn dynamically
            ctx.fillStyle = COLORS.WALL;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            break;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Window (day/night cycle + rain)
  // -----------------------------------------------------------------------

  private drawWindow(ctx: CanvasRenderingContext2D, state: OfficeState): void {
    const win = getWindowRect();
    const colors = getWindowColors(state.environment.timeOfDay);

    // Window frame
    ctx.fillStyle = COLORS.WALL_ACCENT;
    ctx.fillRect(win.x - 1, win.y, win.w + 2, win.h);

    // Sky gradient (simple 2-band)
    const halfH = Math.floor(win.h / 2);
    ctx.fillStyle = colors.top;
    ctx.fillRect(win.x, win.y + 2, win.w, halfH);
    ctx.fillStyle = colors.bottom;
    ctx.fillRect(win.x, win.y + 2 + halfH, win.w, halfH);

    // Day: clouds
    if (state.environment.timeOfDay === "day") {
      ctx.fillStyle = "#FFFFFF";
      const cloudX = win.x + 10 + (state.frame * 0.1) % 50;
      ctx.fillRect(cloudX, win.y + 4, 6, 2);
      ctx.fillRect(cloudX + 2, win.y + 3, 4, 1);
    }

    // Night: stars (static ones in addition to particles)
    if (state.environment.timeOfDay === "night") {
      ctx.fillStyle = "#FFFFFF";
      const starPositions = [
        [win.x + 5, win.y + 4],
        [win.x + 20, win.y + 3],
        [win.x + 40, win.y + 5],
        [win.x + 55, win.y + 3],
        [win.x + 35, win.y + 8],
      ];
      for (const [sx, sy] of starPositions) {
        if (state.frame % 60 < 50 || Math.random() > 0.3) {
          ctx.fillRect(sx, sy, 1, 1);
        }
      }
    }

    // Window frame border
    ctx.fillStyle = "#555570";
    ctx.fillRect(win.x - 1, win.y + 1, 1, win.h - 1);
    ctx.fillRect(win.x + win.w, win.y + 1, 1, win.h - 1);
    ctx.fillRect(win.x, win.y + 1, win.w, 1);
    ctx.fillRect(win.x, win.y + win.h - 1, win.w, 1);
    // Center divider
    ctx.fillRect(win.x + Math.floor(win.w / 2), win.y + 1, 1, win.h - 1);
  }

  // -----------------------------------------------------------------------
  // Wall Clock
  // -----------------------------------------------------------------------

  private drawClock(ctx: CanvasRenderingContext2D, state: OfficeState): void {
    // Clock on the wall of the work area (right side of top wall)
    const cx = 18 * TILE_SIZE + 8;
    const cy = 6;
    const radius = 5;

    // Face
    ctx.fillStyle = "#3A3A5A";
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          ctx.fillRect(cx + dx, cy + dy, 1, 1);
        }
      }
    }

    // Border
    ctx.fillStyle = "#5A5A7A";
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = dx * dx + dy * dy;
        if (dist <= radius * radius && dist >= (radius - 1) * (radius - 1)) {
          ctx.fillRect(cx + dx, cy + dy, 1, 1);
        }
      }
    }

    // Center dot
    ctx.fillStyle = "#CCCCDD";
    ctx.fillRect(cx, cy, 1, 1);

    // Hands
    const { hourAngle, minuteAngle } = getClockAngles(
      state.environment.hour,
      state.environment.minute,
    );

    const hx = Math.round(cx + Math.cos(hourAngle) * 3);
    const hy = Math.round(cy + Math.sin(hourAngle) * 3);
    this.drawPixelLine(ctx, cx, cy, hx, hy, "#CCCCDD");

    const mx = Math.round(cx + Math.cos(minuteAngle) * 4);
    const my = Math.round(cy + Math.sin(minuteAngle) * 4);
    this.drawPixelLine(ctx, cx, cy, mx, my, "#AAAACC");
  }

  private drawPixelLine(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
  ): void {
    ctx.fillStyle = color;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let px = x0;
    let py = y0;

    for (let steps = 0; steps < 20; steps++) {
      ctx.fillRect(px, py, 1, 1);
      if (px === x1 && py === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        px += sx;
      }
      if (e2 < dx) {
        err += dx;
        py += sy;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Sprite Drawing
  // -----------------------------------------------------------------------

  private drawSprite(
    ctx: CanvasRenderingContext2D,
    sprite: SpriteData,
    x: number,
    y: number,
    alpha?: number,
  ): void {
    const prevAlpha = ctx.globalAlpha;
    if (alpha !== undefined) {
      ctx.globalAlpha = alpha;
    }
    for (let row = 0; row < sprite.length; row++) {
      for (let col = 0; col < sprite[row].length; col++) {
        const color = sprite[row][col];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x + col, y + row, 1, 1);
        }
      }
    }
    ctx.globalAlpha = prevAlpha;
  }

  // -----------------------------------------------------------------------
  // Character Drawing
  // -----------------------------------------------------------------------

  private drawCharacter(
    ctx: CanvasRenderingContext2D,
    char: Character,
    frame: number,
  ): void {
    const alpha = char.isSubagent ? 0.7 : 1;
    const x = Math.round(char.x);
    const y = Math.round(char.y);

    let sprite: SpriteData;

    switch (char.state) {
      case "type":
        sprite = char.sprites.type[char.animFrame];
        break;
      case "sleep":
        sprite = char.sprites.sleep;
        break;
      case "walk":
      case "coffee":
        sprite = this.getWalkSprite(char);
        break;
      case "idle":
      default:
        sprite = char.sprites.front;
        break;
    }

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(x + 3, y + 14, 10, 2);

    this.drawSprite(ctx, sprite, x, y, alpha);

    // Coffee cup in hand during coffee state
    if (char.state === "coffee") {
      ctx.fillStyle = "#8B4513";
      const cupX = char.direction === "left" ? x + 2 : x + 12;
      const cupY = y + 7;
      ctx.fillRect(cupX, cupY, 2, 3);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(cupX, cupY, 2, 1);
    }
  }

  private getWalkSprite(char: Character): SpriteData {
    const frame = char.animFrame;
    switch (char.direction) {
      case "down":
        return char.sprites.walkDown[frame];
      case "up":
        return char.sprites.walkUp[frame];
      case "left":
        return char.sprites.walkLeft[frame];
      case "right":
        return char.sprites.walkRight[frame];
    }
  }

  // -----------------------------------------------------------------------
  // Cat Drawing
  // -----------------------------------------------------------------------

  private drawCat(ctx: CanvasRenderingContext2D, cat: Cat, frame: number): void {
    const x = Math.round(cat.x);
    const y = Math.round(cat.y);

    let sprite: SpriteData;

    switch (cat.state) {
      case "sleep":
        // If still walking to couch, draw walking sprite
        if (cat.path.length > 0 && cat.pathIndex < cat.path.length) {
          sprite = this.getCatWalkSprite(cat);
        } else {
          sprite = CAT_SPRITES.sleep;
        }
        break;
      case "sit":
        sprite = CAT_SPRITES.sit;
        break;
      case "wander":
      case "follow":
        if (cat.path.length > 0 && cat.pathIndex < cat.path.length) {
          sprite = this.getCatWalkSprite(cat);
        } else {
          sprite = CAT_SPRITES.sit;
        }
        break;
    }

    // Tiny shadow
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(x + 1, y + 7, 6, 1);

    this.drawSprite(ctx, sprite, x, y);
  }

  private getCatWalkSprite(cat: Cat): SpriteData {
    const frame = cat.animFrame;
    if (cat.direction === "left") {
      return frame === 0 ? CAT_SPRITES.walkLeft1 : CAT_SPRITES.walkLeft2;
    }
    return frame === 0 ? CAT_SPRITES.walkRight1 : CAT_SPRITES.walkRight2;
  }

  // -----------------------------------------------------------------------
  // Monitor Screens
  // -----------------------------------------------------------------------

  private drawMonitorScreens(ctx: CanvasRenderingContext2D, state: OfficeState): void {
    // Monitors are placed via furniture, but the screen content is dynamic
    // Find monitor furniture items and draw screen content on top
    for (const mon of state.monitors) {
      const monitorFurniture = state.furniture.find(
        (f, idx) => {
          // Match monitors by desk index order
          let monCount = 0;
          for (let fi = 0; fi <= idx; fi++) {
            if (state.furniture[fi].type === "monitor") monCount++;
          }
          return f.type === "monitor" && monCount - 1 === mon.deskIndex;
        },
      );
      if (!monitorFurniture) continue;

      const screenX = monitorFurniture.col * TILE_SIZE + 2;
      const screenY = monitorFurniture.row * TILE_SIZE + 1;
      const screenW = 12;
      const screenH = 8;

      switch (mon.activity) {
        case "typing": {
          // Green matrix-style text
          ctx.fillStyle = "#0A2A0A";
          ctx.fillRect(screenX, screenY, screenW, screenH);
          ctx.fillStyle = "#44FF66";
          for (let line = 0; line < 3; line++) {
            const offset = Math.floor(mon.scrollOffset + line * 3) % 10;
            const lineW = 4 + (offset % 6);
            ctx.fillRect(screenX + 1, screenY + 1 + line * 3, lineW, 1);
          }
          // Blinking cursor
          if (state.frame % 20 < 10) {
            ctx.fillStyle = "#88FFAA";
            ctx.fillRect(screenX + 8, screenY + 7, 1, 1);
          }
          break;
        }
        case "idle": {
          // Blue screensaver dot
          ctx.fillStyle = "#0A0A2A";
          ctx.fillRect(screenX, screenY, screenW, screenH);
          ctx.fillStyle = "#4488CC";
          const bx = screenX + 1 + Math.floor(mon.bounceX);
          const by = screenY + 1 + Math.floor(mon.bounceY);
          ctx.fillRect(bx, by, 2, 2);
          break;
        }
        case "sleeping":
        case "off": {
          ctx.fillStyle = "#0A0A12";
          ctx.fillRect(screenX, screenY, screenW, screenH);
          break;
        }
      }

      // Screen glow
      if (mon.activity === "typing") {
        ctx.fillStyle = "rgba(40,255,80,0.04)";
        ctx.fillRect(screenX - 2, screenY - 2, screenW + 4, screenH + 4);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Server LEDs
  // -----------------------------------------------------------------------

  private drawServerLeds(ctx: CanvasRenderingContext2D, leds: ServerLed[]): void {
    for (const led of leds) {
      ctx.fillStyle = led.on ? led.color : "#222222";
      ctx.fillRect(led.x, led.y, 2, 2);
      // Glow effect
      if (led.on) {
        ctx.fillStyle = led.color.replace(")", ",0.15)").replace("rgb(", "rgba(");
        // Simple hex-to-rgba for glow
        const hex = led.color;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
        ctx.fillRect(led.x - 1, led.y - 1, 4, 4);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Particles
  // -----------------------------------------------------------------------

  private drawParticles(
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    frame: number,
  ): void {
    for (const p of particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      const x = Math.round(p.x);
      const y = Math.round(p.y);

      if (p.char === "Z") {
        // Draw pixel Z
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        const size = Math.max(1, Math.ceil(p.size));
        ctx.fillRect(x, y, size * 3, 1);
        ctx.fillRect(x + size * 2, y + 1, size, 1);
        ctx.fillRect(x + size, y + 2, size, 1);
        ctx.fillRect(x, y + 3, size * 3, 1);
        ctx.globalAlpha = prevAlpha;
      } else if (p.char) {
        // Music note or other text
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        // Simple music note as pixels
        ctx.fillRect(x, y, 1, 3);
        ctx.fillRect(x + 1, y, 2, 1);
        ctx.fillRect(x + 2, y + 1, 1, 1);
        ctx.globalAlpha = prevAlpha;
      } else {
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(x, y, p.size, p.size);
        ctx.globalAlpha = prevAlpha;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Character Overlays (speech bubbles, thought bubbles)
  // -----------------------------------------------------------------------

  private drawCharacterOverlay(
    ctx: CanvasRenderingContext2D,
    char: Character,
    frame: number,
  ): void {
    const x = Math.round(char.x);
    const y = Math.round(char.y);

    // Thought bubble for thinking state
    if (char.targetActivity === "thinking") {
      const dotCount = (Math.floor(frame / 10) % 3) + 1;
      const bubbleX = x + 14;
      const bubbleY = y - 6;

      // Leading dots
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(bubbleX - 2, bubbleY + 4, 1, 1);
      ctx.fillRect(bubbleX, bubbleY + 2, 2, 2);

      // Bubble background
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(bubbleX + 1, bubbleY - 3, 12, 5);

      // Dots
      ctx.fillStyle = "#CCCCEE";
      for (let d = 0; d < dotCount; d++) {
        ctx.fillRect(bubbleX + 3 + d * 3, bubbleY - 1, 2, 2);
      }
    }

    // Speech bubble for current task
    if (char.currentTask && char.targetActivity !== "thinking") {
      this.drawSpeechBubble(ctx, x + 8, y - 6, char.currentTask);
    }
  }

  private drawSpeechBubble(
    ctx: CanvasRenderingContext2D,
    cx: number,
    bottomY: number,
    text: string,
  ): void {
    const maxLen = 18;
    const display = text.length > maxLen ? text.slice(0, maxLen - 1) + "~" : text;
    const charW = 4;
    const textW = display.length * charW;
    const padX = 3;
    const padY = 2;
    const bubbleW = textW + padX * 2;
    const bubbleH = 7 + padY * 2;
    const bx = cx - Math.floor(bubbleW / 2);
    const by = bottomY - bubbleH - 3;

    // Background
    ctx.fillStyle = "#F0F0F0";
    ctx.fillRect(bx, by, bubbleW, bubbleH);

    // Border
    ctx.fillStyle = "#333344";
    ctx.fillRect(bx, by, bubbleW, 1);
    ctx.fillRect(bx, by + bubbleH - 1, bubbleW, 1);
    ctx.fillRect(bx, by, 1, bubbleH);
    ctx.fillRect(bx + bubbleW - 1, by, 1, bubbleH);

    // Pointer triangle
    ctx.fillStyle = "#F0F0F0";
    ctx.fillRect(cx - 1, by + bubbleH, 3, 1);
    ctx.fillRect(cx, by + bubbleH + 1, 1, 1);
    ctx.fillStyle = "#333344";
    ctx.fillRect(cx - 2, by + bubbleH, 1, 1);
    ctx.fillRect(cx + 2, by + bubbleH, 1, 1);
    ctx.fillRect(cx - 1, by + bubbleH + 1, 1, 1);
    ctx.fillRect(cx + 1, by + bubbleH + 1, 1, 1);

    // Text
    ctx.fillStyle = "#222233";
    ctx.font = "5px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(display, cx, by + Math.floor(bubbleH / 2));
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  // -----------------------------------------------------------------------
  // Name Labels
  // -----------------------------------------------------------------------

  private drawNameLabel(ctx: CanvasRenderingContext2D, char: Character): void {
    const x = Math.round(char.x) + 8;
    const y = Math.round(char.y) + 18;

    ctx.fillStyle = "#AAAACC";
    ctx.font = "5px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(char.name, x, y);

    // Status dot
    const textHalfW = Math.ceil(char.name.length * 1.5);
    const dotX = x + textHalfW + 3;
    const dotY = y + 2;

    switch (char.status) {
      case "active":
        ctx.fillStyle = "#44CC44";
        break;
      case "idle":
        ctx.fillStyle = "#CCCC44";
        break;
      case "unknown":
        ctx.fillStyle = "#666666";
        break;
    }
    ctx.fillRect(dotX, dotY, 2, 2);

    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  // -----------------------------------------------------------------------
  // Time Overlay (rendered in screen space, not pixel art space)
  // -----------------------------------------------------------------------

  private drawTimeOverlay(
    ctx: CanvasRenderingContext2D,
    state: OfficeState,
    offsetX: number,
    scaledW: number,
  ): void {
    const timeStr = formatClockTime(state.environment.hour, state.environment.minute);
    const label = `Athens ${timeStr}`;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    const tx = offsetX + scaledW - 100;
    const ty = 10;
    ctx.fillRect(tx - 4, ty - 2, 96, 18);

    ctx.fillStyle = "#AAAACC";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(label, offsetX + scaledW - 12, ty);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
}
