// ---------------------------------------------------------------------------
// Pixel Office V2 — Character State Machine & AI Behaviors
// ---------------------------------------------------------------------------

import type {
  Character,
  CharacterState,
  Direction,
  TilePos,
  OfficeAgent,
  DeskAssignment,
  AgentActivity,
  Cat,
  CatState,
} from "./types";
import { TILE_SIZE, WALK_SPEED, CAT_WALK_SPEED, ANIM_FRAME_DURATION } from "./types";
import { getPalette, lightenPalette, buildCharacterSprites } from "./sprites";
import { findPath, getCoffeeMachinePos, getRandomWalkableTile, getRandomWalkableTileAnywhere, getCouchPos } from "./tilemap";

// ---------------------------------------------------------------------------
// Character Creation
// ---------------------------------------------------------------------------

export function createCharacter(
  agent: OfficeAgent,
  desk: DeskAssignment | null,
  deskIndex: number,
  agentIndex: number,
): Character {
  const palette = agent.isSubagent
    ? lightenPalette(getPalette(agent.parentId ?? agent.id, agentIndex))
    : getPalette(agent.id, agentIndex);

  const startCol = desk ? desk.chairCol : 21;
  const startRow = desk ? desk.chairRow : 5;

  return {
    id: agent.id,
    name: agent.name,
    emoji: agent.emoji,
    status: agent.status,
    model: agent.model,
    totalTokens: agent.totalTokens,
    currentTask: agent.currentTask,
    palette,
    sprites: buildCharacterSprites(palette),
    isSubagent: agent.isSubagent ?? false,
    x: startCol * TILE_SIZE,
    y: startRow * TILE_SIZE,
    col: startCol,
    row: startRow,
    direction: "down",
    state: activityToState(agent.activity),
    targetActivity: agent.activity,
    animFrame: 0,
    animTimer: 0,
    path: [],
    pathIndex: 0,
    moveProgress: 0,
    stateTimer: 0,
    wanderCount: 0,
    coffeeTimer: 0,
    typingDuration: 0,
    desk,
    deskIndex,
    parentId: agent.parentId,
    spawnTimer: 0,
    despawnTimer: 0,
  };
}

function activityToState(activity: AgentActivity): CharacterState {
  switch (activity) {
    case "typing":
    case "thinking":
      return "type";
    case "idle":
    case "walking":
      return "idle";
    case "sleeping":
      return "sleep";
  }
}

// ---------------------------------------------------------------------------
// Character Update
// ---------------------------------------------------------------------------

export function updateCharacter(
  char: Character,
  dt: number,
  walkable: boolean[][],
): void {
  // Update animation timer
  char.animTimer += dt;
  if (char.animTimer >= ANIM_FRAME_DURATION) {
    char.animTimer -= ANIM_FRAME_DURATION;
    char.animFrame = (char.animFrame + 1) % 2;
  }

  // State-specific update
  switch (char.state) {
    case "type":
      updateTyping(char, dt, walkable);
      break;
    case "sleep":
      updateSleeping(char, dt);
      break;
    case "idle":
      updateIdle(char, dt, walkable);
      break;
    case "walk":
      updateWalking(char, dt);
      break;
    case "coffee":
      updateCoffee(char, dt, walkable);
      break;
  }
}

// ---------------------------------------------------------------------------
// State Updates
// ---------------------------------------------------------------------------

function updateTyping(char: Character, dt: number, walkable: boolean[][]): void {
  char.typingDuration += dt;
  char.stateTimer += dt;

  // If API says agent is no longer typing, transition
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

  // Coffee run: after typing 60+ seconds, 20% chance per 5-second check
  char.coffeeTimer += dt;
  if (char.typingDuration > 60 && char.coffeeTimer >= 5) {
    char.coffeeTimer = 0;
    if (Math.random() < 0.2) {
      startCoffeeRun(char, walkable);
    }
  }

  // Stay at desk, face the monitor
  if (char.desk) {
    char.direction = "up";
    goToTile(char, char.desk.chairCol, char.desk.chairRow);
  }
}

