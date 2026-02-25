// ---------------------------------------------------------------------------
// Pixel Office V3 -- Pokemon Red Edition -- Character Logic
// ---------------------------------------------------------------------------
// Handles player (GK), NPC agents (Donna, Jarvis), sub-agents, office cat,
// and all their behaviors. Grid-based movement with smooth interpolation,
// NPC state machines, and cat AI.
// ---------------------------------------------------------------------------

import type {
  Character,
  Cat,
  CharacterPalette,
  CharacterSpriteSet,
  CatSpriteSet,
  TilePos,
  FloorData,
  OfficeAgent,
  AgentActivity,
  DeskAssignment,
  DialogState,
} from "./types";
import {
  Direction,
  FloorId,
  TILE_SIZE,
  WALK_SPEED,
  CAT_WALK_SPEED,
  PLAYER_WALK_SPEED,
  ANIM_FRAME_DURATION,
  TYPE_FRAME_DURATION,
  CAT_ANIM_DURATION,
} from "./types";
import {
  buildCharacterSprites,
  buildCatSprites,
  lightenPalette,
  GK_PALETTE,
  DONNA_PALETTE,
  JARVIS_PALETTE,
  SUB_AGENT_PALETTES,
} from "./sprites";
import { findPath, isWalkable, getRandomWalkableTile } from "./tilemap";

// ===== Input State ===========================================================

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  interact: boolean; // SPACE or ENTER
}

export function createInputState(): InputState {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    interact: false,
  };
}

// ===== Palette Selection =====================================================

function getPaletteForAgent(agent: OfficeAgent, deskIndex: number): CharacterPalette {
  if (agent.isSubagent) {
    const baseIndex = deskIndex % SUB_AGENT_PALETTES.length;
    return lightenPalette(SUB_AGENT_PALETTES[baseIndex], 20);
  }

  // Main agents by name
  const nameLower = agent.name.toLowerCase();
  if (nameLower === "gk" || agent.id === "player") {
    return GK_PALETTE;
  }
  if (nameLower.includes("donna")) {
    return DONNA_PALETTE;
  }
  if (nameLower.includes("jarvis")) {
    return JARVIS_PALETTE;
  }

  // Fallback: rotate through sub-agent palettes
  return SUB_AGENT_PALETTES[deskIndex % SUB_AGENT_PALETTES.length];
}

// ===== Activity -> State Mapping =============================================

function activityToState(activity: AgentActivity): "type" | "think" | "idle" | "sleep" {
  switch (activity) {
    case "typing":
      return "type";
    case "thinking":
      return "think";
    case "idle":
    case "walking":
      return "idle";
    case "sleeping":
      return "sleep";
  }
}

// ===== Character Creation ====================================================

export function createPlayer(floor: FloorId): Character {
  const palette = GK_PALETTE;
  const sprites = buildCharacterSprites(palette);

  // Player spawns at a sensible starting position
  const startCol = 14;
  const startRow = 18;

  return {
    id: "player",
    name: "GK",
    emoji: "\u{1F468}\u{200D}\u{1F4BB}",
    isPlayer: true,
    isSubagent: false,
    palette,
    sprites,
    x: startCol * TILE_SIZE,
    y: startRow * TILE_SIZE,
    col: startCol,
    row: startRow,
    floor,
    direction: Direction.DOWN,
    state: "idle",
    targetActivity: "idle",
    animFrame: 0,
    animTimer: 0,
    path: [],
    pathIndex: 0,
    moveProgress: 0,
    stateTimer: 0,
    wanderCount: 0,
    coffeeState: "none",
    coffeeTimer: 0,
    typingDuration: 0,
    desk: null,
    deskIndex: -1,
    status: "active",
    model: "",
    totalTokens: 0,
    currentTask: null,
    spawnTimer: 0,
    despawnTimer: 0,
  };
}

