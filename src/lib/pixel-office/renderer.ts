// ---------------------------------------------------------------------------
// Pixel Office V3 — Pokemon Red Edition — Canvas Renderer
// ---------------------------------------------------------------------------
// The main rendering engine. Draws the entire game world to a <canvas> each
// frame. Handles camera, tile rendering, z-sorted entities, effects overlays,
// speech bubbles, and screen transitions.
// ---------------------------------------------------------------------------

import type {
  GameState,
  FloorData,
  Character,
  Cat,
  FurnitureInstance,
  SpriteData,
  EnvironmentState,
  RenderEntity,
} from "./types";

import {
  TileType,
  FloorId,
  Direction,
  TILE_SIZE,
  ZOOM,
  FLOOR_COLS,
  FLOOR_ROWS,
  FLOOR_WIDTH,
  FLOOR_HEIGHT,
  CAMERA_LERP,
  GBC,
} from "./types";

import {
  renderNightOverlay,
  renderParticle,
  renderServerLed,
  renderMonitorScreen,
  renderTransition,
  getSkyColor,
  getWindowColor,
} from "./effects";

import { renderDialog } from "./dialog";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How far beyond the visible area to render tiles (in tiles) */
const CULL_PAD = 2;

/** Skyline building definitions for rooftop view */
const SKYLINE_BUILDINGS: Array<{
  x: number;
  w: number;
  h: number;
  shade: string;
}> = [
  { x: 20, w: 30, h: 60, shade: GBC.skylineD },
  { x: 60, w: 20, h: 45, shade: GBC.skylineM },
  { x: 90, w: 40, h: 80, shade: GBC.skylineD },
  { x: 140, w: 25, h: 50, shade: GBC.skylineL },
  { x: 175, w: 35, h: 70, shade: GBC.skylineD },
  { x: 220, w: 20, h: 40, shade: GBC.skylineM },
  { x: 250, w: 45, h: 90, shade: GBC.skylineD },
  { x: 305, w: 30, h: 55, shade: GBC.skylineL },
  { x: 345, w: 25, h: 65, shade: GBC.skylineM },
  { x: 380, w: 40, h: 75, shade: GBC.skylineD },
  { x: 430, w: 20, h: 35, shade: GBC.skylineL },
];

/** Character sprite size in game pixels */
const CHAR_SIZE = 16;

/** Cat sprite size in game pixels */
const CAT_SIZE = 8;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function directionKey(d: Direction): "down" | "up" | "left" | "right" {
  switch (d) {
    case Direction.DOWN:
      return "down";
    case Direction.UP:
      return "up";
    case Direction.LEFT:
      return "left";
    case Direction.RIGHT:
      return "right";
  }
}

/** Clamp a value between min and max */
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------------------------------------------------------------------------
// Renderer Class
// ---------------------------------------------------------------------------

