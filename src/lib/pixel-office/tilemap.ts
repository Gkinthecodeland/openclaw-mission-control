// ---------------------------------------------------------------------------
// Pixel Office V2 — Tile Map & Pathfinding
// ---------------------------------------------------------------------------

import type { TileInfo, TilePos, DeskAssignment, Furniture } from "./types";
import { GRID_COLS, GRID_ROWS, TILE_SIZE } from "./types";
import {
  buildDeskSprite,
  buildMonitorSprite,
  buildChairSprite,
  buildWhiteboardSprite,
  buildCoffeeMachineSprite,
  buildFridgeSprite,
  buildMicrowaveSprite,
  buildKitchenTableSprite,
  buildServerRackSprite,
  buildCouchSprite,
  buildBookshelfSprite,
  buildPlantSprite,
  buildPizzaBoxSprite,
  buildPostItSprite,
} from "./sprites";

// ---------------------------------------------------------------------------
// Room boundaries (in tile coordinates)
// ---------------------------------------------------------------------------

// Main Work Area: top-left
const WORK_LEFT = 1;
const WORK_TOP = 1;
const WORK_RIGHT = 20;
const WORK_BOTTOM = 12;

// Kitchen/Break Area: top-right
const KITCHEN_LEFT = 22;
const KITCHEN_TOP = 1;
const KITCHEN_RIGHT = 33;
const KITCHEN_BOTTOM = 12;

// Server Room: bottom-left
const SERVER_LEFT = 1;
const SERVER_TOP = 14;
const SERVER_RIGHT = 13;
const SERVER_BOTTOM = 21;

// Lounge: bottom-right
const LOUNGE_LEFT = 15;
const LOUNGE_TOP = 14;
const LOUNGE_RIGHT = 33;
const LOUNGE_BOTTOM = 21;

// ---------------------------------------------------------------------------
// Tile Map Builder
// ---------------------------------------------------------------------------

export function buildTileMap(): TileInfo[][] {
  const map: TileInfo[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => ({
      type: "wall" as const,
      walkable: false,
      variant: 0 as const,
    })),
  );

  // Fill rooms with floor tiles
  fillRoom(map, WORK_LEFT, WORK_TOP, WORK_RIGHT, WORK_BOTTOM, "floor_work");
  fillRoom(map, KITCHEN_LEFT, KITCHEN_TOP, KITCHEN_RIGHT, KITCHEN_BOTTOM, "floor_kitchen");
  fillRoom(map, SERVER_LEFT, SERVER_TOP, SERVER_RIGHT, SERVER_BOTTOM, "floor_server");
  fillRoom(map, LOUNGE_LEFT, LOUNGE_TOP, LOUNGE_RIGHT, LOUNGE_BOTTOM, "floor_lounge");

  // Doorways (2 tiles wide)
  // Work <-> Kitchen: gap in the vertical wall between them at row 5-6
  setDoor(map, 21, 5);
  setDoor(map, 21, 6);

  // Work <-> Server: gap in the horizontal wall at col 6-7
  setDoor(map, 6, 13);
  setDoor(map, 7, 13);

  // Kitchen <-> Lounge: gap in the horizontal wall at col 26-27
  setDoor(map, 26, 13);
  setDoor(map, 27, 13);

  // Server <-> Lounge: gap in the vertical wall at row 17-18
  setDoor(map, 14, 17);
  setDoor(map, 14, 18);

  // Window in top wall of main work area (cols 8-12, row 0)
  for (let c = 8; c <= 12; c++) {
    map[0][c] = { type: "window", walkable: false, variant: 0 };
  }

  return map;
}

function fillRoom(
  map: TileInfo[][],
  left: number,
  top: number,
  right: number,
  bottom: number,
  floorType: "floor_work" | "floor_kitchen" | "floor_server" | "floor_lounge",
): void {
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      map[r][c] = {
        type: floorType,
        walkable: true,
        variant: ((c + r) % 2) as 0 | 1,
      };
    }
  }
}

function setDoor(map: TileInfo[][], col: number, row: number): void {
  if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
    map[row][col] = { type: "door", walkable: true, variant: 0 };
  }
}

// ---------------------------------------------------------------------------
// Walkable Grid
// ---------------------------------------------------------------------------

export function buildWalkableGrid(tileMap: TileInfo[][], furniture: Furniture[]): boolean[][] {
  const walkable: boolean[][] = Array.from({ length: GRID_ROWS }, () =>
    Array(GRID_COLS).fill(false),
  );

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      walkable[r][c] = tileMap[r][c].walkable;
    }
  }

  // Block furniture tiles
  for (const f of furniture) {
    // Only block tiles for large furniture (not post-its, plants, etc.)
    if (
      f.type === "desk" ||
      f.type === "server_rack" ||
      f.type === "couch" ||
      f.type === "fridge" ||
      f.type === "coffee_machine" ||
      f.type === "kitchen_table" ||
      f.type === "bookshelf"
    ) {
      for (let dr = 0; dr < f.heightTiles; dr++) {
        for (let dc = 0; dc < f.widthTiles; dc++) {
          const r = f.row + dr;
          const c = f.col + dc;
          if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
            walkable[r][c] = false;
          }
        }
      }
    }
  }

  return walkable;
}