export function createCharacter(
  agent: OfficeAgent,
  desk: DeskAssignment | null,
  deskIndex: number,
  floor: FloorId,
): Character {
  const palette = getPaletteForAgent(agent, deskIndex);
  const sprites = buildCharacterSprites(palette);

  const startCol = desk ? desk.seatCol : 15;
  const startRow = desk ? desk.seatRow : 10;

  return {
    id: agent.id,
    name: agent.name,
    emoji: agent.emoji,
    isPlayer: false,
    isSubagent: agent.isSubagent ?? false,
    palette,
    sprites,
    x: startCol * TILE_SIZE,
    y: startRow * TILE_SIZE,
    col: startCol,
    row: startRow,
    floor,
    direction: desk ? desk.seatDir : Direction.DOWN,
    state: activityToState(agent.activity),
    targetActivity: agent.activity,
    animFrame: 0,
    animTimer: 0,
    path: [],
    pathIndex: 0,
    moveProgress: 0,
    stateTimer: 0,
    wanderCount: 0,
    coffeeState: "none",
    coffeeTimer: 0,
    typingDuration: 0,
    desk,
    deskIndex,
    status: agent.status,
    model: agent.model ?? "",
    totalTokens: agent.totalTokens ?? 0,
    currentTask: agent.currentTask,
    parentId: agent.parentId,
    spawnTimer: 0,
    despawnTimer: 0,
  };
}

export function createCat(floor: FloorId): Cat {
  const sprites = buildCatSprites();
  const startCol = 10;
  const startRow = 12;

  return {
    x: startCol * TILE_SIZE,
    y: startRow * TILE_SIZE,
    col: startCol,
    row: startRow,
    floor,
    direction: Direction.RIGHT,
    state: "wander",
    sprites,
    animFrame: 0,
    animTimer: 0,
    path: [],
    pathIndex: 0,
    moveProgress: 0,
    stateTimer: 3 + Math.random() * 5,
    followTargetId: null,
    wanderCount: 0,
    speechBubble: "",
    speechTimer: 0,
  };
}

// ===== Direction Helpers =====================================================

export function faceDirection(
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
): Direction {
  const dx = toCol - fromCol;
  const dy = toRow - fromRow;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Direction.RIGHT : Direction.LEFT;
  }
  if (dy > 0) return Direction.DOWN;
  if (dy < 0) return Direction.UP;
  return Direction.DOWN;
}

/** Snap pixel position to tile grid */
function snapToTile(entity: { x: number; y: number; col: number; row: number }): void {
  entity.x = entity.col * TILE_SIZE;
  entity.y = entity.row * TILE_SIZE;
}

// ===== Movement Along Path ===================================================

/**
 * Moves an entity along its path with smooth interpolation.
 * Returns true when the entire path is complete.
 * Mutates the entity in place.
 */
export function moveAlongPath(
  entity: {
    x: number;
    y: number;
    col: number;
    row: number;
    path: TilePos[];
    pathIndex: number;
    moveProgress: number;
    direction: Direction;
    animFrame: number;
    animTimer: number;
  },
  speed: number,
  dt: number,
): boolean {
  if (entity.path.length === 0 || entity.pathIndex >= entity.path.length) {
    return true;
  }

  const target = entity.path[entity.pathIndex];

  // Face toward the next tile
  if (target.col !== entity.col || target.row !== entity.row) {
    entity.direction = faceDirection(entity.col, entity.row, target.col, target.row);
  }

  // Calculate interpolation
  const startX = entity.col * TILE_SIZE;
  const startY = entity.row * TILE_SIZE;
  const targetX = target.col * TILE_SIZE;
  const targetY = target.row * TILE_SIZE;

  // Advance move progress based on speed
  // Speed is in px/s, one tile is TILE_SIZE px
  const progressPerSecond = speed / TILE_SIZE;
  entity.moveProgress += progressPerSecond * dt;

  // Walk animation
  entity.animTimer += dt;
  if (entity.animTimer >= ANIM_FRAME_DURATION) {
    entity.animTimer -= ANIM_FRAME_DURATION;
    entity.animFrame = (entity.animFrame + 1) % 2;
  }

  if (entity.moveProgress >= 1) {
    // Arrived at this tile
    entity.col = target.col;
    entity.row = target.row;
    entity.x = targetX;
    entity.y = targetY;
    entity.moveProgress = 0;
    entity.pathIndex++;

    // Check if path is complete
    if (entity.pathIndex >= entity.path.length) {
      entity.path = [];
      entity.pathIndex = 0;
      return true;
    }

    return false;
  }

  // Smooth interpolation between current tile and target tile
  entity.x = startX + (targetX - startX) * entity.moveProgress;
  entity.y = startY + (targetY - startY) * entity.moveProgress;

  return false;
}