export class PixelOfficeRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("PixelOfficeRenderer: failed to get 2d context");
    }
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  // -----------------------------------------------------------------------
  // Resize
  // -----------------------------------------------------------------------

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;

    this.width = width;
    this.height = height;
  }

  // -----------------------------------------------------------------------
  // Main Render
  // -----------------------------------------------------------------------

  render(
    state: GameState,
    floors: Map<FloorId, FloorData>,
    dt: number,
  ): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const zoom = ZOOM;

    const floor = floors.get(state.currentFloor);
    if (!floor) return;

    // --- Update camera ---
    this.updateCamera(state, zoom);

    const camX = state.camera.x;
    const camY = state.camera.y;

    // --- 1. Clear canvas ---
    ctx.fillStyle = GBC.black;
    ctx.fillRect(0, 0, w, h);

    // --- Floor-specific background ---
    if (state.currentFloor === FloorId.ROOFTOP) {
      this.renderRooftopBackground(state.environment, camX, camY);
    }

    // --- Store environment for window rendering ---
    this.windowEnv = state.environment;

    // --- 2. Render floor tiles ---
    this.renderFloorTiles(floor, camX, camY);

    // --- 3. Render wall base layer ---
    this.renderWalls(floor, camX, camY);

    // --- 4. Collect all renderables for z-sorting ---
    const entities: RenderEntity[] = [];

    // Furniture
    for (const f of floor.furniture) {
      const fRef = f;
      entities.push({
        kind: "furniture",
        zSortY: f.zSortY,
        id: `f_${f.kind}_${f.col}_${f.row}`,
        draw: (c, cx, cy) => this.renderFurniture(fRef, cx, cy),
      });
    }

    // Characters on current floor
    for (const char of state.characters) {
      if (char.floor !== state.currentFloor) continue;
      const charRef = char;
      entities.push({
        kind: "character",
        zSortY: char.y + CHAR_SIZE,
        id: char.id,
        draw: (c, cx, cy) => this.renderCharacter(charRef, cx, cy),
      });
    }

    // Cat (if on current floor)
    if (state.cat.floor === state.currentFloor) {
      entities.push({
        kind: "cat",
        zSortY: state.cat.y + CAT_SIZE,
        id: "cat",
        draw: (c, cx, cy) => this.renderCat(state.cat, cx, cy),
      });
    }

    // --- 5. Z-sort: lower y drawn first (further from viewer) ---
    entities.sort((a, b) => a.zSortY - b.zSortY);

    // --- 6. Render each entity ---
    for (const entity of entities) {
      entity.draw(ctx, camX, camY);
    }

    // --- 7. Render wall top overhang layer ---
    this.renderWallTops(floor, camX, camY);

    // --- 8. Render monitor screens ---
    this.renderMonitorScreens(state, floor, camX, camY);

    // --- 9. Render server LEDs (basement) ---
    if (state.currentFloor === FloorId.BASEMENT) {
      for (const led of state.serverLeds) {
        renderServerLed(ctx, led, camX, camY, zoom);
      }
    }

    // --- 10. Render particles ---
    for (const p of state.particles) {
      if (p.floor === state.currentFloor) {
        renderParticle(ctx, p, camX, camY, zoom);
      }
    }

    // --- 11. Speech bubbles + name labels ---
    for (const char of state.characters) {
      if (char.floor !== state.currentFloor) continue;

      // Activity indicator bubble
      const bubbleText = this.getActivityBubbleText(char, state.frame);
      if (bubbleText) {
        this.renderSpeechBubble(
          char.x + CHAR_SIZE / 2,
          char.y,
          bubbleText,
          camX,
          camY,
        );
      }

      // Name label
      this.renderNameLabel(
        char.name,
        char.emoji,
        char.x,
        char.y,
        camX,
        camY,
      );
    }

    // Cat speech bubble
    if (
      state.cat.floor === state.currentFloor &&
      state.cat.speechTimer > 0
    ) {
      this.renderSpeechBubble(
        state.cat.x + CAT_SIZE / 2,
        state.cat.y,
        state.cat.speechBubble,
        camX,
        camY,
      );
    }

    // --- 12. UI layer: dialog box ---
    renderDialog(ctx, state.dialog, w, h, state.frame);

    // --- 13. Night overlay ---
    renderNightOverlay(ctx, state.environment.nightAlpha, w, h);

    // --- 14. Weather effects (rain on rooftop) ---
    if (
      state.currentFloor === FloorId.ROOFTOP &&
      state.environment.weather === "rain"
    ) {
      this.renderRainOverlay(state, camX, camY);
    }

    // --- 15. Screen transition (fade to/from black) ---
    renderTransition(ctx, state.transition, w, h);
  }

  // -----------------------------------------------------------------------
  // Camera
  // -----------------------------------------------------------------------

  private updateCamera(state: GameState, zoom: number): void {
    const cam = state.camera;

    // Determine which character the camera should follow
    let targetChar: Character | undefined;
    if (cam.spectatorMode && cam.spectatorTargetId) {
      targetChar = state.characters.find(
        (c) => c.id === cam.spectatorTargetId,
      );
    }
    if (!targetChar) {
      targetChar = state.player;
    }

    // Target: center the character in the viewport
    const viewW = this.width / zoom;
    const viewH = this.height / zoom;

    cam.targetX = targetChar.x + CHAR_SIZE / 2 - viewW / 2;
    cam.targetY = targetChar.y + CHAR_SIZE / 2 - viewH / 2;

    // Clamp to map bounds
    const maxX = FLOOR_WIDTH - viewW;
    const maxY = FLOOR_HEIGHT - viewH;
    cam.targetX = clamp(cam.targetX, 0, Math.max(0, maxX));
    cam.targetY = clamp(cam.targetY, 0, Math.max(0, maxY));

    // Smooth follow with lerp
    cam.x += (cam.targetX - cam.x) * CAMERA_LERP;
    cam.y += (cam.targetY - cam.y) * CAMERA_LERP;

    // Clamp camera position too
    cam.x = clamp(cam.x, 0, Math.max(0, maxX));
    cam.y = clamp(cam.y, 0, Math.max(0, maxY));
  }

  // -----------------------------------------------------------------------
  // Floor Tiles
  // -----------------------------------------------------------------------

  private renderFloorTiles(
    floor: FloorData,
    camX: number,
    camY: number,
  ): void {
    const ctx = this.ctx;
    const zoom = ZOOM;
    const tileScreen = TILE_SIZE * zoom;

    // Calculate visible tile range (camera culling)
    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE) - CULL_PAD);
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE) - CULL_PAD);
    const endCol = Math.min(
      FLOOR_COLS,
      Math.ceil((camX + this.width / zoom) / TILE_SIZE) + CULL_PAD,
    );
    const endRow = Math.min(
      FLOOR_ROWS,
      Math.ceil((camY + this.height / zoom) / TILE_SIZE) + CULL_PAD,
    );

    for (let row = startRow; row < endRow; row++) {
      const tileRow = floor.tiles[row];
      if (!tileRow) continue;

      for (let col = startCol; col < endCol; col++) {
        const tile = tileRow[col];
        if (tile === undefined || tile === TileType.VOID) continue;

        // Skip wall types here — rendered separately
        if (
          tile === TileType.WALL ||
          tile === TileType.WALL_TOP ||
          tile === TileType.WALL_ACCENT
        ) {
          continue;
        }

        const sx = Math.floor((col * TILE_SIZE - camX) * zoom);
        const sy = Math.floor((row * TILE_SIZE - camY) * zoom);

        // Checkerboard helper
        const checker = (col + row) % 2 === 0;

        switch (tile) {
          case TileType.FLOOR:
          case TileType.FLOOR_ALT:
            ctx.fillStyle = checker ? GBC.floorLight : GBC.floorDark;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            break;

          case TileType.CARPET:
            ctx.fillStyle = GBC.carpetRed;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            break;

          case TileType.CARPET_ALT:
            ctx.fillStyle = GBC.carpetLight;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            break;

          case TileType.METAL_FLOOR:
            ctx.fillStyle = GBC.metalDark;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            break;

          case TileType.METAL_ALT:
            ctx.fillStyle = GBC.metalVDark;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            break;

          case TileType.WOOD_FLOOR:
            ctx.fillStyle = GBC.woodLight;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            // Wood grain lines
            ctx.fillStyle = GBC.woodMed;
            ctx.fillRect(sx, sy + Math.floor(tileScreen * 0.3), tileScreen, zoom);
            ctx.fillRect(sx, sy + Math.floor(tileScreen * 0.7), tileScreen, zoom);
            break;

          case TileType.GRASS:
          case TileType.GRASS_ALT:
            ctx.fillStyle = checker ? GBC.plantMed : GBC.plantLight;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            break;

          case TileType.RAILING: {
            // Base floor
            ctx.fillStyle = GBC.metalLight;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            // Horizontal rail lines
            ctx.fillStyle = GBC.metalDark;
            ctx.fillRect(sx, sy + zoom, tileScreen, zoom);
            ctx.fillRect(sx, sy + tileScreen - zoom * 2, tileScreen, zoom);
            // Vertical post in center
            ctx.fillRect(
              sx + Math.floor(tileScreen / 2) - zoom,
              sy,
              zoom,
              tileScreen,
            );
            break;
          }

          case TileType.WELCOME_MAT: {
            ctx.fillStyle = GBC.carpetRed;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            // Pattern: lighter center stripe
            ctx.fillStyle = GBC.carpetLight;
            ctx.fillRect(
              sx + zoom * 2,
              sy + zoom * 2,
              tileScreen - zoom * 4,
              tileScreen - zoom * 4,
            );
            // Border dots
            ctx.fillStyle = GBC.yellow;
            ctx.fillRect(sx + zoom, sy + zoom, zoom, zoom);
            ctx.fillRect(sx + tileScreen - zoom * 2, sy + zoom, zoom, zoom);
            ctx.fillRect(
              sx + zoom,
              sy + tileScreen - zoom * 2,
              zoom,
              zoom,
            );
            ctx.fillRect(
              sx + tileScreen - zoom * 2,
              sy + tileScreen - zoom * 2,
              zoom,
              zoom,
            );
            break;
          }

          case TileType.CABLE_FLOOR: {
            ctx.fillStyle = GBC.metalDark;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            // Cable lines (lighter)
            ctx.fillStyle = GBC.metalMed;
            const cableY1 = sy + Math.floor(tileScreen * 0.25);
            const cableY2 = sy + Math.floor(tileScreen * 0.65);
            ctx.fillRect(sx, cableY1, tileScreen, zoom);
            ctx.fillRect(sx, cableY2, tileScreen, zoom);
            break;
          }

          case TileType.WINDOW:
            // Rendered in wall pass — skip here
            break;

          case TileType.STAIRS_UP: {
            ctx.fillStyle = GBC.woodMed;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            // Step lines
            ctx.fillStyle = GBC.woodDark;
            for (let s = 0; s < 4; s++) {
              const stepY = sy + s * Math.floor(tileScreen / 4);
              ctx.fillRect(sx, stepY, tileScreen, zoom);
            }
            // Up arrow indicator
            this.renderArrowIndicator(
              ctx,
              sx + Math.floor(tileScreen / 2),
              sy + Math.floor(tileScreen / 2),
              "up",
            );
            break;
          }

          case TileType.STAIRS_DOWN: {
            ctx.fillStyle = GBC.woodMed;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            // Step lines
            ctx.fillStyle = GBC.woodDark;
            for (let s = 0; s < 4; s++) {
              const stepY = sy + s * Math.floor(tileScreen / 4);
              ctx.fillRect(sx, stepY, tileScreen, zoom);
            }
            // Down arrow indicator
            this.renderArrowIndicator(
              ctx,
              sx + Math.floor(tileScreen / 2),
              sy + Math.floor(tileScreen / 2),
              "down",
            );
            break;
          }

          case TileType.PATH:
            ctx.fillStyle = GBC.cream;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            // Stone path edge marks
            ctx.fillStyle = GBC.gray;
            if (checker) {
              ctx.fillRect(sx, sy, zoom, zoom);
              ctx.fillRect(
                sx + tileScreen - zoom,
                sy + tileScreen - zoom,
                zoom,
                zoom,
              );
            }
            break;

          case TileType.DOOR:
            ctx.fillStyle = GBC.woodLight;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            // Door frame
            ctx.fillStyle = GBC.woodDark;
            ctx.fillRect(sx, sy, zoom, tileScreen);
            ctx.fillRect(sx + tileScreen - zoom, sy, zoom, tileScreen);
            ctx.fillRect(sx, sy, tileScreen, zoom);
            // Door handle
            ctx.fillStyle = GBC.metalLight;
            ctx.fillRect(
              sx + tileScreen - zoom * 4,
              sy + Math.floor(tileScreen / 2),
              zoom,
              zoom * 2,
            );
            break;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Wall Rendering (base layer — below entities)
  // -----------------------------------------------------------------------

  private renderWalls(
    floor: FloorData,
    camX: number,
    camY: number,
  ): void {
    const ctx = this.ctx;
    const zoom = ZOOM;
    const tileScreen = TILE_SIZE * zoom;

    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE) - CULL_PAD);
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE) - CULL_PAD);
    const endCol = Math.min(
      FLOOR_COLS,
      Math.ceil((camX + this.width / zoom) / TILE_SIZE) + CULL_PAD,
    );
    const endRow = Math.min(
      FLOOR_ROWS,
      Math.ceil((camY + this.height / zoom) / TILE_SIZE) + CULL_PAD,
    );

    for (let row = startRow; row < endRow; row++) {
      const tileRow = floor.tiles[row];
      if (!tileRow) continue;

      for (let col = startCol; col < endCol; col++) {
        const tile = tileRow[col];
        if (tile === undefined) continue;

        const sx = Math.floor((col * TILE_SIZE - camX) * zoom);
        const sy = Math.floor((row * TILE_SIZE - camY) * zoom);

        switch (tile) {
          case TileType.WALL:
            ctx.fillStyle = GBC.wallBrown;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            // Bottom accent edge
            ctx.fillStyle = GBC.wallEdge;
            ctx.fillRect(sx, sy + tileScreen - zoom, tileScreen, zoom);
            break;

          case TileType.WALL_ACCENT:
            ctx.fillStyle = GBC.wallLight;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            // Subtle dark edge
            ctx.fillStyle = GBC.wallBrown;
            ctx.fillRect(sx, sy + tileScreen - zoom, tileScreen, zoom);
            break;

          case TileType.WINDOW:
            // Wall around the window
            ctx.fillStyle = GBC.wallBrown;
            ctx.fillRect(sx, sy, tileScreen, tileScreen);
            // Window pane (inset)
            this.renderWindowPane(ctx, sx, sy, tileScreen, zoom);
            break;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Wall Top Overhang Layer (above entities — creates 3D depth)
  // -----------------------------------------------------------------------

  private renderWallTops(
    floor: FloorData,
    camX: number,
    camY: number,
  ): void {
    const ctx = this.ctx;
    const zoom = ZOOM;
    const tileScreen = TILE_SIZE * zoom;

    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE) - CULL_PAD);
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE) - CULL_PAD);
    const endCol = Math.min(
      FLOOR_COLS,
      Math.ceil((camX + this.width / zoom) / TILE_SIZE) + CULL_PAD,
    );
    const endRow = Math.min(
      FLOOR_ROWS,
      Math.ceil((camY + this.height / zoom) / TILE_SIZE) + CULL_PAD,
    );

    for (let row = startRow; row < endRow; row++) {
      const tileRow = floor.tiles[row];
      if (!tileRow) continue;

      for (let col = startCol; col < endCol; col++) {
        const tile = tileRow[col];
        if (tile !== TileType.WALL_TOP) continue;

        const sx = Math.floor((col * TILE_SIZE - camX) * zoom);
        const sy = Math.floor((row * TILE_SIZE - camY) * zoom);

        // Dark overhang block
        ctx.fillStyle = GBC.wallDark;
        ctx.fillRect(sx, sy, tileScreen, tileScreen);

        // Lighter bottom edge for shadow gradient effect
        ctx.fillStyle = GBC.wallEdge;
        ctx.fillRect(sx, sy + tileScreen - zoom, tileScreen, zoom);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Window Pane (shows sky / time of day)
  // -----------------------------------------------------------------------

  private windowEnv: EnvironmentState | null = null;

  /** Store the environment for window color lookups during render */
  private renderWindowPane(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    tileScreen: number,
    zoom: number,
  ): void {
    const inset = zoom * 2;
    const paneX = sx + inset;
    const paneY = sy + inset;
    const paneW = tileScreen - inset * 2;
    const paneH = tileScreen - inset * 2;

    // Use stored environment or fall back to default
    const color = this.windowEnv
      ? getWindowColor(this.windowEnv)
      : GBC.waterLight;

    // Window glass
    ctx.fillStyle = color;
    ctx.fillRect(paneX, paneY, paneW, paneH);

    // Night: tiny star dots
    if (this.windowEnv && this.windowEnv.timeOfDay === "night") {
      ctx.fillStyle = GBC.white;
      // Deterministic star positions based on tile location
      const seed = sx * 7 + sy * 13;
      if ((seed % 5) < 3) {
        ctx.fillRect(paneX + zoom, paneY + zoom, zoom, zoom);
      }
      if ((seed % 7) < 2) {
        ctx.fillRect(paneX + paneW - zoom * 2, paneY + zoom * 2, zoom, zoom);
      }
    }

    // Rain streaks
    if (this.windowEnv && this.windowEnv.weather === "rain") {
      ctx.fillStyle = GBC.waterDark;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(paneX + zoom, paneY, zoom, paneH);
      ctx.fillRect(paneX + zoom * 3, paneY + zoom, zoom, paneH - zoom);
      ctx.globalAlpha = 1;
    }

    // Window frame border
    ctx.fillStyle = GBC.wallEdge;
    ctx.fillRect(paneX, paneY, paneW, zoom);
    ctx.fillRect(paneX, paneY + paneH - zoom, paneW, zoom);
    ctx.fillRect(paneX, paneY, zoom, paneH);
    ctx.fillRect(paneX + paneW - zoom, paneY, zoom, paneH);

    // Center cross divider
    ctx.fillRect(
      paneX + Math.floor(paneW / 2),
      paneY,
      zoom,
      paneH,
    );
    ctx.fillRect(
      paneX,
      paneY + Math.floor(paneH / 2),
      paneW,
      zoom,
    );
  }

  // -----------------------------------------------------------------------
  // Stair Arrow Indicator
  // -----------------------------------------------------------------------

  private renderArrowIndicator(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    dir: "up" | "down",
  ): void {
    const zoom = ZOOM;
    ctx.fillStyle = GBC.white;
    ctx.globalAlpha = 0.8;

    if (dir === "up") {
      // Upward arrow: ▲
      ctx.fillRect(cx - zoom, cy, zoom * 2, zoom);
      ctx.fillRect(cx - zoom * 2, cy + zoom, zoom * 4, zoom);
      ctx.fillRect(cx, cy - zoom, zoom, zoom);
    } else {
      // Downward arrow: ▼
      ctx.fillRect(cx - zoom * 2, cy - zoom, zoom * 4, zoom);
      ctx.fillRect(cx - zoom, cy, zoom * 2, zoom);
      ctx.fillRect(cx, cy + zoom, zoom, zoom);
    }

    ctx.globalAlpha = 1;
  }

  // -----------------------------------------------------------------------
  // Sprite Drawing
  // -----------------------------------------------------------------------

  private drawSprite(
    sprite: SpriteData,
    screenX: number,
    screenY: number,
    alpha?: number,
  ): void {
    const ctx = this.ctx;
    const zoom = ZOOM;
    const prevAlpha = ctx.globalAlpha;

    if (alpha !== undefined) {
      ctx.globalAlpha = alpha;
    }

    for (let r = 0; r < sprite.length; r++) {
      const row = sprite[r];
      for (let c = 0; c < row.length; c++) {
        const color = row[c];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(
            screenX + c * zoom,
            screenY + r * zoom,
            zoom,
            zoom,
          );
        }
      }
    }

    ctx.globalAlpha = prevAlpha;
  }

  // -----------------------------------------------------------------------
  // Character Rendering
  // -----------------------------------------------------------------------

  private renderCharacter(
    char: Character,
    camX: number,
    camY: number,
  ): void {
    const zoom = ZOOM;
    const sx = Math.floor((char.x - camX) * zoom);
    const sy = Math.floor((char.y - camY) * zoom);

    // Get the correct sprite for current state
    const sprite = this.getCharacterSprite(char);
    const alpha = char.isSubagent ? 0.7 : 1;

    // Shadow beneath character
    const ctx = this.ctx;
    ctx.fillStyle = GBC.black;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(
      sx + zoom * 2,
      sy + (CHAR_SIZE - 2) * zoom,
      (CHAR_SIZE - 4) * zoom,
      zoom * 2,
    );
    ctx.globalAlpha = 1;

    // Draw the sprite
    this.drawSprite(sprite, sx, sy, alpha);

    // Coffee cup in hand during coffee state
    if (char.state === "coffee") {
      ctx.fillStyle = GBC.woodDark;
      const cupOffsetX =
        char.direction === Direction.LEFT ? 1 : CHAR_SIZE - 3;
      ctx.fillRect(
        sx + cupOffsetX * zoom,
        sy + 7 * zoom,
        zoom * 2,
        zoom * 3,
      );
      ctx.fillStyle = GBC.white;
      ctx.fillRect(
        sx + cupOffsetX * zoom,
        sy + 7 * zoom,
        zoom * 2,
        zoom,
      );
    }
  }

  private getCharacterSprite(char: Character): SpriteData {
    const dir = directionKey(char.direction);

    switch (char.state) {
      case "walk":
        // Alternating walk frames: [idle, walk1, walk2] -> 1 + (animFrame % 2)
        return char.sprites[dir][1 + (char.animFrame % 2)];

      case "type":
        return char.sprites.type[char.animFrame % 2];

      case "sleep":
        return char.sprites.sleep;

      case "coffee":
      case "think":
        // Use idle pose in facing direction
        return char.sprites[dir][0];

      case "idle":
      default:
        return char.sprites[dir][0];
    }
  }

  // -----------------------------------------------------------------------
  // Cat Rendering
  // -----------------------------------------------------------------------

  private renderCat(cat: Cat, camX: number, camY: number): void {
    const zoom = ZOOM;
    const sx = Math.floor((cat.x - camX) * zoom);
    const sy = Math.floor((cat.y - camY) * zoom);

    const sprite = this.getCatSprite(cat);

    // Tiny shadow
    const ctx = this.ctx;
    ctx.fillStyle = GBC.black;
    ctx.globalAlpha = 0.1;
    ctx.fillRect(
      sx + zoom,
      sy + (CAT_SIZE - 1) * zoom,
      (CAT_SIZE - 2) * zoom,
      zoom,
    );
    ctx.globalAlpha = 1;

    this.drawSprite(sprite, sx, sy);
  }

  private getCatSprite(cat: Cat): SpriteData {
    const dir = directionKey(cat.direction);

    switch (cat.state) {
      case "sleep":
        // If actively pathing, show walk animation; otherwise sleep pose
        if (cat.path.length > 0 && cat.pathIndex < cat.path.length) {
          return cat.sprites[dir][cat.animFrame % 2];
        }
        return cat.sprites.sleep;

      case "sit":
        return cat.sprites.sit;

      case "wander":
      case "follow":
        if (cat.path.length > 0 && cat.pathIndex < cat.path.length) {
          return cat.sprites[dir][cat.animFrame % 2];
        }
        return cat.sprites.sit;
    }
  }

  // -----------------------------------------------------------------------
  // Furniture Rendering
  // -----------------------------------------------------------------------

  private renderFurniture(
    f: FurnitureInstance,
    camX: number,
    camY: number,
  ): void {
    const zoom = ZOOM;
    const sx = Math.floor((f.col * TILE_SIZE - camX) * zoom);
    const sy = Math.floor((f.row * TILE_SIZE - camY) * zoom);

    this.drawSprite(f.sprite, sx, sy);
  }

  // -----------------------------------------------------------------------
  // Monitor Screens
  // -----------------------------------------------------------------------

  private renderMonitorScreens(
    state: GameState,
    floor: FloorData,
    camX: number,
    camY: number,
  ): void {
    const zoom = ZOOM;

    for (const mon of state.monitors) {
      // Find the desk this monitor belongs to
      const desk = floor.desks[mon.deskIndex];
      if (!desk) continue;

      // Monitor screen is rendered relative to desk position
      // The monitor furniture is typically 1 tile above the desk seat
      // Find the monitor furniture associated with this desk
      const monFurniture = floor.furniture.find(
        (f) =>
          f.kind === "monitor" &&
          Math.abs(f.col - desk.pos.col) <= 1 &&
          Math.abs(f.row - desk.pos.row) <= 1,
      );

      if (!monFurniture) continue;

      // Screen area: offset into the monitor sprite
      const monSX = Math.floor(
        (monFurniture.col * TILE_SIZE + 3 - camX) * zoom,
      );
      const monSY = Math.floor(
        (monFurniture.row * TILE_SIZE + 2 - camY) * zoom,
      );

      renderMonitorScreen(
        this.ctx,
        mon,
        monSX,
        monSY,
        zoom,
        state.frame,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Speech Bubbles
  // -----------------------------------------------------------------------

  private renderSpeechBubble(
    x: number,
    y: number,
    text: string,
    camX: number,
    camY: number,
  ): void {
    const ctx = this.ctx;
    const zoom = ZOOM;

    // Screen position (centered above the entity)
    const sx = Math.floor((x - camX) * zoom);
    const sy = Math.floor((y - camY) * zoom);

    // Truncate long text
    const maxLen = 16;
    const display =
      text.length > maxLen ? text.slice(0, maxLen - 1) + "~" : text;

    // Measure
    ctx.save();
    ctx.font = `${Math.max(8, zoom * 3)}px monospace`;
    const metrics = ctx.measureText(display);
    const textW = metrics.width;

    const padX = zoom * 2;
    const padY = zoom * 1.5;
    const bubbleW = textW + padX * 2;
    const bubbleH = zoom * 4 + padY * 2;
    const bx = Math.floor(sx - bubbleW / 2);
    const by = sy - bubbleH - zoom * 3;

    // Bubble background
    ctx.fillStyle = GBC.dialogBg;
    ctx.fillRect(bx, by, bubbleW, bubbleH);

    // Bubble border
    ctx.fillStyle = GBC.dialogBorder;
    ctx.fillRect(bx, by, bubbleW, zoom); // top
    ctx.fillRect(bx, by + bubbleH - zoom, bubbleW, zoom); // bottom
    ctx.fillRect(bx, by, zoom, bubbleH); // left
    ctx.fillRect(bx + bubbleW - zoom, by, zoom, bubbleH); // right

    // Pointer triangle (pointing down)
    ctx.fillStyle = GBC.dialogBg;
    ctx.fillRect(sx - zoom, by + bubbleH, zoom * 2, zoom);
    ctx.fillRect(sx, by + bubbleH + zoom, zoom, zoom);
    // Pointer border
    ctx.fillStyle = GBC.dialogBorder;
    ctx.fillRect(sx - zoom * 2, by + bubbleH, zoom, zoom);
    ctx.fillRect(sx + zoom, by + bubbleH, zoom, zoom);
    ctx.fillRect(sx - zoom, by + bubbleH + zoom, zoom, zoom);
    ctx.fillRect(sx + zoom, by + bubbleH + zoom, zoom, zoom);

    // Text
    ctx.fillStyle = GBC.dialogText;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(display, sx, by + Math.floor(bubbleH / 2));

    ctx.restore();
  }

  // -----------------------------------------------------------------------
  // Name Labels
  // -----------------------------------------------------------------------

  private renderNameLabel(
    name: string,
    emoji: string,
    x: number,
    y: number,
    camX: number,
    camY: number,
  ): void {
    const ctx = this.ctx;
    const zoom = ZOOM;

    // Position: centered below the character
    const sx = Math.floor((x + CHAR_SIZE / 2 - camX) * zoom);
    const sy = Math.floor((y + CHAR_SIZE + 1 - camY) * zoom);

    ctx.save();

    const fontSize = Math.max(7, zoom * 2.5);
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const label = `${emoji} ${name}`;

    // Shadow
    ctx.fillStyle = GBC.black;
    ctx.globalAlpha = 0.4;
    ctx.fillText(label, sx + 1, sy + 1);

    // Text
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = GBC.white;
    ctx.fillText(label, sx, sy);

    ctx.restore();
  }

  // -----------------------------------------------------------------------
  // Activity Bubble Text
  // -----------------------------------------------------------------------

  private getActivityBubbleText(
    char: Character,
    frame: number,
  ): string | null {
    switch (char.state) {
      case "type":
        return "...";

      case "think": {
        const dots = 1 + (Math.floor(frame / 15) % 3);
        return ".".repeat(dots);
      }

      case "sleep":
        return "zzZ";

      case "coffee":
        if (char.coffeeState === "brewing") return "~coffee~";
        return null;

      default:
        // Show current task as tiny bubble if idle and has a task
        if (char.currentTask && char.state === "idle") {
          return char.currentTask;
        }
        return null;
    }
  }

  // -----------------------------------------------------------------------
  // Rooftop Special Rendering
  // -----------------------------------------------------------------------

  private renderRooftopBackground(
    env: EnvironmentState,
    camX: number,
    camY: number,
  ): void {
    const ctx = this.ctx;
    const zoom = ZOOM;
    const w = this.width;
    const h = this.height;

    // Sky gradient background
    const skyColor = getSkyColor(env);
    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, w, h);

    // Slightly darker band at the top for depth
    ctx.fillStyle = GBC.black;
    ctx.globalAlpha = 0.1;
    ctx.fillRect(0, 0, w, Math.floor(h * 0.15));
    ctx.globalAlpha = 1;

    // Stars at night
    if (env.timeOfDay === "night") {
      ctx.fillStyle = GBC.white;
      // Deterministic star field
      for (let i = 0; i < 40; i++) {
        const starX = ((i * 137 + 43) % w);
        const starY = ((i * 89 + 17) % Math.floor(h * 0.4));
        const twinkle = Math.sin(i * 2.7 + env.minute * 0.3) > 0.3;
        if (twinkle) {
          ctx.globalAlpha = 0.5 + ((i * 31) % 50) / 100;
          ctx.fillRect(starX, starY, zoom, zoom);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Skyline silhouette
    this.renderSkyline(camY);
  }

  private renderSkyline(camY: number): void {
    const ctx = this.ctx;
    const zoom = ZOOM;
    const w = this.width;

    // Skyline sits at the bottom of the sky area
    // Anchor it relative to the top of the floor map area
    const baseY = Math.floor((FLOOR_HEIGHT * 0.3 - camY) * zoom);

    for (const bldg of SKYLINE_BUILDINGS) {
      const bx = bldg.x * zoom;
      const bw = bldg.w * zoom;
      const bh = bldg.h * zoom;
      const by = baseY - bh;

      // Skip if off-screen
      if (bx + bw < 0 || bx > w) continue;

      // Building body
      ctx.fillStyle = bldg.shade;
      ctx.fillRect(bx, by, bw, bh);

      // Window grid
      ctx.fillStyle = GBC.yellow;
      ctx.globalAlpha = 0.25;
      const winSize = zoom * 2;
      const winGap = zoom * 4;
      for (let wy = by + winGap; wy < by + bh - winGap; wy += winGap) {
        for (let wx = bx + winGap; wx < bx + bw - winGap; wx += winGap) {
          // Some windows are lit, some are dark
          if (((wx * 7 + wy * 13) % 11) > 4) {
            ctx.fillRect(wx, wy, winSize, winSize);
          }
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  // -----------------------------------------------------------------------
  // Rain Overlay (Rooftop)
  // -----------------------------------------------------------------------

  private renderRainOverlay(
    state: GameState,
    camX: number,
    camY: number,
  ): void {
    const ctx = this.ctx;
    const zoom = ZOOM;

    // Dark overlay for rain atmosphere
    ctx.fillStyle = GBC.skyNight;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 1;

    // Rain particles are handled by the particle system,
    // but we add a subtle horizontal streak effect too
    ctx.fillStyle = GBC.waterDark;
    ctx.globalAlpha = 0.1;

    const streakCount = 12;
    for (let i = 0; i < streakCount; i++) {
      // Pseudo-random positions seeded by frame + index
      const seed = (state.frame * 3 + i * 97) % 500;
      const sx = (seed * 3) % this.width;
      const sy = (seed * 7 + i * 41) % this.height;
      ctx.fillRect(sx, sy, zoom, zoom * 6);
    }

    ctx.globalAlpha = 1;
  }

  // -----------------------------------------------------------------------
  // Hit Testing (for mouse interaction)
  // -----------------------------------------------------------------------

  getEntityAt(
    screenX: number,
    screenY: number,
    state: GameState,
    floors: Map<FloorId, FloorData>,
  ): { type: "character"; character: Character } | { type: "cat" } | null {
    const zoom = ZOOM;
    const camX = state.camera.x;
    const camY = state.camera.y;

    // Convert screen coordinates to game coordinates
    const gameX = screenX / zoom + camX;
    const gameY = screenY / zoom + camY;

    // Check characters (reverse order: last rendered = on top)
    const floorChars = state.characters.filter(
      (c) => c.floor === state.currentFloor,
    );
    for (let i = floorChars.length - 1; i >= 0; i--) {
      const char = floorChars[i];
      if (
        gameX >= char.x &&
        gameX < char.x + CHAR_SIZE &&
        gameY >= char.y &&
        gameY < char.y + CHAR_SIZE
      ) {
        return { type: "character", character: char };
      }
    }

    // Check cat
    const cat = state.cat;
    if (
      cat.floor === state.currentFloor &&
      gameX >= cat.x &&
      gameX < cat.x + CAT_SIZE &&
      gameY >= cat.y &&
      gameY < cat.y + CAT_SIZE
    ) {
      return { type: "cat" };
    }

    return null;
  }
}