// ---------------------------------------------------------------------------
// BFS Pathfinding
// ---------------------------------------------------------------------------

export function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  walkable: boolean[][],
): TilePos[] {
  if (
    startCol < 0 ||
    startCol >= GRID_COLS ||
    startRow < 0 ||
    startRow >= GRID_ROWS ||
    endCol < 0 ||
    endCol >= GRID_COLS ||
    endRow < 0 ||
    endRow >= GRID_ROWS
  ) {
    return [];
  }

  if (!walkable[endRow][endCol]) return [];
  if (startCol === endCol && startRow === endRow) return [];

  const visited: boolean[][] = Array.from({ length: GRID_ROWS }, () =>
    Array(GRID_COLS).fill(false),
  );
  const parent: Array<Array<TilePos | null>> = Array.from({ length: GRID_ROWS }, () =>
    Array(GRID_COLS).fill(null),
  );

  const queue: TilePos[] = [{ col: startCol, row: startRow }];
  visited[startRow][startCol] = true;

  const dirs = [
    { dc: 0, dr: -1 },
    { dc: 0, dr: 1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.col === endCol && current.row === endRow) {
      // Reconstruct path
      const path: TilePos[] = [];
      let node: TilePos | null = { col: endCol, row: endRow };
      while (node !== null && !(node.col === startCol && node.row === startRow)) {
        path.push(node);
        node = parent[node.row][node.col];
      }
      path.reverse();
      return path;
    }

    for (const d of dirs) {
      const nc = current.col + d.dc;
      const nr = current.row + d.dr;
      if (
        nc >= 0 &&
        nc < GRID_COLS &&
        nr >= 0 &&
        nr < GRID_ROWS &&
        walkable[nr][nc] &&
        !visited[nr][nc]
      ) {
        visited[nr][nc] = true;
        parent[nr][nc] = current;
        queue.push({ col: nc, row: nr });
      }
    }
  }

  return []; // No path found
}

// ---------------------------------------------------------------------------
// Desk Assignments
// ---------------------------------------------------------------------------

export function getDeskAssignments(): DeskAssignment[] {
  // 3 desks in the main work area
  return [
    // Desk 1: top-left area of work room
    { col: 3, row: 3, chairCol: 5, chairRow: 5, monitorCol: 4, monitorRow: 2 },
    // Desk 2: middle area of work room
    { col: 10, row: 3, chairCol: 12, chairRow: 5, monitorCol: 11, monitorRow: 2 },
    // Desk 3: right area of work room
    { col: 3, row: 8, chairCol: 5, chairRow: 10, monitorCol: 4, monitorRow: 7 },
  ];
}

// ---------------------------------------------------------------------------
// Furniture Placement
// ---------------------------------------------------------------------------