// ===== Player Update =========================================================

/**
 * Process player input and update the player character.
 * Returns true if the player initiated an interaction (pressed interact key).
 */
export function updatePlayer(
  player: Character,
  input: InputState,
  floor: FloorData,
  dt: number,
): boolean {
  // If currently moving between tiles, continue the movement
  if (player.moveProgress > 0) {
    const done = moveAlongPath(player, PLAYER_WALK_SPEED, dt);
    if (done) {
      player.state = "idle";
      player.animFrame = 0;
    }
    // Consume interact during movement
    if (input.interact) {
      input.interact = false;
      return true;
    }
    return false;
  }

  // Determine desired direction from input
  let targetCol = player.col;
  let targetRow = player.row;
  let hasInput = false;

  if (input.up) {
    targetRow--;
    player.direction = Direction.UP;
    hasInput = true;
  } else if (input.down) {
    targetRow++;
    player.direction = Direction.DOWN;
    hasInput = true;
  } else if (input.left) {
    targetCol--;
    player.direction = Direction.LEFT;
    hasInput = true;
  } else if (input.right) {
    targetCol++;
    player.direction = Direction.RIGHT;
    hasInput = true;
  }

  if (hasInput) {
    // Check if the target tile is walkable
    if (isWalkable(floor, targetCol, targetRow)) {
      player.path = [{ col: targetCol, row: targetRow }];
      player.pathIndex = 0;
      player.moveProgress = 0;
      player.state = "walk";
    }
    // Even if blocked, direction changed (already set above)
  } else {
    // No input -- idle
    if (player.state === "walk") {
      player.state = "idle";
      player.animFrame = 0;
    }
  }

  // Check interact
  if (input.interact) {
    input.interact = false;
    return true;
  }

  return false;
}

// ===== NPC Character Update ==================================================

export function updateCharacter(
  char: Character,
  floor: FloorData,
  dt: number,
  allCharacters: Character[],
): void {
  char.stateTimer += dt;

  // Update animation timer based on state
  const frameDuration = char.state === "type" || char.state === "think"
    ? TYPE_FRAME_DURATION
    : ANIM_FRAME_DURATION;

  char.animTimer += dt;
  if (char.animTimer >= frameDuration) {
    char.animTimer -= frameDuration;
    char.animFrame = (char.animFrame + 1) % 2;
  }

  switch (char.state) {
    case "type":
      updateNpcType(char, floor, dt);
      break;
    case "think":
      updateNpcThink(char, floor, dt);
      break;
    case "sleep":
      updateNpcSleep(char);
      break;
    case "idle":
      updateNpcIdle(char, floor, dt);
      break;
    case "walk":
      updateNpcWalk(char, floor, dt);
      break;
    case "coffee":
      updateNpcCoffee(char, floor, dt);
      break;
  }
}

// ----- NPC State Handlers ----------------------------------------------------

function updateNpcType(char: Character, floor: FloorData, dt: number): void {
  char.typingDuration += dt;

  // Stay at desk, face desk direction
  if (char.desk) {
    char.direction = char.desk.seatDir;
    snapToDesk(char);
  }

  // Check for activity changes from API
  if (char.targetActivity === "idle" || char.targetActivity === "walking") {
    char.state = "idle";
    char.stateTimer = 0;
    char.typingDuration = 0;
    return;
  }
  if (char.targetActivity === "sleeping") {
    char.state = "sleep";
    char.stateTimer = 0;
    char.typingDuration = 0;
    return;
  }
  if (char.targetActivity === "thinking") {
    char.state = "think";
    char.stateTimer = 0;
    return;
  }

  // Coffee run: after 60+ seconds typing, check every 5 seconds with 20% chance
  char.coffeeTimer += dt;
  if (char.typingDuration > 60 && char.coffeeTimer >= 5) {
    char.coffeeTimer = 0;
    if (Math.random() < 0.2) {
      startCoffeeRun(char, floor);
    }
  }
}

