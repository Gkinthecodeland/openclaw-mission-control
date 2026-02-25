// ---------------------------------------------------------------------------
// Pixel Office V3 — Pokemon Red Edition — Type Definitions
// ---------------------------------------------------------------------------

// ===== CONSTANTS ==========================================================

export const TILE_SIZE = 16;
export const ZOOM = 3;
export const RENDER_TILE = TILE_SIZE * ZOOM;

/** Each floor is 30x22 tiles */
export const FLOOR_COLS = 30;
export const FLOOR_ROWS = 22;
export const FLOOR_WIDTH = FLOOR_COLS * TILE_SIZE;
export const FLOOR_HEIGHT = FLOOR_ROWS * TILE_SIZE;

// Movement
export const WALK_SPEED = 48;        // px/s in game coords
export const CAT_WALK_SPEED = 32;
export const PLAYER_WALK_SPEED = 64;  // player moves faster

// Animation
export const ANIM_FRAME_DURATION = 0.18;
export const TYPE_FRAME_DURATION = 0.25;
export const CAT_ANIM_DURATION = 0.25;
export const MAX_DELTA = 0.1;
export const TARGET_FPS = 30;

// Camera
export const CAMERA_LERP = 0.1;
export const SPECTATOR_TIMEOUT = 30; // seconds idle before spectator mode

// Dialog
export const DIALOG_CHAR_SPEED = 0.03; // seconds per character
export const DIALOG_MARGIN = 8;

// Transitions
export const TRANSITION_DURATION = 0.6; // seconds for fade in/out

// Polling
export const POLL_MS = 5000;

// ===== ENUMS ==============================================================

export const enum TileType {
  VOID = 0,
  FLOOR = 1,
  FLOOR_ALT = 2,
  WALL = 3,
  WALL_TOP = 4,
  WALL_ACCENT = 5,
  DOOR = 6,
  STAIRS_UP = 7,
  STAIRS_DOWN = 8,
  CARPET = 9,
  CARPET_ALT = 10,
  METAL_FLOOR = 11,
  METAL_ALT = 12,
  WOOD_FLOOR = 13,
  GRASS = 14,
  GRASS_ALT = 15,
  RAILING = 16,
  WELCOME_MAT = 17,
  CABLE_FLOOR = 18,
  WINDOW = 19,
  PATH = 20,
}

export const enum FloorId {
  GROUND = 0,
  UPPER = 1,
  BASEMENT = 2,
  ROOFTOP = 3,
}

export const enum Direction {
  DOWN = 0,
  LEFT = 1,
  RIGHT = 2,
  UP = 3,
}

export type CharacterState =
  | "idle"
  | "walk"
  | "type"
  | "sleep"
  | "coffee"
  | "think";

export type CatState = "wander" | "sit" | "sleep" | "follow";

export type ParticleKind =
  | "steam"
  | "zzz"
  | "sparkle"
  | "rain"
  | "star"
  | "typingSpark"
  | "paper"
  | "knock"
  | "bird"
  | "cloud"
  | "coffeeSteam"
  | "music"
  | "achievement";

export type TimeOfDay = "sunrise" | "day" | "sunset" | "night";
export type WeatherKind = "clear" | "rain";
export type TransitionKind = "none" | "fadeOut" | "fadeIn";

export type FurnitureKind =
  | "desk"
  | "chair"
  | "monitor"
  | "plant"
  | "couch"
  | "table"
  | "coffeeMachine"
  | "fridge"
  | "microwave"
  | "printer"
  | "trashCan"
  | "waterCooler"
  | "bookshelf"
  | "serverRack"
  | "arcadeMachine"
  | "projector"
  | "whiteboard"
  | "tv"
  | "beanBag"
  | "bench"
  | "tree"
  | "antenna"
  | "solarPanel"
  | "birdBath"
  | "gardenBed"
  | "sink"
  | "fruitBowl"
  | "acUnit"
  | "cautionSign"
  | "secretDesk"
  | "pitaPoster"
  | "welcomeMat"
  | "rug"
  | "clock";

