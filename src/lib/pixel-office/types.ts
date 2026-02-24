// ---------------------------------------------------------------------------
// Pixel Office V2 — Type Definitions
// ---------------------------------------------------------------------------

/** Tile-based coordinate */
export interface TilePos {
  col: number;
  row: number;
}

/** Sub-pixel coordinate (logical pixels, before zoom) */
export interface PixelPos {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------

/** 2D array of hex color strings. '' = transparent. */
export type SpriteData = string[][];

/** Character palette for generating sprites from templates */
export interface CharacterPalette {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
}

// ---------------------------------------------------------------------------
// Agent / Activity
// ---------------------------------------------------------------------------

export type AgentActivity = "typing" | "thinking" | "idle" | "sleeping" | "walking";

export interface OfficeAgent {
  id: string;
  name: string;
  emoji: string;
  status: "active" | "idle" | "unknown";
  activity: AgentActivity;
  color: { primary: string; secondary: string; skin: string };
  currentTask: string | null;
  model?: string;
  totalTokens?: number;
  isSubagent?: boolean;
  parentId?: string;
}

// ---------------------------------------------------------------------------
// Character State Machine
// ---------------------------------------------------------------------------

export type CharacterState = "idle" | "walk" | "type" | "sleep" | "coffee";

export type Direction = "down" | "up" | "left" | "right";

export interface CharacterSpriteSet {
  front: SpriteData;
  walkDown: [SpriteData, SpriteData];
  walkUp: [SpriteData, SpriteData];
  walkLeft: [SpriteData, SpriteData];
  walkRight: [SpriteData, SpriteData];
  type: [SpriteData, SpriteData];
  sleep: SpriteData;
}

export interface DeskAssignment {
  col: number;
  row: number;
  chairCol: number;
  chairRow: number;
  monitorCol: number;
  monitorRow: number;
}

export interface Character {
  id: string;
  name: string;
  emoji: string;
  status: "active" | "idle" | "unknown";
  model?: string;
  totalTokens?: number;
  currentTask: string | null;

  // Visual
  palette: CharacterPalette;
  sprites: CharacterSpriteSet;
  isSubagent: boolean;

  // Position (sub-pixel for smooth movement)
  x: number;
  y: number;
  col: number;
  row: number;
  direction: Direction;

  // State machine
  state: CharacterState;
  targetActivity: AgentActivity;
  animFrame: number;
  animTimer: number;

  // Pathfinding
  path: TilePos[];
  pathIndex: number;
  moveProgress: number;

  // Behavior timers (seconds)
  stateTimer: number;
  wanderCount: number;
  coffeeTimer: number;
  typingDuration: number;

  // Desk assignment
  desk: DeskAssignment | null;
  deskIndex: number;