function updateNpcThink(char: Character, floor: FloorData, dt: number): void {
  char.typingDuration += dt;

  // Stay at desk, face desk direction
  if (char.desk) {
    char.direction = char.desk.seatDir;
    snapToDesk(char);
  }

  // Check for activity changes from API
  if (char.targetActivity === "typing") {
    char.state = "type";
    char.stateTimer = 0;
    return;
  }
  if (char.targetActivity === "idle" || char.targetActivity === "walking") {
    char.state = "idle";
    char.stateTimer = 0;
    char.typingDuration = 0;
    return;
  }
  if (char.targetActivity === "sleeping") {
    char.state = "sleep";
    char.stateTimer = 0;
    char.typingDuration = 0;
    return;
  }

  // Coffee run (same as typing but less frequent -- longer think sessions)
  char.coffeeTimer += dt;
  if (char.typingDuration > 60 && char.coffeeTimer >= 5) {
    char.coffeeTimer = 0;
    if (Math.random() < 0.2) {
      startCoffeeRun(char, floor);
    }
  }
}

function updateNpcSleep(char: Character): void {
  // Stay at desk
  if (char.desk) {
    snapToDesk(char);
  }

  // Wake up if activity changes
  if (char.targetActivity !== "sleeping") {
    char.state = activityToState(char.targetActivity);
    char.stateTimer = 0;
  }
}

function updateNpcIdle(char: Character, floor: FloorData, dt: number): void {
  // If API says agent should type or think, walk back to desk first
  if (char.targetActivity === "typing" || char.targetActivity === "thinking") {
    if (char.desk) {
      const path = findPath(
        floor,
        char.col,
        char.row,
        char.desk.seatCol,
        char.desk.seatRow,
      );
      if (path.length > 0) {
        char.path = path;
        char.pathIndex = 0;
        char.moveProgress = 0;
        char.state = "walk";
        char.stateTimer = 0;
        return;
      }
      // If no path found, just snap to desk
      char.col = char.desk.seatCol;
      char.row = char.desk.seatRow;
      snapToTile(char);
    }
    char.state = activityToState(char.targetActivity);
    char.stateTimer = 0;
    return;
  }

  if (char.targetActivity === "sleeping") {
    char.state = "sleep";
    char.stateTimer = 0;
    return;
  }

  // Wandering behavior: every 5-15 seconds, pick a new destination
  const wanderThreshold = 5 + (char.stateTimer === 0 ? Math.random() * 10 : 0);
  if (char.stateTimer > wanderThreshold) {
    char.wanderCount++;

    // After 3-6 wanders, return to desk for a rest
    if (char.wanderCount > 3 + Math.floor(Math.random() * 4)) {
      if (char.desk) {
        const path = findPath(
          floor,
          char.col,
          char.row,
          char.desk.seatCol,
          char.desk.seatRow,
        );
        if (path.length > 0) {
          char.path = path;
          char.pathIndex = 0;
          char.moveProgress = 0;
          char.state = "walk";
          char.stateTimer = 0;
          char.wanderCount = 0;
          return;
        }
      }
      char.wanderCount = 0;
      char.stateTimer = 0;
      return;
    }

    // Pick a random walkable tile to wander to
    const target = getRandomWalkableTile(floor);
    const path = findPath(floor, char.col, char.row, target.col, target.row);
    if (path.length > 0 && path.length < 30) {
      char.path = path;
      char.pathIndex = 0;
      char.moveProgress = 0;
      char.state = "walk";
      char.stateTimer = 0;
    } else {
      // Couldn't find a good path, reset timer and try again
      char.stateTimer = 0;
    }
  }
}