// ===== GBC POKEMON COLOR PALETTE ==========================================

export const GBC = {
  // Floor tiles
  floorLight: "#F8F8B0",
  floorDark: "#E0D890",
  // Walls
  wallBrown: "#A08858",
  wallLight: "#C8B078",
  wallDark: "#786040",
  wallEdge: "#584830",
  // Carpet
  carpetRed: "#A85858",
  carpetLight: "#C87878",
  // Tech / Metal
  metalLight: "#A8A8A8",
  metalMed: "#888888",
  metalDark: "#686868",
  metalVDark: "#404040",
  // Wood
  woodLight: "#C89050",
  woodMed: "#A07040",
  woodDark: "#785830",
  // Plants
  plantLight: "#60C060",
  plantMed: "#40A040",
  plantDark: "#208020",
  // Water / Glass
  waterLight: "#58A8F8",
  waterDark: "#3880C8",
  // UI / General
  black: "#000000",
  white: "#F8F8F8",
  cream: "#F8F0D0",
  gray: "#C0C0C0",
  // Sky colors
  skyDay: "#88C8F8",
  skySunrise: "#F8A870",
  skySunset: "#D87050",
  skyNight: "#182848",
  // Dialog
  dialogBg: "#F8F8F8",
  dialogBorder: "#404040",
  dialogText: "#282828",
  dialogShadow: "#C8C8C8",
  // Misc
  red: "#D03030",
  blue: "#3060C0",
  yellow: "#F8D830",
  orange: "#E08030",
  pink: "#E890A8",
  purple: "#8858A8",
  // Server LEDs
  ledGreen: "#40E840",
  ledRed: "#E84040",
  ledYellow: "#E8E840",
  ledOff: "#383838",
  // Rooftop
  skylineD: "#303050",
  skylineM: "#404868",
  skylineL: "#506080",
  roofGray: "#909090",
} as const;

// ===== SPRITE TYPES =======================================================

/** 2D array of hex color strings; "" = transparent */
export type SpriteData = string[][];

export interface CharacterPalette {
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
  shoes: string;
  accent: string;
}

export interface CharacterSpriteSet {
  down: [SpriteData, SpriteData, SpriteData]; // idle, walk1, walk2
  up: [SpriteData, SpriteData, SpriteData];
  left: [SpriteData, SpriteData, SpriteData];
  right: [SpriteData, SpriteData, SpriteData];
  type: [SpriteData, SpriteData];
  sleep: SpriteData;
}

export interface CatSpriteSet {
  down: [SpriteData, SpriteData];
  up: [SpriteData, SpriteData];
  left: [SpriteData, SpriteData];
  right: [SpriteData, SpriteData];
  sit: SpriteData;
  sleep: SpriteData;
}

// ===== TILEMAP TYPES ======================================================

export interface TilePos {
  col: number;
  row: number;
}

export interface DeskAssignment {
  pos: TilePos;       // desk furniture position
  seatCol: number;    // where the character sits
  seatRow: number;
  seatDir: Direction; // direction to face while seated
  assignedTo: string | null;
}

export interface FurnitureInstance {
  kind: FurnitureKind;
  col: number;
  row: number;
  w: number;  // width in tiles
  h: number;  // height in tiles
  sprite: SpriteData;
  zSortY: number;
  animated?: boolean;
  state?: string;
}

export interface FloorData {
  id: FloorId;
  name: string;
  tiles: TileType[][];       // [row][col]
  collision: boolean[][];    // [row][col] true=blocked
  furniture: FurnitureInstance[];
  desks: DeskAssignment[];
  stairsUp: TilePos | null;
  stairsDown: TilePos | null;
  coffeeMachine: TilePos | null;
  secretTiles: SpecialTile[];
}

export interface SpecialTile {
  pos: TilePos;
  kind: "secretDoor" | "achievement" | "arcade";
  data?: string;
}

// ===== CHARACTER TYPES ====================================================

export type AgentActivity = "typing" | "thinking" | "idle" | "sleeping" | "walking";