function updateSleeping(char: Character, dt: number): void {
  char.stateTimer += dt;

  // If API says agent woke up
  if (char.targetActivity !== "sleeping") {
    char.state = activityToState(char.targetActivity);
    char.stateTimer = 0;
  }

  // Stay at desk
  if (char.desk) {
    goToTile(char, char.desk.chairCol, char.desk.chairRow);
  }
}

function updateIdle(char: Character, dt: number, walkable: boolean[][]): void {
  char.stateTimer += dt;

  // If API says agent should type
  if (char.targetActivity === "typing" || char.targetActivity === "thinking") {
    if (char.desk) {
      // Walk back to desk first
      const path = findPath(char.col, char.row, char.desk.chairCol, char.desk.chairRow, walkable);
      if (path.length > 0) {
        char.path = path;
        char.pathIndex = 0;
        char.moveProgress = 0;
        char.state = "walk";
        char.stateTimer = 0;
        // After reaching desk, the walk update will transition to type
        return;
      }
    }
    char.state = "type";
    char.stateTimer = 0;
    return;
  }

  if (char.targetActivity === "sleeping") {
    char.state = "sleep";
    char.stateTimer = 0;
    return;
  }

  // Wandering behavior
  if (char.stateTimer > 3 + Math.random() * 5) {
    char.wanderCount++;

    // After 3-6 wanders, return to desk for 30-60 seconds
    if (char.wanderCount > 3 + Math.floor(Math.random() * 4)) {
      if (char.desk) {
        const path = findPath(char.col, char.row, char.desk.chairCol, char.desk.chairRow, walkable);
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
    }

    // Pick a random walkable tile to wander to
    const target = getRandomWalkableTile(walkable, 1, 1, 20, 12);
    if (target) {
      const path = findPath(char.col, char.row, target.col, target.row, walkable);
      if (path.length > 0 && path.length < 30) {
        char.path = path;
        char.pathIndex = 0;
        char.moveProgress = 0;
        char.state = "walk";
        char.stateTimer = 0;
      }
    }
  }
}

function updateWalking(char: Character, dt: number): void {
  if (char.path.length === 0 || char.pathIndex >= char.path.length) {
    // Reached destination
    finishWalking(char);
    return;
  }

  const target = char.path[char.pathIndex];
  const targetX = target.col * TILE_SIZE;
  const targetY = target.row * TILE_SIZE;

  // Calculate direction
  const dx = targetX - char.x;
  const dy = targetY - char.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    char.direction = dx > 0 ? "right" : "left";
  } else {
    char.direction = dy > 0 ? "down" : "up";
  }

  // Move toward target
  const moveAmount = WALK_SPEED * dt;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= moveAmount) {
    char.x = targetX;
    char.y = targetY;
    char.col = target.col;
    char.row = target.row;
    char.pathIndex++;
  } else {
    const ratio = moveAmount / dist;
    char.x += dx * ratio;
    char.y += dy * ratio;
  }
}

// Coffee run internal flags stored on the character via type assertion
type CoffeeCharacter = Character & {
  _coffeePhase?: "going" | "brewing" | "returning";
  _coffeeReturning?: boolean;
  _brewTimer?: number;
};

function finishWalking(char: Character): void {
  // If target activity is typing and we're at desk, start typing
  if (
    (char.targetActivity === "typing" || char.targetActivity === "thinking") &&
    char.desk &&
    char.col === char.desk.chairCol &&
    char.row === char.desk.chairRow
  ) {
    char.state = "type";
    char.stateTimer = 0;
    char.direction = "up";
    return;
  }

  // If we returned from coffee
  const cc = char as CoffeeCharacter;
  if (char.state === "walk" && cc._coffeeReturning) {
    char.state = "type";
    char.stateTimer = 0;
    char.typingDuration = 0;
    char.direction = "up";
    cc._coffeeReturning = false;
    return;
  }

  // Default: go to idle and stand around
  char.state = "idle";
  char.stateTimer = 0;
}