function updateNpcWalk(char: Character, floor: FloorData, dt: number): void {
  const done = moveAlongPath(char, WALK_SPEED, dt);
  if (done) {
    finishNpcWalk(char, floor);
  }
}

function finishNpcWalk(char: Character, floor: FloorData): void {
  // If coffee run in progress
  if (char.coffeeState === "going") {
    char.state = "coffee";
    char.coffeeState = "brewing";
    char.stateTimer = 0;
    char.direction = Direction.UP;
    return;
  }

  if (char.coffeeState === "returning") {
    char.state = "type";
    char.coffeeState = "none";
    char.stateTimer = 0;
    char.typingDuration = 0;
    if (char.desk) {
      char.direction = char.desk.seatDir;
    }
    return;
  }

  // If activity says type/think and we're at desk, start working
  if (
    (char.targetActivity === "typing" || char.targetActivity === "thinking") &&
    char.desk &&
    char.col === char.desk.seatCol &&
    char.row === char.desk.seatRow
  ) {
    char.state = activityToState(char.targetActivity);
    char.stateTimer = 0;
    char.direction = char.desk.seatDir;
    return;
  }

  // Default: idle
  char.state = "idle";
  char.stateTimer = 0;
}

function updateNpcCoffee(char: Character, floor: FloorData, dt: number): void {
  // In coffee state, we're standing at the machine brewing
  if (char.coffeeState === "brewing") {
    char.direction = Direction.UP;
    if (char.stateTimer > 3) {
      // Done brewing, return to desk
      if (char.desk) {
        const path = findPath(
          floor,
          char.col,
          char.row,
          char.desk.seatCol,
          char.desk.seatRow,
        );
        if (path.length > 0) {
          char.path = path;
          char.pathIndex = 0;
          char.moveProgress = 0;
          char.coffeeState = "returning";
          char.state = "walk";
          char.stateTimer = 0;
          return;
        }
      }
      // Couldn't pathfind back, just snap
      if (char.desk) {
        char.col = char.desk.seatCol;
        char.row = char.desk.seatRow;
        snapToTile(char);
      }
      char.state = "type";
      char.coffeeState = "none";
      char.stateTimer = 0;
      char.typingDuration = 0;
    }
  }
}

function startCoffeeRun(char: Character, floor: FloorData): void {
  if (!floor.coffeeMachine) return;

  const coffeePos = floor.coffeeMachine;
  const path = findPath(floor, char.col, char.row, coffeePos.col, coffeePos.row);
  if (path.length > 0) {
    char.path = path;
    char.pathIndex = 0;
    char.moveProgress = 0;
    char.coffeeState = "going";
    char.state = "walk";
    char.stateTimer = 0;
  }
}

function snapToDesk(char: Character): void {
  if (!char.desk) return;
  char.col = char.desk.seatCol;
  char.row = char.desk.seatRow;
  snapToTile(char);
}

// ===== Cat Update ============================================================

export function updateCat(
  cat: Cat,
  floor: FloorData,
  dt: number,
  characters: Character[],
  player: Character,
): void {
  // Update animation
  cat.animTimer += dt;
  if (cat.animTimer >= CAT_ANIM_DURATION) {
    cat.animTimer -= CAT_ANIM_DURATION;
    cat.animFrame = (cat.animFrame + 1) % 2;
  }

  // Update speech bubble timer
  if (cat.speechTimer > 0) {
    cat.speechTimer -= dt;
    if (cat.speechTimer <= 0) {
      cat.speechBubble = "";
      cat.speechTimer = 0;
    }
  }

  // State machine
  switch (cat.state) {
    case "wander":
      updateCatWander(cat, floor, dt, characters);
      break;
    case "sit":
      updateCatSit(cat, dt);
      break;
    case "sleep":
      updateCatSleep(cat, floor, dt);
      break;
    case "follow":
      updateCatFollow(cat, floor, dt, characters);
      break;
  }

  // Meow when player gets within 2 tiles
  if (cat.speechTimer <= 0 && cat.floor === player.floor) {
    const dx = Math.abs(cat.col - player.col);
    const dy = Math.abs(cat.row - player.row);
    if (dx + dy <= 2) {
      cat.speechBubble = "Meow!";
      cat.speechTimer = 2.0;
    }
  }
}