export interface OfficeAgent {
  id: string;
  name: string;
  emoji: string;
  status: "active" | "idle" | "unknown";
  activity: AgentActivity;
  currentTask: string | null;
  model?: string;
  totalTokens?: number;
  isSubagent?: boolean;
  parentId?: string;
}

export interface Character {
  id: string;
  name: string;
  emoji: string;
  isPlayer: boolean;
  isSubagent: boolean;

  // Visual
  palette: CharacterPalette;
  sprites: CharacterSpriteSet;

  // Position (game pixel coords within current floor)
  x: number;
  y: number;
  col: number;
  row: number;
  floor: FloorId;
  direction: Direction;

  // State
  state: CharacterState;
  targetActivity: AgentActivity;
  animFrame: number;
  animTimer: number;

  // Pathfinding
  path: TilePos[];
  pathIndex: number;
  moveProgress: number;

  // Behavior timers
  stateTimer: number;
  wanderCount: number;
  coffeeState: "none" | "going" | "brewing" | "returning";
  coffeeTimer: number;
  typingDuration: number;

  // Desk
  desk: DeskAssignment | null;
  deskIndex: number;

  // Agent info (from API)
  status: "active" | "idle" | "unknown";
  model: string;
  totalTokens: number;
  currentTask: string | null;

  // Sub-agent lifecycle
  parentId?: string;
  spawnTimer: number;
  despawnTimer: number;
}

export interface Cat {
  x: number;
  y: number;
  col: number;
  row: number;
  floor: FloorId;
  direction: Direction;
  state: CatState;
  sprites: CatSpriteSet;

  animFrame: number;
  animTimer: number;

  path: TilePos[];
  pathIndex: number;
  moveProgress: number;

  stateTimer: number;
  followTargetId: string | null;
  wanderCount: number;

  speechBubble: string;
  speechTimer: number;
}

// ===== DIALOG =============================================================

export interface DialogState {
  active: boolean;
  text: string;
  displayedChars: number;
  charTimer: number;
  speaker: string;
  speakerEmoji: string;
  finished: boolean;
}

// ===== PARTICLES ==========================================================

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  char?: string;
  floor: FloorId;
}

// ===== ENVIRONMENT ========================================================

export interface EnvironmentState {
  timeOfDay: TimeOfDay;
  hour: number;
  minute: number;
  weather: WeatherKind;
  weatherTimer: number;
  weatherDuration: number;
  nightAlpha: number;
}

// ===== TRANSITIONS ========================================================

export interface TransitionState {
  kind: TransitionKind;
  progress: number;
  targetFloor: FloorId | null;
  duration: number;
}

// ===== CAMERA =============================================================

export interface Camera {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  spectatorMode: boolean;
  spectatorTargetId: string | null;
  idleTimer: number;
}

// ===== SERVER / MONITOR ===================================================

export interface ServerLed {
  x: number;
  y: number;
  color: string;
  blinkRate: number;
  blinkTimer: number;
  on: boolean;
}

export interface MonitorAnim {
  deskIndex: number;
  activity: AgentActivity | "off";
  scrollOffset: number;
  cursorBlink: boolean;
  cursorTimer: number;
  bounceX: number;
  bounceY: number;
  bounceDx: number;
  bounceDy: number;
}

// ===== GAME STATE =========================================================

export interface GameState {
  currentFloor: FloorId;
  characters: Character[];
  player: Character;
  cat: Cat;
  camera: Camera;
  dialog: DialogState;
  environment: EnvironmentState;
  transition: TransitionState;
  particles: Particle[];
  serverLeds: ServerLed[];
  monitors: MonitorAnim[];
  achievements: Set<string>;
  frame: number;
  time: number;
}

// ===== RENDER ENTITY (for z-sorting) ======================================

export interface RenderEntity {
  kind: "furniture" | "character" | "cat";
  zSortY: number;
  id: string;
  draw: (ctx: CanvasRenderingContext2D, camX: number, camY: number) => void;
}