  // Sub-agent specific
  parentId?: string;
  spawnTimer: number;
  despawnTimer: number;
}

// ---------------------------------------------------------------------------
// Cat
// ---------------------------------------------------------------------------

export type CatState = "wander" | "sit" | "sleep" | "follow";

export interface Cat {
  x: number;
  y: number;
  col: number;
  row: number;
  direction: Direction;
  state: CatState;
  animFrame: number;
  animTimer: number;
  stateTimer: number;
  path: TilePos[];
  pathIndex: number;
  moveProgress: number;
  followTargetId: string | null;
  targetCol: number;
  targetRow: number;
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

export type ParticleType =
  | "steam"
  | "zzz"
  | "music"
  | "star"
  | "rain"
  | "sparkle"
  | "coffeeSteam";

export interface Particle {
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  /** For text-based particles like ZZZ or music notes */
  char?: string;
}

// ---------------------------------------------------------------------------
// Effects / Environment
// ---------------------------------------------------------------------------

export type TimeOfDay = "sunrise" | "day" | "sunset" | "night";

export interface EnvironmentState {
  timeOfDay: TimeOfDay;
  hour: number;
  minute: number;
  isRaining: boolean;
  rainTimer: number;
  rainCheckTimer: number;
  nightOverlayAlpha: number;
}

// ---------------------------------------------------------------------------
// Tile Map
// ---------------------------------------------------------------------------

export type TileType =
  | "floor_work"
  | "floor_kitchen"
  | "floor_server"
  | "floor_lounge"
  | "wall"
  | "wall_accent"
  | "door"
  | "window";

export interface TileInfo {
  type: TileType;
  walkable: boolean;
  /** For checkerboard pattern */
  variant: 0 | 1;
}

// ---------------------------------------------------------------------------
// Furniture / Static Objects
// ---------------------------------------------------------------------------

export type FurnitureType =
  | "desk"
  | "chair"
  | "monitor"
  | "whiteboard"
  | "coffee_machine"
  | "fridge"
  | "microwave"
  | "kitchen_table"
  | "server_rack"
  | "couch"
  | "bookshelf"
  | "plant"
  | "clock"
  | "pizza_box"
  | "post_it";

export interface Furniture {
  type: FurnitureType;
  col: number;
  row: number;
  widthTiles: number;
  heightTiles: number;
  sprite: SpriteData;
  /** Bottom y for z-sorting (in pixels) */
  zSortY: number;
}

// ---------------------------------------------------------------------------
// Server LED
// ---------------------------------------------------------------------------

export interface ServerLed {
  x: number;
  y: number;
  color: string;
  blinkRate: number;
  blinkTimer: number;
  on: boolean;
}

// ---------------------------------------------------------------------------
// Monitor state (per desk)
// ---------------------------------------------------------------------------

export interface MonitorState {
  deskIndex: number;
  activity: AgentActivity | "off";
  /** For matrix-style scrolling text */
  scrollOffset: number;
  /** For screensaver bounce */
  bounceX: number;
  bounceY: number;
  bounceDx: number;
  bounceDy: number;
}

// ---------------------------------------------------------------------------
// Complete Office State (passed to renderer each frame)
// ---------------------------------------------------------------------------

export interface OfficeState {
  characters: Character[];
  cat: Cat;
  particles: Particle[];
  environment: EnvironmentState;
  furniture: Furniture[];
  serverLeds: ServerLed[];
  monitors: MonitorState[];
  frame: number;
  time: number;
}

// ---------------------------------------------------------------------------
// Renderable entity (for z-sorting)
// ---------------------------------------------------------------------------

export interface RenderEntity {
  type: "furniture" | "character" | "cat";
  zSortY: number;
  id: string;
  render: (ctx: CanvasRenderingContext2D, frame: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TILE_SIZE = 16;
export const ZOOM = 3;
export const GRID_COLS = 34;
export const GRID_ROWS = 22;
export const OFFICE_WIDTH = GRID_COLS * TILE_SIZE;
export const OFFICE_HEIGHT = GRID_ROWS * TILE_SIZE;

// Movement speed in pixels per second
export const WALK_SPEED = 32;
export const CAT_WALK_SPEED = 24;

// Animation constants
export const ANIM_FRAME_DURATION = 0.2; // seconds per animation frame
export const MAX_DELTA = 0.1; // cap delta time to prevent jumps
export const TARGET_FPS = 30;

// ---------------------------------------------------------------------------
// Color Constants
// ---------------------------------------------------------------------------

export const COLORS = {
  BG: "#0D0D1A",
  FLOOR_WORK_A: "#1A1A2E",
  FLOOR_WORK_B: "#1E1E32",
  FLOOR_KITCHEN_A: "#2A2018",
  FLOOR_KITCHEN_B: "#2E2420",
  FLOOR_SERVER_A: "#141420",
  FLOOR_SERVER_B: "#181828",
  FLOOR_LOUNGE_A: "#1E1A28",
  FLOOR_LOUNGE_B: "#221E30",
  WALL: "#252542",
  WALL_ACCENT: "#2D2D4A",
  DESK_WOOD: "#8B6914",
  DESK_TOP: "#A07828",
  DESK_HIGHLIGHT: "#B8922E",
  MONITOR_FRAME: "#333333",
  COUCH: "#4A3060",
  BOOKSHELF: "#6B4226",
  COFFEE_MACHINE: "#2A2A2A",
  SERVER_RACK: "#1A1A2A",
  FRIDGE: "#D0D0D8",
} as const;