function updateCatWander(
  cat: Cat,
  floor: FloorData,
  dt: number,
  characters: Character[],
): void {
  // If we have a path, walk along it
  if (cat.path.length > 0 && cat.pathIndex < cat.path.length) {
    const done = moveAlongPath(cat, CAT_WALK_SPEED, dt);
    if (done) {
      pickNextCatAction(cat, floor, characters);
    }
    return;
  }

  // Waiting at destination, count down
  cat.stateTimer -= dt;
  if (cat.stateTimer <= 0) {
    pickNextCatAction(cat, floor, characters);
  }
}

function pickNextCatAction(
  cat: Cat,
  floor: FloorData,
  characters: Character[],
): void {
  const roll = Math.random();

  if (roll < 0.10) {
    // Sit down
    cat.state = "sit";
    cat.stateTimer = 5 + Math.random() * 5;
    return;
  }

  if (roll < 0.20 && characters.length > 0) {
    // Follow a random character
    const target = characters[Math.floor(Math.random() * characters.length)];
    cat.state = "follow";
    cat.followTargetId = target.id;
    cat.stateTimer = 10 + Math.random() * 10;
    return;
  }

  if (roll < 0.25) {
    // Try to find a couch/comfortable spot to sleep
    const couchTarget = findCouchTile(floor);
    if (couchTarget) {
      const path = findPath(floor, cat.col, cat.row, couchTarget.col, couchTarget.row);
      if (path.length > 0) {
        cat.path = path;
        cat.pathIndex = 0;
        cat.moveProgress = 0;
        cat.state = "sleep";
        cat.stateTimer = 20 + Math.random() * 20;
        return;
      }
    }
  }

  // Default: wander to a random tile
  const target = getRandomWalkableTile(floor);
  const path = findPath(floor, cat.col, cat.row, target.col, target.row);
  if (path.length > 0 && path.length < 40) {
    cat.path = path;
    cat.pathIndex = 0;
    cat.moveProgress = 0;
  }
  cat.stateTimer = 3 + Math.random() * 5;
}

function updateCatSit(cat: Cat, dt: number): void {
  cat.stateTimer -= dt;
  if (cat.stateTimer <= 0) {
    cat.state = "wander";
    cat.stateTimer = 2 + Math.random() * 3;
  }
}

function updateCatSleep(cat: Cat, floor: FloorData, dt: number): void {
  // If still walking to sleep spot
  if (cat.path.length > 0 && cat.pathIndex < cat.path.length) {
    moveAlongPath(cat, CAT_WALK_SPEED, dt);
    return;
  }

  // Sleeping at destination
  cat.stateTimer -= dt;
  if (cat.stateTimer <= 0) {
    cat.state = "wander";
    cat.stateTimer = 3 + Math.random() * 5;
  }
}

function updateCatFollow(
  cat: Cat,
  floor: FloorData,
  dt: number,
  characters: Character[],
): void {
  cat.stateTimer -= dt;
  if (cat.stateTimer <= 0) {
    cat.state = "wander";
    cat.followTargetId = null;
    cat.stateTimer = 3 + Math.random() * 3;
    return;
  }

  // Find the target character
  const target = characters.find((c) => c.id === cat.followTargetId);
  if (!target || target.floor !== cat.floor) {
    cat.state = "wander";
    cat.followTargetId = null;
    cat.stateTimer = 3;
    return;
  }

  // Walk along current path
  if (cat.path.length > 0 && cat.pathIndex < cat.path.length) {
    moveAlongPath(cat, CAT_WALK_SPEED, dt);
    return;
  }

  // Recalculate path: follow 1 tile behind the target (opposite their facing)
  const behindCol = target.col + directionToDelta(target.direction).dc * -1;
  const behindRow = target.row + directionToDelta(target.direction).dr * -1;

  // Only pathfind if the target is far enough away
  const dx = Math.abs(cat.col - target.col);
  const dy = Math.abs(cat.row - target.row);
  if (dx + dy > 1) {
    const goalCol = isWalkable(floor, behindCol, behindRow) ? behindCol : target.col;
    const goalRow = isWalkable(floor, behindCol, behindRow) ? behindRow : target.row;
    const path = findPath(floor, cat.col, cat.row, goalCol, goalRow);
    if (path.length > 0) {
      cat.path = path;
      cat.pathIndex = 0;
      cat.moveProgress = 0;
    }
  }
}