function updateCoffee(char: Character, dt: number, walkable: boolean[][]): void {
  const cc = char as CoffeeCharacter;

  if (!cc._coffeePhase) {
    cc._coffeePhase = "going";
  }

  switch (cc._coffeePhase) {
    case "going": {
      // Walk to coffee machine
      if (char.path.length === 0 || char.pathIndex >= char.path.length) {
        // Arrived at coffee machine
        cc._coffeePhase = "brewing";
        cc._brewTimer = 3;
        char.direction = "up";
      } else {
        updateWalking(char, dt);
        // Keep state as coffee, not walk
        char.state = "coffee";
      }
      break;
    }
    case "brewing": {
      cc._brewTimer = (cc._brewTimer ?? 3) - dt;
      if ((cc._brewTimer ?? 0) <= 0) {
        // Done brewing, walk back to desk
        cc._coffeePhase = "returning";
        cc._coffeeReturning = true;
        if (char.desk) {
          const path = findPath(
            char.col,
            char.row,
            char.desk.chairCol,
            char.desk.chairRow,
            walkable,
          );
          char.path = path;
          char.pathIndex = 0;
          char.moveProgress = 0;
        }
      }
      break;
    }
    case "returning": {
      if (char.path.length === 0 || char.pathIndex >= char.path.length) {
        // Back at desk
        char.state = "type";
        char.stateTimer = 0;
        char.typingDuration = 0;
        char.direction = "up";
        cc._coffeePhase = undefined;
        cc._coffeeReturning = false;
      } else {
        updateWalking(char, dt);
        char.state = "coffee";
      }
      break;
    }
  }
}

function startCoffeeRun(char: Character, walkable: boolean[][]): void {
  const coffeePos = getCoffeeMachinePos();
  const path = findPath(char.col, char.row, coffeePos.col, coffeePos.row, walkable);
  if (path.length > 0) {
    char.path = path;
    char.pathIndex = 0;
    char.moveProgress = 0;
    char.state = "coffee";
    char.stateTimer = 0;
    (char as CoffeeCharacter)._coffeePhase = "going";
  }
}

function goToTile(char: Character, col: number, row: number): void {
  char.col = col;
  char.row = row;
  char.x = col * TILE_SIZE;
  char.y = row * TILE_SIZE;
}

// ---------------------------------------------------------------------------
// Update character from API data
// ---------------------------------------------------------------------------

export function syncCharacterWithAgent(char: Character, agent: OfficeAgent): void {
  char.status = agent.status;
  char.currentTask = agent.currentTask;
  char.model = agent.model;
  char.totalTokens = agent.totalTokens;
  char.targetActivity = agent.activity;
}

// ---------------------------------------------------------------------------
// Cat Creation & Update
// ---------------------------------------------------------------------------

export function createCat(startCol: number, startRow: number): Cat {
  return {
    x: startCol * TILE_SIZE,
    y: startRow * TILE_SIZE,
    col: startCol,
    row: startRow,
    direction: "right",
    state: "wander",
    animFrame: 0,
    animTimer: 0,
    stateTimer: 3 + Math.random() * 5,
    path: [],
    pathIndex: 0,
    moveProgress: 0,
    followTargetId: null,
    targetCol: startCol,
    targetRow: startRow,
  };
}

export function updateCat(
  cat: Cat,
  dt: number,
  walkable: boolean[][],
  characters: Character[],
): void {
  // Update animation
  cat.animTimer += dt;
  if (cat.animTimer >= ANIM_FRAME_DURATION * 1.5) {
    cat.animTimer -= ANIM_FRAME_DURATION * 1.5;
    cat.animFrame = (cat.animFrame + 1) % 2;
  }

  switch (cat.state) {
    case "wander":
      updateCatWander(cat, dt, walkable, characters);
      break;
    case "sit":
      updateCatSit(cat, dt, walkable, characters);
      break;
    case "sleep":
      updateCatSleep(cat, dt, walkable);
      break;
    case "follow":
      updateCatFollow(cat, dt, walkable, characters);
      break;
  }
}

