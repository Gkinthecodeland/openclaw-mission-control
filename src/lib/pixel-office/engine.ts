import type { OfficeAgent } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIXEL_SCALE = 3;
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

// Tile size in logical pixels
const TILE = 16;

// Colors
const COLOR_BG = "#1a1a2e";
const COLOR_WALL = "#252542";
const COLOR_WALL_ACCENT = "#2d2d4a";
const COLOR_FLOOR_A = "#1e1e32";
const COLOR_FLOOR_B = "#222240";
const COLOR_DESK = "#3d3528";
const COLOR_DESK_EDGE = "#4a4030";
const COLOR_MONITOR_FRAME = "#333333";
const COLOR_MONITOR_IDLE = "#1a3a5a";
const COLOR_MONITOR_ACTIVE = "#2a5a3a";
const COLOR_MONITOR_SLEEPING = "#111122";
const COLOR_WHITEBOARD = "#c8c8d4";
const COLOR_PLANT_POT = "#6b4226";
const COLOR_PLANT_GREEN = "#2e7d32";
const COLOR_PLANT_LIGHT = "#4caf50";
const COLOR_COFFEE_BODY = "#2a2a2a";
const COLOR_COFFEE_RED = "#cc3333";

// Named agent palettes
const NAMED_PALETTES: Record<string, { primary: string; secondary: string; skin: string }> = {
  donna: { primary: "#e07050", secondary: "#c05030", skin: "#f0c0a0" },
  jarvis: { primary: "#4090d0", secondary: "#2070b0", skin: "#e0c8a0" },
};

// Fallback palette cycle for unnamed agents
const PALETTE_CYCLE: ReadonlyArray<{ primary: string; secondary: string; skin: string }> = [
  { primary: "#9060c0", secondary: "#7040a0", skin: "#e8c8a8" }, // purple
  { primary: "#40a060", secondary: "#208040", skin: "#e0c0a0" }, // green
  { primary: "#40a0a0", secondary: "#208080", skin: "#e8d0b0" }, // teal
  { primary: "#c0a040", secondary: "#a08020", skin: "#f0d0a0" }, // gold
  { primary: "#c060a0", secondary: "#a04080", skin: "#e8c8b0" }, // magenta
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  const n = parseInt(cleaned, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function darkenHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Resolve colors for an agent, using named palette or cycling fallback. */
function resolveColor(
  agent: OfficeAgent,
  index: number,
): { primary: string; secondary: string; skin: string } {
  // If the agent already has valid non-empty colors, use them
  if (agent.color.primary && agent.color.secondary && agent.color.skin) {
    return agent.color;
  }
  const named = NAMED_PALETTES[agent.name.toLowerCase()];
  if (named) return named;
  return PALETTE_CYCLE[index % PALETTE_CYCLE.length];
}

// ---------------------------------------------------------------------------
// Desk layout (logical pixels relative to office origin)
// ---------------------------------------------------------------------------

type DeskPos = { x: number; y: number };

function computeDeskPositions(officeW: number, officeH: number): DeskPos[] {
  // 2x2 grid centered in the office
  const gridCols = 2;
  const gridRows = 2;
  const deskW = 48;
  const deskH = 32;
  const gapX = 40;
  const gapY = 36;

  const totalW = gridCols * deskW + (gridCols - 1) * gapX;
  const totalH = gridRows * deskH + (gridRows - 1) * gapY;
  const startX = Math.floor((officeW - totalW) / 2);
  const startY = Math.floor((officeH - totalH) / 2) + 8;

  const positions: DeskPos[] = [];
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      positions.push({
        x: startX + col * (deskW + gapX),
        y: startY + row * (deskH + gapY),
      });
    }
  }
  return positions;
}

// ---------------------------------------------------------------------------
// PixelOfficeEngine
// ---------------------------------------------------------------------------