function directionToDelta(dir: Direction): { dc: number; dr: number } {
  switch (dir) {
    case Direction.UP:
      return { dc: 0, dr: -1 };
    case Direction.DOWN:
      return { dc: 0, dr: 1 };
    case Direction.LEFT:
      return { dc: -1, dr: 0 };
    case Direction.RIGHT:
      return { dc: 1, dr: 0 };
  }
}

/**
 * Finds a walkable tile adjacent to a couch furniture piece.
 * Returns null if no couch is found on the floor.
 */
function findCouchTile(floor: FloorData): TilePos | null {
  for (const furn of floor.furniture) {
    if (furn.kind === "couch" || furn.kind === "beanBag") {
      // Check tiles adjacent to the furniture for a walkable spot
      const candidates: TilePos[] = [
        { col: furn.col, row: furn.row + furn.h },     // below
        { col: furn.col + furn.w, row: furn.row },      // right
        { col: furn.col - 1, row: furn.row },            // left
        { col: furn.col, row: furn.row - 1 },            // above
      ];
      for (const c of candidates) {
        if (isWalkable(floor, c.col, c.row)) {
          return c;
        }
      }
    }
  }
  return null;
}

// ===== Agent Sync ============================================================

export function syncCharacterWithAgent(char: Character, agent: OfficeAgent): void {
  char.status = agent.status;
  char.currentTask = agent.currentTask;
  char.model = agent.model ?? "";
  char.totalTokens = agent.totalTokens ?? 0;
  char.targetActivity = agent.activity;
}

// ===== Interaction Detection =================================================

/**
 * Get the nearest interactable entity to the player, within 1 tile
 * in the direction the player is facing.
 */
export function getNearestInteractable(
  player: Character,
  characters: Character[],
  cat: Cat,
): { type: "character"; target: Character } | { type: "cat"; target: Cat } | null {
  const delta = directionToDelta(player.direction);
  const facingCol = player.col + delta.dc;
  const facingRow = player.row + delta.dr;

  // Check characters at the tile the player is facing
  let nearestChar: Character | null = null;
  let nearestDist = Infinity;

  for (const ch of characters) {
    if (ch.isPlayer || ch.floor !== player.floor) continue;
    const dx = Math.abs(ch.col - facingCol);
    const dy = Math.abs(ch.row - facingRow);
    if (dx === 0 && dy === 0) {
      const dist = Math.abs(ch.col - player.col) + Math.abs(ch.row - player.row);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestChar = ch;
      }
    }
  }

  // Check cat at facing tile
  if (
    cat.floor === player.floor &&
    cat.col === facingCol &&
    cat.row === facingRow
  ) {
    const catDist = Math.abs(cat.col - player.col) + Math.abs(cat.row - player.row);
    if (catDist < nearestDist) {
      return { type: "cat", target: cat };
    }
  }

  if (nearestChar) {
    return { type: "character", target: nearestChar };
  }

  // Also check if player is standing on the same tile as someone (for adjacent tiles)
  for (const ch of characters) {
    if (ch.isPlayer || ch.floor !== player.floor) continue;
    const dx = Math.abs(ch.col - player.col);
    const dy = Math.abs(ch.row - player.row);
    if (dx + dy <= 1 && dx + dy > 0) {
      return { type: "character", target: ch };
    }
  }

  if (cat.floor === player.floor) {
    const catDx = Math.abs(cat.col - player.col);
    const catDy = Math.abs(cat.row - player.row);
    if (catDx + catDy <= 1 && catDx + catDy > 0) {
      return { type: "cat", target: cat };
    }
  }

  return null;
}