export function buildFurniture(): Furniture[] {
  const furniture: Furniture[] = [];

  // === MAIN WORK AREA ===

  // 3 desks with monitors
  const desks = getDeskAssignments();
  for (const desk of desks) {
    furniture.push({
      type: "desk",
      col: desk.col,
      row: desk.row,
      widthTiles: 3,
      heightTiles: 2,
      sprite: buildDeskSprite(),
      zSortY: (desk.row + 2) * TILE_SIZE,
    });
    furniture.push({
      type: "monitor",
      col: desk.monitorCol,
      row: desk.monitorRow,
      widthTiles: 1,
      heightTiles: 1,
      sprite: buildMonitorSprite(),
      zSortY: desk.monitorRow * TILE_SIZE,
    });
    furniture.push({
      type: "chair",
      col: desk.chairCol,
      row: desk.chairRow,
      widthTiles: 1,
      heightTiles: 1,
      sprite: buildChairSprite(),
      zSortY: (desk.chairRow + 1) * TILE_SIZE,
    });
  }

  // Whiteboard on the north wall
  furniture.push({
    type: "whiteboard",
    col: 8,
    row: 1,
    widthTiles: 4,
    heightTiles: 1,
    sprite: buildWhiteboardSprite(),
    zSortY: TILE_SIZE,
  });

  // Post-it notes near desks
  furniture.push({
    type: "post_it",
    col: 6,
    row: 3,
    widthTiles: 1,
    heightTiles: 1,
    sprite: buildPostItSprite("#FFEE55"),
    zSortY: 3 * TILE_SIZE,
  });
  furniture.push({
    type: "post_it",
    col: 13,
    row: 3,
    widthTiles: 1,
    heightTiles: 1,
    sprite: buildPostItSprite("#55EEFF"),
    zSortY: 3 * TILE_SIZE,
  });

  // Plant in work area
  furniture.push({
    type: "plant",
    col: 18,
    row: 2,
    widthTiles: 1,
    heightTiles: 1,
    sprite: buildPlantSprite(),
    zSortY: 3 * TILE_SIZE,
  });

  // === KITCHEN / BREAK AREA ===

  // Coffee machine on the right wall
  furniture.push({
    type: "coffee_machine",
    col: 31,
    row: 2,
    widthTiles: 1,
    heightTiles: 2,
    sprite: buildCoffeeMachineSprite(),
    zSortY: 4 * TILE_SIZE,
  });

  // Fridge
  furniture.push({
    type: "fridge",
    col: 23,
    row: 2,
    widthTiles: 1,
    heightTiles: 2,
    sprite: buildFridgeSprite(),
    zSortY: 4 * TILE_SIZE,
  });

  // Microwave
  furniture.push({
    type: "microwave",
    col: 25,
    row: 2,
    widthTiles: 1,
    heightTiles: 1,
    sprite: buildMicrowaveSprite(),
    zSortY: 3 * TILE_SIZE,
  });

  // Kitchen table
  furniture.push({
    type: "kitchen_table",
    col: 25,
    row: 6,
    widthTiles: 2,
    heightTiles: 2,
    sprite: buildKitchenTableSprite(),
    zSortY: 8 * TILE_SIZE,
  });

  // Pizza box on the kitchen table
  furniture.push({
    type: "pizza_box",
    col: 26,
    row: 6,
    widthTiles: 1,
    heightTiles: 1,
    sprite: buildPizzaBoxSprite(),
    zSortY: 6 * TILE_SIZE + 2,
  });

  // === SERVER ROOM ===

  // 3 server racks
  for (let i = 0; i < 3; i++) {
    furniture.push({
      type: "server_rack",
      col: 3 + i * 3,
      row: 15,
      widthTiles: 1,
      heightTiles: 2,
      sprite: buildServerRackSprite(),
      zSortY: 17 * TILE_SIZE,
    });
  }

  // === LOUNGE ===

  // Couch
  furniture.push({
    type: "couch",
    col: 18,
    row: 17,
    widthTiles: 3,
    heightTiles: 2,
    sprite: buildCouchSprite(),
    zSortY: 19 * TILE_SIZE,
  });

  // Bookshelf
  furniture.push({
    type: "bookshelf",
    col: 31,
    row: 15,
    widthTiles: 2,
    heightTiles: 2,
    sprite: buildBookshelfSprite(),
    zSortY: 17 * TILE_SIZE,
  });

  // Plant in lounge
  furniture.push({
    type: "plant",
    col: 16,
    row: 15,
    widthTiles: 1,
    heightTiles: 1,
    sprite: buildPlantSprite(),
    zSortY: 16 * TILE_SIZE,
  });

  return furniture;
}

// ---------------------------------------------------------------------------
// Utility: Get a random walkable tile in a room
// ---------------------------------------------------------------------------

export function getRandomWalkableTile(
  walkable: boolean[][],
  minCol: number,
  minRow: number,
  maxCol: number,
  maxRow: number,
): TilePos | null {
  const candidates: TilePos[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (walkable[r][c]) {
        candidates.push({ col: c, row: r });
      }
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Get the coffee machine tile position (where characters walk to for coffee) */
export function getCoffeeMachinePos(): TilePos {
  return { col: 30, row: 3 };
}

/** Get the couch tile position (where the cat can sleep) */
export function getCouchPos(): TilePos {
  return { col: 19, row: 17 };
}

/** Get the doorway position for work room (used for sub-agent spawn/despawn) */
export function getWorkDoorway(): TilePos {
  return { col: 21, row: 5 };
}

/** Check if a tile is within the work area */
export function isInWorkArea(col: number, row: number): boolean {
  return col >= WORK_LEFT && col <= WORK_RIGHT && row >= WORK_TOP && row <= WORK_BOTTOM;
}

/** Check if a tile is within the kitchen */
export function isInKitchen(col: number, row: number): boolean {
  return col >= KITCHEN_LEFT && col <= KITCHEN_RIGHT && row >= KITCHEN_TOP && row <= KITCHEN_BOTTOM;
}

/** Get a random walkable tile in the entire office */
export function getRandomWalkableTileAnywhere(walkable: boolean[][]): TilePos | null {
  return getRandomWalkableTile(walkable, 0, 0, GRID_COLS - 1, GRID_ROWS - 1);
}