export class PixelOfficeEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bgCanvas: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;

  private agents: OfficeAgent[] = [];
  private frame = 0;
  private lastFrameTime = 0;
  private rafId: number | null = null;
  private running = false;

  // Logical (unscaled) office dimensions
  private logicalW = 0;
  private logicalH = 0;
  private deskPositions: DeskPos[] = [];

  // Cached background dirty flag
  private bgDirty = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2d context from canvas");
    this.ctx = ctx;

    // Create offscreen buffer for static background
    this.bgCanvas = document.createElement("canvas");
    const bgCtx = this.bgCanvas.getContext("2d");
    if (!bgCtx) throw new Error("Failed to get offscreen 2d context");
    this.bgCtx = bgCtx;

    this.resize();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  updateAgents(agents: OfficeAgent[]): void {
    this.agents = agents;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
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

    // Logical pixel dimensions (what we draw in before PIXEL_SCALE)
    this.logicalW = Math.floor(w / PIXEL_SCALE);
    this.logicalH = Math.floor(h / PIXEL_SCALE);

    // Resize offscreen background canvas
    this.bgCanvas.width = this.logicalW;
    this.bgCanvas.height = this.logicalH;
    const freshBgCtx = this.bgCanvas.getContext("2d");
    if (freshBgCtx) {
      this.bgCtx = freshBgCtx;
      this.bgCtx.imageSmoothingEnabled = false;
    }

    this.deskPositions = computeDeskPositions(this.logicalW, this.logicalH);
    this.bgDirty = true;
  }

  getAgentAt(clientX: number, clientY: number): OfficeAgent | null {
    // Convert client (viewport) coordinates to logical pixel coordinates
    const rect = this.canvas.getBoundingClientRect();
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    const lx = Math.floor(cssX / PIXEL_SCALE);
    const ly = Math.floor(cssY / PIXEL_SCALE);

    for (const agent of this.agents) {
      if (this.deskPositions.length === 0) continue;
      const desk = this.deskPositions[agent.deskIndex % this.deskPositions.length];
      // Character is drawn above the desk, centered
      const charX = desk.x + 16;
      const charY = desk.y - 20;
      if (lx >= charX && lx <= charX + 16 && ly >= charY && ly <= charY + 24) {
        return agent;
      }
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Game loop
  // -----------------------------------------------------------------------

  private loop = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const delta = now - this.lastFrameTime;
    if (delta < FRAME_INTERVAL) return;
    this.lastFrameTime = now - (delta % FRAME_INTERVAL);

    this.frame++;
    this.render();
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  private render(): void {
    const ctx = this.ctx;
    const w = this.logicalW;
    const h = this.logicalH;

    // Draw static background to offscreen canvas if dirty
    if (this.bgDirty) {
      this.drawBackground(this.bgCtx, w, h);
      this.bgDirty = false;
    }

    // Clear main canvas
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, w * PIXEL_SCALE, h * PIXEL_SCALE);

    // Scale up and draw cached background
    ctx.save();
    ctx.scale(PIXEL_SCALE, PIXEL_SCALE);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.bgCanvas, 0, 0);

    // Draw per-frame ambient animations
    this.drawAmbientAnimations(ctx, w);

    // Draw agents at their desks
    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      if (this.deskPositions.length === 0) continue;
      const deskIdx = agent.deskIndex % this.deskPositions.length;
      const desk = this.deskPositions[deskIdx];
      this.drawAgentAtDesk(ctx, agent, desk, i);
    }

    // Empty state
    if (this.agents.length === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.font = "6px monospace";
      ctx.textAlign = "center";
      ctx.fillText("No agents online", w / 2, h / 2);
      ctx.textAlign = "start";
    }

    ctx.restore();
  }

  // -----------------------------------------------------------------------
  // Static background (offscreen, drawn once)
  // -----------------------------------------------------------------------

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.imageSmoothingEnabled = false;

    // Fill
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, w, h);

    // Floor tiles
    const tilesX = Math.ceil(w / TILE);
    const tilesY = Math.ceil(h / TILE);
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        ctx.fillStyle = (tx + ty) % 2 === 0 ? COLOR_FLOOR_A : COLOR_FLOOR_B;
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }

    // Top wall
    ctx.fillStyle = COLOR_WALL;
    ctx.fillRect(0, 0, w, TILE);
    ctx.fillStyle = COLOR_WALL_ACCENT;
    ctx.fillRect(0, TILE - 2, w, 2);

    // Left wall
    ctx.fillStyle = COLOR_WALL;
    ctx.fillRect(0, 0, TILE, h);
    ctx.fillStyle = COLOR_WALL_ACCENT;
    ctx.fillRect(TILE - 2, 0, 2, h);

    // Whiteboard on top wall
    const wbW = 40;
    const wbH = 10;
    const wbX = Math.floor(w / 2) - Math.floor(wbW / 2);
    const wbY = 2;
    ctx.fillStyle = COLOR_WHITEBOARD;
    ctx.fillRect(wbX, wbY, wbW, wbH);
    ctx.fillStyle = darkenHex(COLOR_WHITEBOARD, 0.15);
    ctx.fillRect(wbX, wbY, wbW, 1);
    ctx.fillRect(wbX, wbY + wbH - 1, wbW, 1);
    ctx.fillRect(wbX, wbY, 1, wbH);
    ctx.fillRect(wbX + wbW - 1, wbY, 1, wbH);
    // Whiteboard text lines
    ctx.fillStyle = hexWithAlpha("#8888aa", 0.4);
    for (let li = 0; li < 3; li++) {
      ctx.fillRect(wbX + 3, wbY + 3 + li * 3, wbW - 6, 1);
    }

    // Potted plant (top-left corner)
    this.drawPlant(ctx, TILE + 4, TILE + 4);

    // Coffee machine (right wall)
    this.drawCoffeeMachine(ctx, w - TILE - 12, TILE + 6);

    // Desks
    for (const desk of this.deskPositions) {
      this.drawDesk(ctx, desk);
    }
  }

  private drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Pot
    ctx.fillStyle = COLOR_PLANT_POT;
    ctx.fillRect(x + 2, y + 8, 8, 6);
    ctx.fillRect(x + 1, y + 8, 10, 2);
    // Soil
    ctx.fillStyle = "#3e2415";
    ctx.fillRect(x + 3, y + 8, 6, 1);
    // Leaves
    ctx.fillStyle = COLOR_PLANT_GREEN;
    ctx.fillRect(x + 4, y + 2, 4, 6);
    ctx.fillRect(x + 2, y + 4, 2, 3);
    ctx.fillRect(x + 8, y + 3, 2, 4);
    // Highlights
    ctx.fillStyle = COLOR_PLANT_LIGHT;
    ctx.fillRect(x + 5, y + 3, 2, 2);
    ctx.fillRect(x + 3, y + 5, 1, 1);
  }

  private drawCoffeeMachine(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = COLOR_COFFEE_BODY;
    ctx.fillRect(x, y, 10, 14);
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(x, y, 10, 3);
    ctx.fillStyle = "#555555";
    ctx.fillRect(x + 4, y + 6, 2, 3);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x + 2, y + 10, 6, 3);
    ctx.fillStyle = COLOR_COFFEE_RED;
    ctx.fillRect(x + 8, y + 1, 1, 1);
  }

  private drawDesk(ctx: CanvasRenderingContext2D, desk: DeskPos): void {
    const { x, y } = desk;
    const dw = 48;
    const dh = 32;

    // Desk surface
    ctx.fillStyle = COLOR_DESK;
    ctx.fillRect(x, y, dw, dh);
    // Edge highlight
    ctx.fillStyle = COLOR_DESK_EDGE;
    ctx.fillRect(x, y, dw, 2);
    ctx.fillRect(x, y, 2, dh);
    // Shadow edge
    ctx.fillStyle = darkenHex(COLOR_DESK, 0.3);
    ctx.fillRect(x, y + dh - 2, dw, 2);
    ctx.fillRect(x + dw - 2, y, 2, dh);

    // Legs
    ctx.fillStyle = darkenHex(COLOR_DESK, 0.4);
    ctx.fillRect(x + 2, y + dh, 2, 4);
    ctx.fillRect(x + dw - 4, y + dh, 2, 4);

    // Monitor stand and base
    ctx.fillStyle = COLOR_MONITOR_FRAME;
    ctx.fillRect(x + 18, y + 10, 12, 2);
    ctx.fillRect(x + 22, y + 4, 4, 6);

    // Monitor frame
    ctx.fillRect(x + 14, y - 8, 20, 14);

    // Keyboard
    ctx.fillStyle = "#444444";
    ctx.fillRect(x + 14, y + 14, 16, 4);
    ctx.fillStyle = "#555555";
    for (let kx = 0; kx < 6; kx++) {
      for (let ky = 0; ky < 2; ky++) {
        ctx.fillRect(x + 15 + kx * 2 + (kx >= 3 ? 1 : 0), y + 15 + ky * 2, 1, 1);
      }
    }

    // Mouse
    ctx.fillStyle = "#444444";
    ctx.fillRect(x + 34, y + 16, 4, 3);
    ctx.fillStyle = "#555555";
    ctx.fillRect(x + 35, y + 16, 1, 1);
  }

  // -----------------------------------------------------------------------
  // Ambient animations (per-frame, drawn on top of cached background)
  // -----------------------------------------------------------------------

  private drawAmbientAnimations(ctx: CanvasRenderingContext2D, w: number): void {
    // Wall clock with real time
    this.drawClock(ctx, w - 30, 6);

    // Plant sway
    const plantX = TILE + 4;
    const plantY = TILE + 4;
    const sway = Math.sin(this.frame * 0.05) > 0.3 ? 1 : 0;
    ctx.fillStyle = COLOR_PLANT_LIGHT;
    ctx.fillRect(plantX + 5 + sway, plantY + 1, 2, 2);
    ctx.fillStyle = COLOR_PLANT_GREEN;
    ctx.fillRect(plantX + 9 + sway, plantY + 2, 1, 2);

    // Coffee machine blinking light
    const coffeeX = w - TILE - 12;
    const coffeeY = TILE + 6;
    const blinkOn = Math.sin(this.frame * 0.08) > 0;
    ctx.fillStyle = blinkOn ? COLOR_COFFEE_RED : "#661111";
    ctx.fillRect(coffeeX + 8, coffeeY + 1, 1, 1);

    // Monitor screens per desk
    for (let di = 0; di < this.deskPositions.length; di++) {
      const desk = this.deskPositions[di];
      const agent = this.agents.find(
        (a) => this.deskPositions.length > 0 && a.deskIndex % this.deskPositions.length === di,
      );
      this.drawMonitorScreen(ctx, desk, agent ?? null);
    }
  }

  private drawClock(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const radius = 5;

    // Clock face (pixel circle)
    ctx.fillStyle = "#3a3a5a";
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          ctx.fillRect(cx + dx, cy + dy, 1, 1);
        }
      }
    }

    // Border ring
    ctx.fillStyle = "#5a5a7a";
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = dx * dx + dy * dy;
        if (dist <= radius * radius && dist >= (radius - 1) * (radius - 1)) {
          ctx.fillRect(cx + dx, cy + dy, 1, 1);
        }
      }
    }

    // Center dot
    ctx.fillStyle = "#ccccdd";
    ctx.fillRect(cx, cy, 1, 1);

    // Real-time hands
    const now = new Date();
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();

    // Hour hand (short)
    const hAngle = ((hours + minutes / 60) / 12) * Math.PI * 2 - Math.PI / 2;
    const hx = Math.round(cx + Math.cos(hAngle) * 3);
    const hy = Math.round(cy + Math.sin(hAngle) * 3);
    this.drawPixelLine(ctx, cx, cy, hx, hy, "#ccccdd");

    // Minute hand (long)
    const mAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
    const mx = Math.round(cx + Math.cos(mAngle) * 4);
    const my = Math.round(cy + Math.sin(mAngle) * 4);
    this.drawPixelLine(ctx, cx, cy, mx, my, "#aaaacc");
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

  private drawMonitorScreen(
    ctx: CanvasRenderingContext2D,
    desk: DeskPos,
    agent: OfficeAgent | null,
  ): void {
    const screenX = desk.x + 16;
    const screenY = desk.y - 6;
    const screenW = 16;
    const screenH = 10;

    let baseColor: string;
    if (!agent) {
      baseColor = COLOR_MONITOR_IDLE;
    } else {
      switch (agent.activity) {
        case "typing":
          baseColor = COLOR_MONITOR_ACTIVE;
          break;
        case "sleeping":
          baseColor = COLOR_MONITOR_SLEEPING;
          break;
        default:
          baseColor = COLOR_MONITOR_IDLE;
      }
    }

    // Subtle flicker
    const flicker = Math.sin(this.frame * 0.15 + desk.x) * 0.05;
    const { r, g, b } = hexToRgb(baseColor);
    const fr = Math.max(0, Math.min(255, r + Math.round(flicker * 50)));
    const fg = Math.max(0, Math.min(255, g + Math.round(flicker * 50)));
    const fb = Math.max(0, Math.min(255, b + Math.round(flicker * 50)));
    ctx.fillStyle = `rgb(${fr},${fg},${fb})`;
    ctx.fillRect(screenX, screenY, screenW, screenH);

    // Typing: text lines and cursor on screen
    if (agent?.activity === "typing") {
      ctx.fillStyle = hexWithAlpha("#88ffaa", 0.7);
      for (let li = 0; li < 3; li++) {
        const lineW = 6 + ((this.frame + li * 7) % 8);
        ctx.fillRect(screenX + 2, screenY + 2 + li * 3, lineW, 1);
      }
      if (this.frame % 20 < 10) {
        const cursorLine = this.frame % 3;
        const cursorXOff = 6 + ((this.frame + cursorLine * 7) % 8);
        ctx.fillStyle = "#aaffcc";
        ctx.fillRect(screenX + 2 + cursorXOff, screenY + 2 + cursorLine * 3, 1, 1);
      }
    }

    // Idle: screensaver dot
    if (agent?.activity === "idle") {
      const svX = screenX + 2 + Math.floor((Math.sin(this.frame * 0.04) + 1) * 6);
      const svY = screenY + 2 + Math.floor((Math.cos(this.frame * 0.03) + 1) * 3);
      ctx.fillStyle = "#6688aa";
      ctx.fillRect(svX, svY, 2, 2);
    }

    // Subtle screen glow
    if (agent?.activity !== "sleeping") {
      ctx.fillStyle = hexWithAlpha(baseColor, 0.08);
      ctx.fillRect(screenX - 1, screenY - 1, screenW + 2, screenH + 2);
    }
  }

  // -----------------------------------------------------------------------
  // Character drawing
  // -----------------------------------------------------------------------

  private drawAgentAtDesk(
    ctx: CanvasRenderingContext2D,
    agent: OfficeAgent,
    desk: DeskPos,
    index: number,
  ): void {
    const colors = resolveColor(agent, index);
    const charX = desk.x + 16;
    const charY = desk.y - 20;

    switch (agent.activity) {
      case "typing":
        this.drawCharTyping(ctx, charX, charY, colors);
        break;
      case "thinking":
        this.drawCharThinking(ctx, charX, charY, colors);
        break;
      case "idle":
        this.drawCharIdle(ctx, charX, charY, colors);
        break;
      case "sleeping":
        this.drawCharSleeping(ctx, charX, charY, colors);
        break;
      case "walking":
        this.drawCharWalking(ctx, charX, charY, colors);
        break;
    }

    // Speech bubble with current task
    if (agent.currentTask) {
      this.drawSpeechBubble(ctx, charX + 8, charY - 6, agent.currentTask);
    }

    // Name label below desk
    this.drawNameLabel(ctx, charX + 8, desk.y + 38, agent);
  }

  private drawCharBase(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colors: { primary: string; secondary: string; skin: string },
    armOffsetL: number,
    armOffsetR: number,
    legFrame: number,
    bodyOffsetY: number,
  ): void {
    const bx = x;
    const by = y + bodyOffsetY;

    // Head (4x4)
    ctx.fillStyle = colors.skin;
    ctx.fillRect(bx + 6, by, 4, 4);

    // Eyes
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(bx + 7, by + 1, 1, 1);
    ctx.fillRect(bx + 9, by + 1, 1, 1);

    // Body (6x6)
    ctx.fillStyle = colors.primary;
    ctx.fillRect(bx + 5, by + 4, 6, 6);

    // Arms (2px wide each side)
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(bx + 3, by + 4 + armOffsetL, 2, 4);
    ctx.fillRect(bx + 11, by + 4 + armOffsetR, 2, 4);

    // Legs (2x3)
    ctx.fillStyle = darkenHex(colors.primary, 0.35);
    if (legFrame === 0) {
      ctx.fillRect(bx + 5, by + 10, 2, 3);
      ctx.fillRect(bx + 9, by + 10, 2, 3);
    } else {
      ctx.fillRect(bx + 6, by + 10, 2, 3);
      ctx.fillRect(bx + 8, by + 10, 2, 3);
    }
  }

  private drawCharTyping(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colors: { primary: string; secondary: string; skin: string },
  ): void {
    // Arms alternate on keyboard (~200ms per frame at 30fps)
    const armFrame = Math.floor(this.frame / 6) % 2;
    const armL = armFrame === 0 ? 2 : 3;
    const armR = armFrame === 0 ? 3 : 2;
    this.drawCharBase(ctx, x, y, colors, armL, armR, 0, 0);
  }

  private drawCharThinking(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colors: { primary: string; secondary: string; skin: string },
  ): void {
    // Slight head bob
    const bob = Math.sin(this.frame * 0.08) > 0.5 ? -1 : 0;
    this.drawCharBase(ctx, x, y, colors, 1, 1, 0, bob);

    // Thought bubble: cycling dots (. -> .. -> ...)
    const dotCount = (Math.floor(this.frame / 10) % 3) + 1;
    const bubbleX = x + 14;
    const bubbleY = y - 4;

    // Leading dots
    ctx.fillStyle = hexWithAlpha("#ffffff", 0.5);
    ctx.fillRect(bubbleX - 2, bubbleY + 4, 1, 1);
    ctx.fillRect(bubbleX, bubbleY + 2, 2, 2);

    // Bubble background
    ctx.fillStyle = hexWithAlpha("#ffffff", 0.15);
    ctx.fillRect(bubbleX + 1, bubbleY - 3, 12, 5);

    // Dots
    ctx.fillStyle = "#ccccee";
    for (let d = 0; d < dotCount; d++) {
      ctx.fillRect(bubbleX + 3 + d * 3, bubbleY - 1, 2, 2);
    }
  }

  private drawCharIdle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colors: { primary: string; secondary: string; skin: string },
  ): void {
    // Breathing: body shifts up 1px every ~2s
    const breathCycle = Math.sin(this.frame * 0.05);
    const breathOffset = breathCycle > 0.7 ? -1 : 0;
    this.drawCharBase(ctx, x, y, colors, 1, 1, 0, breathOffset);
  }

  private drawCharSleeping(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colors: { primary: string; secondary: string; skin: string },
  ): void {
    // Slumped on desk
    const bx = x;
    const by = y + 6;

    // Body
    ctx.fillStyle = colors.primary;
    ctx.fillRect(bx + 5, by + 4, 6, 5);

    // Arms on desk
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(bx + 2, by + 5, 3, 3);
    ctx.fillRect(bx + 11, by + 5, 3, 3);

    // Head on desk (tilted)
    ctx.fillStyle = colors.skin;
    ctx.fillRect(bx + 5, by + 1, 5, 4);

    // Closed eyes
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(bx + 6, by + 3, 2, 1);
    ctx.fillRect(bx + 9, by + 3, 1, 1);

    // Legs under desk
    ctx.fillStyle = darkenHex(colors.primary, 0.35);
    ctx.fillRect(bx + 5, by + 9, 2, 3);
    ctx.fillRect(bx + 9, by + 9, 2, 3);

    // Floating "Z z z"
    const zPhase = (this.frame * 0.04) % 3;
    for (let zi = 0; zi < 3; zi++) {
      const progress = (zPhase + zi) % 3;
      const zx = bx + 14 + zi * 3 + Math.round(Math.sin(this.frame * 0.06 + zi));
      const zy = by - 2 - Math.round(progress * 5);
      const alpha = 0.8 * (1 - progress / 3);
      if (alpha <= 0.05) continue;
      ctx.fillStyle = hexWithAlpha("#aaaaff", alpha);
      // "Z" as pixels (3x4)
      ctx.fillRect(zx, zy, 3, 1);
      ctx.fillRect(zx + 2, zy + 1, 1, 1);
      ctx.fillRect(zx + 1, zy + 2, 1, 1);
      ctx.fillRect(zx, zy + 3, 3, 1);
    }
  }

  private drawCharWalking(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colors: { primary: string; secondary: string; skin: string },
  ): void {
    const walkFrame = Math.floor(this.frame / 8) % 2;
    const armSwing = walkFrame === 0 ? 0 : 2;
    this.drawCharBase(ctx, x, y, colors, armSwing, 2 - armSwing, walkFrame, 0);
  }

  // -----------------------------------------------------------------------
  // Speech bubbles and labels
  // -----------------------------------------------------------------------

  private drawSpeechBubble(
    ctx: CanvasRenderingContext2D,
    cx: number,
    bottomY: number,
    text: string,
  ): void {
    const maxLen = 20;
    const display = text.length > maxLen ? text.slice(0, maxLen - 1) + "~" : text;

    const charW = 4;
    const textW = display.length * charW;
    const padX = 4;
    const padY = 3;
    const bubbleW = textW + padX * 2;
    const bubbleH = 8 + padY * 2;

    const bx = cx - Math.floor(bubbleW / 2);
    const by = bottomY - bubbleH - 4;

    // Background
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(bx, by, bubbleW, bubbleH);

    // Border
    ctx.fillStyle = "#333344";
    ctx.fillRect(bx, by, bubbleW, 1);
    ctx.fillRect(bx, by + bubbleH - 1, bubbleW, 1);
    ctx.fillRect(bx, by, 1, bubbleH);
    ctx.fillRect(bx + bubbleW - 1, by, 1, bubbleH);

    // Triangle pointer
    const triX = cx - 2;
    const triY = by + bubbleH;
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(triX, triY, 4, 1);
    ctx.fillRect(triX + 1, triY + 1, 2, 1);
    ctx.fillStyle = "#333344";
    ctx.fillRect(triX - 1, triY, 1, 1);
    ctx.fillRect(triX + 4, triY, 1, 1);
    ctx.fillRect(triX, triY + 1, 1, 1);
    ctx.fillRect(triX + 3, triY + 1, 1, 1);
    ctx.fillRect(triX + 1, triY + 2, 1, 1);
    ctx.fillRect(triX + 2, triY + 2, 1, 1);

    // Text
    ctx.fillStyle = "#222233";
    ctx.font = "5px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(display, cx, by + Math.floor(bubbleH / 2));
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  private drawNameLabel(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    agent: OfficeAgent,
  ): void {
    ctx.fillStyle = "#aaaacc";
    ctx.font = "5px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(agent.name, cx, y);

    // Status dot (green=active, yellow=idle, gray=unknown)
    const textHalfW = Math.ceil(agent.name.length * 1.5);
    const dotX = cx + textHalfW + 3;
    const dotY = y + 2;

    let dotColor: string;
    switch (agent.status) {
      case "active":
        dotColor = "#44cc44";
        break;
      case "idle":
        dotColor = "#cccc44";
        break;
      case "unknown":
        dotColor = "#666666";
        break;
    }
    ctx.fillStyle = dotColor;
    ctx.fillRect(dotX, dotY, 2, 2);

    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
}