function updateCatWander(
  cat: Cat,
  dt: number,
  walkable: boolean[][],
  characters: Character[],
): void {
  // Walk along path
  if (cat.path.length > 0 && cat.pathIndex < cat.path.length) {
    moveCatAlongPath(cat, dt);
    return;
  }

  cat.stateTimer -= dt;
  if (cat.stateTimer <= 0) {
    // Pick next action
    const roll = Math.random();

    if (roll < 0.1 && characters.length > 0) {
      // Follow a random character
      const target = characters[Math.floor(Math.random() * characters.length)];
      cat.state = "follow";
      cat.followTargetId = target.id;
      cat.stateTimer = 10 + Math.random() * 10;
      return;
    }

    if (roll < 0.2) {
      // Sit down
      cat.state = "sit";
      cat.stateTimer = 5 + Math.random() * 10;
      return;
    }

    if (roll < 0.25) {
      // Go sleep on the couch
      const couch = getCouchPos();
      const path = findPath(cat.col, cat.row, couch.col, couch.row, walkable);
      if (path.length > 0) {
        cat.path = path;
        cat.pathIndex = 0;
        cat.state = "sleep";
        cat.stateTimer = 20 + Math.random() * 20;
        return;
      }
    }

    // Wander to a random spot
    const target = getRandomWalkableTileAnywhere(walkable);
    if (target) {
      const path = findPath(cat.col, cat.row, target.col, target.row, walkable);
      if (path.length > 0 && path.length < 40) {
        cat.path = path;
        cat.pathIndex = 0;
      }
    }
    cat.stateTimer = 3 + Math.random() * 5;
  }
}

function updateCatSit(
  cat: Cat,
  dt: number,
  walkable: boolean[][],
  characters: Character[],
): void {
  cat.stateTimer -= dt;
  if (cat.stateTimer <= 0) {
    cat.state = "wander";
    cat.stateTimer = 2 + Math.random() * 3;
  }
}

function updateCatSleep(cat: Cat, dt: number, walkable: boolean[][]): void {
  // If still walking to couch
  if (cat.path.length > 0 && cat.pathIndex < cat.path.length) {
    moveCatAlongPath(cat, dt);
    return;
  }

  cat.stateTimer -= dt;
  if (cat.stateTimer <= 0) {
    cat.state = "wander";
    cat.stateTimer = 3 + Math.random() * 5;
  }
}

function updateCatFollow(
  cat: Cat,
  dt: number,
  walkable: boolean[][],
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
  if (!target) {
    cat.state = "wander";
    cat.followTargetId = null;
    cat.stateTimer = 3;
    return;
  }

  // Path to one tile behind the target
  if (cat.path.length === 0 || cat.pathIndex >= cat.path.length) {
    const behindCol = Math.max(0, target.col - 1);
    const behindRow = target.row;
    if (walkable[behindRow] && walkable[behindRow][behindCol]) {
      const path = findPath(cat.col, cat.row, behindCol, behindRow, walkable);
      if (path.length > 0) {
        cat.path = path;
        cat.pathIndex = 0;
      }
    }
  } else {
    moveCatAlongPath(cat, dt);
  }
}

function moveCatAlongPath(cat: Cat, dt: number): void {
  if (cat.pathIndex >= cat.path.length) return;

  const target = cat.path[cat.pathIndex];
  const targetX = target.col * TILE_SIZE;
  const targetY = target.row * TILE_SIZE;

  const dx = targetX - cat.x;
  const dy = targetY - cat.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    cat.direction = dx > 0 ? "right" : "left";
  } else if (dy !== 0) {
    cat.direction = dy > 0 ? "down" : "up";
  }

  const moveAmount = CAT_WALK_SPEED * dt;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= moveAmount) {
    cat.x = targetX;
    cat.y = targetY;
    cat.col = target.col;
    cat.row = target.row;
    cat.pathIndex++;
  } else {
    const ratio = moveAmount / dist;
    cat.x += dx * ratio;
    cat.y += dy * ratio;
  }
}
