// ---------------------------------------------------------------------------
// Pixel Office V3 — Pokemon Red Edition — Tile Maps & BFS Pathfinding
// ---------------------------------------------------------------------------
// Each floor is 30 cols x 22 rows. Four floors: Ground, Upper, Basement, Rooftop.
// ---------------------------------------------------------------------------

import {
  type TilePos,
  type DeskAssignment,
  type FurnitureInstance,
  type FloorData,
  type SpecialTile,
  TileType,
  FloorId,
  Direction,
  TILE_SIZE,
  FLOOR_COLS,
  FLOOR_ROWS,
} from './types';

import {
  buildDeskSprite,
  buildMonitorSprite,
  buildChairSprite,
  buildPlantSprite,
  buildCouchSprite,
  buildTableSprite,
  buildCoffeeMachineSprite,
  buildFridgeSprite,
  buildMicrowaveSprite,
  buildPrinterSprite,
  buildBookshelfSprite,
  buildServerRackSprite,
  buildArcadeMachineSprite,
  buildProjectorSprite,
  buildWhiteboardSprite,
  buildTVSprite,
  buildBeanBagSprite,
  buildBenchSprite,
  buildTreeSprite,
  buildAntennaSprite,
  buildSolarPanelSprite,
  buildBirdBathSprite,
  buildGardenBedSprite,
  buildSinkSprite,
  buildWaterCoolerSprite,
  buildTrashCanSprite,
  buildSecretDeskSprite,
  buildPitaPosterSprite,
  buildACUnitSprite,
  buildCautionSignSprite,
  buildRailingSprite,
} from './sprites';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTiles(fill: TileType): TileType[][] {
  return Array.from({ length: FLOOR_ROWS }, () =>
    Array.from({ length: FLOOR_COLS }, () => fill),
  );
}

function makeCollision(): boolean[][] {
  return Array.from({ length: FLOOR_ROWS }, () =>
    Array.from({ length: FLOOR_COLS }, () => true),
  );
}

/** Fill a rectangular region of tiles with the given type */
function fillRect(
  tiles: TileType[][],
  col0: number,
  row0: number,
  col1: number,
  row1: number,
  type: TileType,
): void {
  for (let r = row0; r <= row1; r++) {
    for (let c = col0; c <= col1; c++) {
      if (r >= 0 && r < FLOOR_ROWS && c >= 0 && c < FLOOR_COLS) {
        tiles[r][c] = type;
      }
    }
  }
}

/** Set collision for a rectangular region */
function setCollision(
  collision: boolean[][],
  col0: number,
  row0: number,
  col1: number,
  row1: number,
  blocked: boolean,
): void {
  for (let r = row0; r <= row1; r++) {
    for (let c = col0; c <= col1; c++) {
      if (r >= 0 && r < FLOOR_ROWS && c >= 0 && c < FLOOR_COLS) {
        collision[r][c] = blocked;
      }
    }
  }
}

/** Checkerboard floor variant for Pokemon-style tiles */
function fillCheckerboard(
  tiles: TileType[][],
  col0: number,
  row0: number,
  col1: number,
  row1: number,
  primary: TileType,
  alt: TileType,
): void {
  for (let r = row0; r <= row1; r++) {
    for (let c = col0; c <= col1; c++) {
      if (r >= 0 && r < FLOOR_ROWS && c >= 0 && c < FLOOR_COLS) {
        tiles[r][c] = (c + r) % 2 === 0 ? primary : alt;
      }
    }
  }
}

/** Compute zSortY for bottom edge of furniture */
function zSort(row: number, h: number): number {
  return (row + h) * TILE_SIZE;
}

/** Add a furniture piece and block collision for its footprint */
function placeFurniture(
  furniture: FurnitureInstance[],
  collision: boolean[][],
  kind: FurnitureInstance['kind'],
  col: number,
  row: number,
  w: number,
  h: number,
  spriteBuilder: () => import('./types').SpriteData,
  options?: { noCollision?: boolean; animated?: boolean; state?: string },
): void {
  furniture.push({
    kind,
    col,
    row,
    w,
    h,
    sprite: spriteBuilder(),
    zSortY: zSort(row, h),
    animated: options?.animated,
    state: options?.state,
  });
  if (!options?.noCollision) {
    setCollision(collision, col, row, col + w - 1, row + h - 1, true);
  }
}

// ---------------------------------------------------------------------------
// Ground Floor (FloorId.GROUND = 0) — Main / Default View
// ---------------------------------------------------------------------------

function buildGroundFloor(): FloorData {
  const tiles = makeTiles(TileType.VOID);
  const collision = makeCollision();
  const furniture: FurnitureInstance[] = [];
  const desks: DeskAssignment[] = [];
  const secretTiles: SpecialTile[] = [];

  // --- Walls ---
  // Top wall
  fillRect(tiles, 0, 0, 29, 1, TileType.WALL_TOP);
  // Wall base row 2-3
  fillRect(tiles, 0, 2, 29, 3, TileType.WALL);
  // Windows in wall base (row 2, evenly spaced)
  for (const c of [3, 4, 5, 9, 10, 11, 17, 18, 19, 23, 24, 25]) {
    tiles[2][c] = TileType.WINDOW;
  }
  // Left wall
  fillRect(tiles, 0, 0, 0, 21, TileType.WALL);
  // Right wall
  fillRect(tiles, 29, 0, 29, 21, TileType.WALL);
  // Bottom wall
  fillRect(tiles, 0, 20, 29, 21, TileType.WALL);
  // Middle wall divider (row 12) with doors
  fillRect(tiles, 0, 12, 29, 12, TileType.WALL);
  // Vertical divider between reception and main office (col 14)
  fillRect(tiles, 14, 3, 14, 11, TileType.WALL);

  // --- RECEPTION (left, rows 4-11, cols 1-13) ---
  fillCheckerboard(tiles, 1, 4, 13, 11, TileType.FLOOR, TileType.FLOOR_ALT);
  setCollision(collision, 1, 4, 13, 11, false);

  // Welcome mat at entrance
  tiles[11][6] = TileType.WELCOME_MAT;
  tiles[11][7] = TileType.WELCOME_MAT;

  // Reception furniture
  // Front desk (cols 4-6, row 7-8)
  placeFurniture(furniture, collision, 'desk', 4, 7, 3, 2, buildDeskSprite);
  // Monitor on front desk
  placeFurniture(furniture, collision, 'monitor', 5, 7, 1, 1, buildMonitorSprite);
  // Chair behind desk
  placeFurniture(furniture, collision, 'chair', 5, 9, 1, 1, buildChairSprite, { noCollision: true });
  // Plant in corner
  placeFurniture(furniture, collision, 'plant', 1, 4, 1, 1, buildPlantSprite);
  // Couch against left wall
  placeFurniture(furniture, collision, 'couch', 1, 6, 1, 3, buildCouchSprite);
  // Plant near couch
  placeFurniture(furniture, collision, 'plant', 1, 10, 1, 1, buildPlantSprite);
  // Water cooler
  placeFurniture(furniture, collision, 'waterCooler', 12, 4, 1, 1, buildWaterCoolerSprite);

  // Door from reception to hallway (row 12, cols 6-7)
  tiles[12][6] = TileType.DOOR;
  tiles[12][7] = TileType.DOOR;
  collision[12][6] = false;
  collision[12][7] = false;

  // Door between reception and main office (col 14, rows 7-8)
  tiles[7][14] = TileType.DOOR;
  tiles[8][14] = TileType.DOOR;
  collision[7][14] = false;
  collision[8][14] = false;

  // --- MAIN OFFICE (right, rows 4-11, cols 15-28) ---
  fillCheckerboard(tiles, 15, 4, 28, 11, TileType.FLOOR, TileType.FLOOR_ALT);
  setCollision(collision, 15, 4, 28, 11, false);

  // 4 desks in main office
  // Desk 1 (cols 16-18, row 5-6) — top left
  placeFurniture(furniture, collision, 'desk', 16, 5, 3, 2, buildDeskSprite);
  placeFurniture(furniture, collision, 'monitor', 17, 5, 1, 1, buildMonitorSprite);
  placeFurniture(furniture, collision, 'chair', 17, 7, 1, 1, buildChairSprite, { noCollision: true });
  desks.push({
    pos: { col: 16, row: 5 },
    seatCol: 17,
    seatRow: 7,
    seatDir: Direction.UP,
    assignedTo: null,
  });

  // Desk 2 (cols 22-24, row 5-6) — top right
  placeFurniture(furniture, collision, 'desk', 22, 5, 3, 2, buildDeskSprite);
  placeFurniture(furniture, collision, 'monitor', 23, 5, 1, 1, buildMonitorSprite);
  placeFurniture(furniture, collision, 'chair', 23, 7, 1, 1, buildChairSprite, { noCollision: true });
  desks.push({
    pos: { col: 22, row: 5 },
    seatCol: 23,
    seatRow: 7,
    seatDir: Direction.UP,
    assignedTo: null,
  });

  // Desk 3 (cols 16-18, row 9-10) — bottom left
  placeFurniture(furniture, collision, 'desk', 16, 9, 3, 2, buildDeskSprite);
  placeFurniture(furniture, collision, 'monitor', 17, 9, 1, 1, buildMonitorSprite);
  placeFurniture(furniture, collision, 'chair', 17, 8, 1, 1, buildChairSprite, { noCollision: true });
  desks.push({
    pos: { col: 16, row: 9 },
    seatCol: 17,
    seatRow: 8,
    seatDir: Direction.DOWN,
    assignedTo: null,
  });

  // Desk 4 (cols 22-24, row 9-10) — bottom right
  placeFurniture(furniture, collision, 'desk', 22, 9, 3, 2, buildDeskSprite);
  placeFurniture(furniture, collision, 'monitor', 23, 9, 1, 1, buildMonitorSprite);
  placeFurniture(furniture, collision, 'chair', 23, 8, 1, 1, buildChairSprite, { noCollision: true });
  desks.push({
    pos: { col: 22, row: 9 },
    seatCol: 23,
    seatRow: 8,
    seatDir: Direction.DOWN,
    assignedTo: null,
  });

  // Printer in main office
  placeFurniture(furniture, collision, 'printer', 27, 4, 1, 1, buildPrinterSprite);
  // Trash can near printer
  placeFurniture(furniture, collision, 'trashCan', 28, 4, 1, 1, buildTrashCanSprite);
  // Plant in main office
  placeFurniture(furniture, collision, 'plant', 15, 4, 1, 1, buildPlantSprite);

  // Door from main office to hallway (row 12, cols 20-21)
  tiles[12][20] = TileType.DOOR;
  tiles[12][21] = TileType.DOOR;
  collision[12][20] = false;
  collision[12][21] = false;

  // --- KITCHEN (left, rows 13-19, cols 1-13) ---
  fillRect(tiles, 1, 13, 13, 19, TileType.WOOD_FLOOR);
  setCollision(collision, 1, 13, 13, 19, false);

  // Kitchen furniture
  // Coffee machine against top wall
  placeFurniture(furniture, collision, 'coffeeMachine', 1, 13, 1, 2, buildCoffeeMachineSprite, { animated: true });
  // Fridge next to coffee machine
  placeFurniture(furniture, collision, 'fridge', 3, 13, 1, 2, buildFridgeSprite);
  // Microwave on counter
  placeFurniture(furniture, collision, 'microwave', 5, 13, 1, 1, buildMicrowaveSprite);
  // Sink
  placeFurniture(furniture, collision, 'sink', 7, 13, 1, 1, buildSinkSprite);
  // Kitchen table (cols 5-7, rows 16-17) — central
  placeFurniture(furniture, collision, 'table', 5, 16, 3, 2, buildTableSprite);
  // Chairs around table
  placeFurniture(furniture, collision, 'chair', 5, 15, 1, 1, buildChairSprite, { noCollision: true });
  placeFurniture(furniture, collision, 'chair', 7, 15, 1, 1, buildChairSprite, { noCollision: true });
  placeFurniture(furniture, collision, 'chair', 5, 18, 1, 1, buildChairSprite, { noCollision: true });
  placeFurniture(furniture, collision, 'chair', 7, 18, 1, 1, buildChairSprite, { noCollision: true });
  // Plant in kitchen
  placeFurniture(furniture, collision, 'plant', 12, 19, 1, 1, buildPlantSprite);
  // Trash can
  placeFurniture(furniture, collision, 'trashCan', 10, 13, 1, 1, buildTrashCanSprite);

  // --- HALLWAY (rows 13-19, cols 15-22) ---
  fillRect(tiles, 15, 13, 22, 19, TileType.FLOOR);
  setCollision(collision, 15, 13, 22, 19, false);

  // Door from kitchen to hallway (col 14, rows 15-16)
  // Vertical wall between kitchen and hallway
  fillRect(tiles, 14, 13, 14, 19, TileType.WALL);
  tiles[15][14] = TileType.DOOR;
  tiles[16][14] = TileType.DOOR;
  collision[15][14] = false;
  collision[16][14] = false;

  // Wall between hallway and stairs
  fillRect(tiles, 23, 13, 23, 19, TileType.WALL);
  tiles[15][23] = TileType.DOOR;
  tiles[16][23] = TileType.DOOR;
  collision[15][23] = false;
  collision[16][23] = false;

  // --- STAIRS AREA (rows 13-19, cols 24-28) ---
  // Stairs up (top portion)
  fillRect(tiles, 24, 13, 28, 15, TileType.STAIRS_UP);
  setCollision(collision, 24, 13, 28, 15, false);

  // Stairs down (bottom portion — leads to basement)
  fillRect(tiles, 24, 17, 28, 19, TileType.STAIRS_DOWN);
  setCollision(collision, 24, 17, 28, 19, false);

  // Gap between stairs
  fillRect(tiles, 24, 16, 28, 16, TileType.FLOOR);
  setCollision(collision, 24, 16, 28, 16, false);

  return {
    id: FloorId.GROUND,
    name: 'Ground Floor',
    tiles,
    collision,
    furniture,
    desks,
    stairsUp: { col: 26, row: 14 },
    stairsDown: { col: 26, row: 18 },
    coffeeMachine: { col: 2, row: 14 },
    secretTiles,
  };
}

// ---------------------------------------------------------------------------
// Upper Floor (FloorId.UPPER = 1)
// ---------------------------------------------------------------------------

function buildUpperFloor(): FloorData {
  const tiles = makeTiles(TileType.VOID);
  const collision = makeCollision();
  const furniture: FurnitureInstance[] = [];
  const desks: DeskAssignment[] = [];
  const secretTiles: SpecialTile[] = [];

  // --- Walls ---
  fillRect(tiles, 0, 0, 29, 1, TileType.WALL_TOP);
  fillRect(tiles, 0, 2, 29, 3, TileType.WALL);
  fillRect(tiles, 0, 0, 0, 21, TileType.WALL);
  fillRect(tiles, 29, 0, 29, 21, TileType.WALL);
  fillRect(tiles, 0, 20, 29, 21, TileType.WALL);
  fillRect(tiles, 0, 12, 29, 12, TileType.WALL);

  // Windows
  for (const c of [3, 4, 5, 9, 10, 11, 17, 18, 19, 23, 24, 25]) {
    tiles[2][c] = TileType.WINDOW;
  }

  // Vertical divider between conference room and lounge (col 14)
  fillRect(tiles, 14, 3, 14, 11, TileType.WALL);
  // Door between rooms
  tiles[7][14] = TileType.DOOR;
  tiles[8][14] = TileType.DOOR;
  collision[7][14] = false;
  collision[8][14] = false;

  // --- CONFERENCE ROOM (left, rows 4-11, cols 1-13) ---
  fillRect(tiles, 1, 4, 13, 11, TileType.CARPET);
  setCollision(collision, 1, 4, 13, 11, false);

  // Big conference table (cols 4-10, rows 6-9)
  placeFurniture(furniture, collision, 'table', 4, 6, 7, 4, buildTableSprite);

  // Chairs around the conference table (6 chairs)
  // Top side
  placeFurniture(furniture, collision, 'chair', 5, 5, 1, 1, buildChairSprite, { noCollision: true });
  placeFurniture(furniture, collision, 'chair', 7, 5, 1, 1, buildChairSprite, { noCollision: true });
  placeFurniture(furniture, collision, 'chair', 9, 5, 1, 1, buildChairSprite, { noCollision: true });
  // Bottom side
  placeFurniture(furniture, collision, 'chair', 5, 10, 1, 1, buildChairSprite, { noCollision: true });
  placeFurniture(furniture, collision, 'chair', 7, 10, 1, 1, buildChairSprite, { noCollision: true });
  placeFurniture(furniture, collision, 'chair', 9, 10, 1, 1, buildChairSprite, { noCollision: true });

  // Projector at the head of the table
  placeFurniture(furniture, collision, 'projector', 3, 7, 1, 1, buildProjectorSprite);

  // Whiteboard on the north wall
  placeFurniture(furniture, collision, 'whiteboard', 2, 4, 4, 1, buildWhiteboardSprite);

  // Plant in corner
  placeFurniture(furniture, collision, 'plant', 13, 4, 1, 1, buildPlantSprite);

  // Door from conference room to hallway (row 12, cols 6-7)
  tiles[12][6] = TileType.DOOR;
  tiles[12][7] = TileType.DOOR;
  collision[12][6] = false;
  collision[12][7] = false;

  // --- LOUNGE (right, rows 4-11, cols 15-28) ---
  fillRect(tiles, 15, 4, 28, 11, TileType.CARPET_ALT);
  setCollision(collision, 15, 4, 28, 11, false);

  // Couch (cols 16-18, row 5-6)
  placeFurniture(furniture, collision, 'couch', 16, 5, 3, 2, buildCouchSprite);

  // TV on the wall
  placeFurniture(furniture, collision, 'tv', 17, 4, 1, 1, buildTVSprite);

  // Bookshelf on the right wall
  placeFurniture(furniture, collision, 'bookshelf', 27, 4, 2, 2, buildBookshelfSprite);

  // Arcade machine
  placeFurniture(furniture, collision, 'arcadeMachine', 25, 4, 1, 2, buildArcadeMachineSprite, { animated: true });
  secretTiles.push({ pos: { col: 25, row: 6 }, kind: 'arcade' });

  // Bean bags
  placeFurniture(furniture, collision, 'beanBag', 20, 8, 1, 1, buildBeanBagSprite, { noCollision: true });
  placeFurniture(furniture, collision, 'beanBag', 22, 9, 1, 1, buildBeanBagSprite, { noCollision: true });

  // Plants
  placeFurniture(furniture, collision, 'plant', 15, 4, 1, 1, buildPlantSprite);
  placeFurniture(furniture, collision, 'plant', 28, 11, 1, 1, buildPlantSprite);

  // Door from lounge to hallway (row 12, cols 20-21)
  tiles[12][20] = TileType.DOOR;
  tiles[12][21] = TileType.DOOR;
  collision[12][20] = false;
  collision[12][21] = false;

  // --- HALLWAY (rows 13-19, cols 1-22) ---
  fillRect(tiles, 1, 13, 22, 19, TileType.FLOOR);
  setCollision(collision, 1, 13, 22, 19, false);

  // Wall between hallway and stairs
  fillRect(tiles, 23, 13, 23, 19, TileType.WALL);
  tiles[15][23] = TileType.DOOR;
  tiles[16][23] = TileType.DOOR;
  collision[15][23] = false;
  collision[16][23] = false;

  // --- STAIRS AREA (rows 13-19, cols 24-28) ---
  // Only stairs down on upper floor (back to ground)
  fillRect(tiles, 24, 13, 28, 19, TileType.STAIRS_DOWN);
  setCollision(collision, 24, 13, 28, 19, false);

  return {
    id: FloorId.UPPER,
    name: 'Upper Floor',
    tiles,
    collision,
    furniture,
    desks,
    stairsUp: null,
    stairsDown: { col: 26, row: 16 },
    coffeeMachine: null,
    secretTiles,
  };
}

// ---------------------------------------------------------------------------
// Basement (FloorId.BASEMENT = 2)
// ---------------------------------------------------------------------------

function buildBasement(): FloorData {
  const tiles = makeTiles(TileType.VOID);
  const collision = makeCollision();
  const furniture: FurnitureInstance[] = [];
  const desks: DeskAssignment[] = [];
  const secretTiles: SpecialTile[] = [];

  // --- Walls (darker theme) ---
  fillRect(tiles, 0, 0, 29, 1, TileType.WALL_TOP);
  fillRect(tiles, 0, 2, 29, 3, TileType.WALL);
  fillRect(tiles, 0, 0, 0, 21, TileType.WALL);
  fillRect(tiles, 29, 0, 29, 21, TileType.WALL);
  fillRect(tiles, 0, 20, 29, 21, TileType.WALL);

  // Horizontal wall at row 15 (between server room and lower area)
  fillRect(tiles, 0, 15, 29, 15, TileType.WALL);

  // Vertical wall between server room and secret room (col 21)
  fillRect(tiles, 21, 3, 21, 14, TileType.WALL);

  // --- SERVER ROOM (rows 4-14, cols 1-20) ---
  fillCheckerboard(tiles, 1, 4, 20, 14, TileType.METAL_FLOOR, TileType.METAL_FLOOR);
  setCollision(collision, 1, 4, 20, 14, false);

  // Cable floor tiles along server rack rows
  for (let c = 1; c <= 20; c++) {
    if (c % 3 === 0) {
      tiles[4][c] = TileType.CABLE_FLOOR;
      tiles[14][c] = TileType.CABLE_FLOOR;
    }
  }

  // Server racks (6 racks, 2 rows of 3)
  // Row 1: cols 3, 6, 9
  placeFurniture(furniture, collision, 'serverRack', 3, 5, 2, 3, buildServerRackSprite, { animated: true });
  placeFurniture(furniture, collision, 'serverRack', 6, 5, 2, 3, buildServerRackSprite, { animated: true });
  placeFurniture(furniture, collision, 'serverRack', 9, 5, 2, 3, buildServerRackSprite, { animated: true });
  // Row 2: cols 3, 6, 9
  placeFurniture(furniture, collision, 'serverRack', 3, 10, 2, 3, buildServerRackSprite, { animated: true });
  placeFurniture(furniture, collision, 'serverRack', 6, 10, 2, 3, buildServerRackSprite, { animated: true });
  placeFurniture(furniture, collision, 'serverRack', 9, 10, 2, 3, buildServerRackSprite, { animated: true });

  // Monitoring desk (cols 14-16, rows 8-9)
  placeFurniture(furniture, collision, 'desk', 14, 8, 3, 2, buildDeskSprite);
  placeFurniture(furniture, collision, 'monitor', 15, 8, 1, 1, buildMonitorSprite);
  placeFurniture(furniture, collision, 'chair', 15, 10, 1, 1, buildChairSprite, { noCollision: true });
  desks.push({
    pos: { col: 14, row: 8 },
    seatCol: 15,
    seatRow: 10,
    seatDir: Direction.UP,
    assignedTo: null,
  });

  // AC Unit on the wall
  placeFurniture(furniture, collision, 'acUnit', 18, 4, 2, 1, buildACUnitSprite);

  // Caution sign
  placeFurniture(furniture, collision, 'cautionSign', 1, 4, 1, 1, buildCautionSignSprite, { noCollision: true });

  // --- SECRET ROOM (rows 4-14, cols 22-28) ---
  fillRect(tiles, 22, 4, 28, 14, TileType.METAL_ALT);
  setCollision(collision, 22, 4, 28, 14, false);

  // Secret desk
  placeFurniture(furniture, collision, 'secretDesk', 24, 7, 3, 2, buildSecretDeskSprite);
  // Pita poster on wall
  placeFurniture(furniture, collision, 'pitaPoster', 25, 4, 2, 2, buildPitaPosterSprite);

  // Hidden door at (21, 15) — looks like wall but is walkable
  tiles[15][21] = TileType.WALL; // visually a wall
  collision[15][21] = false;     // but walkable
  secretTiles.push({
    pos: { col: 21, row: 15 },
    kind: 'secretDoor',
    data: 'The wall slides open...',
  });

  // Achievement tile in secret room
  secretTiles.push({
    pos: { col: 26, row: 10 },
    kind: 'achievement',
    data: 'HELLO WORLD',
  });

  // Door from server room to lower hallway (row 15, cols 10-11)
  tiles[15][10] = TileType.DOOR;
  tiles[15][11] = TileType.DOOR;
  collision[15][10] = false;
  collision[15][11] = false;

  // --- LOWER HALLWAY (rows 16-19, cols 1-22) ---
  fillRect(tiles, 1, 16, 22, 19, TileType.METAL_FLOOR);
  setCollision(collision, 1, 16, 22, 19, false);

  // Wall between hallway and stairs
  fillRect(tiles, 23, 16, 23, 19, TileType.WALL);
  tiles[17][23] = TileType.DOOR;
  tiles[18][23] = TileType.DOOR;
  collision[17][23] = false;
  collision[18][23] = false;

  // --- STAIRS AREA (rows 16-19, cols 24-28) ---
  fillRect(tiles, 24, 16, 28, 19, TileType.STAIRS_UP);
  setCollision(collision, 24, 16, 28, 19, false);

  return {
    id: FloorId.BASEMENT,
    name: 'Basement',
    tiles,
    collision,
    furniture,
    desks,
    stairsUp: { col: 26, row: 18 },
    stairsDown: null,
    coffeeMachine: null,
    secretTiles,
  };
}

// ---------------------------------------------------------------------------
// Rooftop (FloorId.ROOFTOP = 3)
// ---------------------------------------------------------------------------

function buildRooftop(): FloorData {
  const tiles = makeTiles(TileType.VOID);
  const collision = makeCollision();
  const furniture: FurnitureInstance[] = [];
  const desks: DeskAssignment[] = [];
  const secretTiles: SpecialTile[] = [];

  // --- Railings (edges) ---
  // Top railing (rows 0-1)
  fillRect(tiles, 0, 0, 29, 1, TileType.RAILING);
  // Bottom railing (rows 19-21)
  fillRect(tiles, 0, 19, 29, 21, TileType.RAILING);
  // Left railing (col 0)
  fillRect(tiles, 0, 0, 0, 21, TileType.RAILING);
  // Right railing (col 29)
  fillRect(tiles, 29, 0, 29, 21, TileType.RAILING);

  // --- Main rooftop area (rows 2-18, cols 1-28) ---
  fillCheckerboard(tiles, 1, 2, 28, 18, TileType.GRASS, TileType.GRASS_ALT);
  setCollision(collision, 1, 2, 28, 18, false);

  // --- Main garden area (rows 2-4) ---
  // Garden beds
  placeFurniture(furniture, collision, 'gardenBed', 2, 2, 3, 2, buildGardenBedSprite);
  placeFurniture(furniture, collision, 'gardenBed', 6, 2, 3, 2, buildGardenBedSprite);
  placeFurniture(furniture, collision, 'gardenBed', 10, 2, 3, 2, buildGardenBedSprite);

  // Tree
  placeFurniture(furniture, collision, 'tree', 15, 2, 2, 3, buildTreeSprite);

  // Plants scattered
  placeFurniture(furniture, collision, 'plant', 19, 2, 1, 1, buildPlantSprite);
  placeFurniture(furniture, collision, 'plant', 22, 3, 1, 1, buildPlantSprite);

  // --- Solar panels & antenna (top right area) ---
  placeFurniture(furniture, collision, 'solarPanel', 24, 2, 2, 2, buildSolarPanelSprite);
  placeFurniture(furniture, collision, 'solarPanel', 27, 2, 2, 2, buildSolarPanelSprite);
  placeFurniture(furniture, collision, 'antenna', 26, 5, 1, 2, buildAntennaSprite);

  // --- Walkway path (rows 8-10) ---
  fillRect(tiles, 1, 8, 28, 10, TileType.PATH);
  // PATH tiles are still walkable (already set to false above)

  // Bird bath along the walkway
  placeFurniture(furniture, collision, 'birdBath', 5, 8, 1, 1, buildBirdBathSprite);

  // --- Seating area (rows 14-16) ---
  placeFurniture(furniture, collision, 'bench', 4, 14, 3, 1, buildBenchSprite);
  placeFurniture(furniture, collision, 'bench', 4, 16, 3, 1, buildBenchSprite);
  placeFurniture(furniture, collision, 'bench', 10, 14, 3, 1, buildBenchSprite);

  // Plants around seating
  placeFurniture(furniture, collision, 'plant', 3, 14, 1, 1, buildPlantSprite);
  placeFurniture(furniture, collision, 'plant', 14, 14, 1, 1, buildPlantSprite);

  // More garden beds near seating
  placeFurniture(furniture, collision, 'gardenBed', 16, 14, 3, 2, buildGardenBedSprite);

  // Railing furniture (decorative, on the railing edges)
  placeFurniture(furniture, collision, 'plant', 1, 18, 1, 1, buildPlantSprite);
  placeFurniture(furniture, collision, 'plant', 28, 18, 1, 1, buildPlantSprite);

  // --- STAIRS AREA (rows 16-19, cols 24-28) ---
  // Override grass with stairs
  fillRect(tiles, 24, 16, 28, 18, TileType.STAIRS_DOWN);
  setCollision(collision, 24, 16, 28, 18, false);
  // The railing row 19 tiles below stairs stay as railing (blocked)

  return {
    id: FloorId.ROOFTOP,
    name: 'Rooftop',
    tiles,
    collision,
    furniture,
    desks,
    stairsUp: null,
    stairsDown: { col: 26, row: 17 },
    coffeeMachine: null,
    secretTiles,
  };
}

// ---------------------------------------------------------------------------
// Public API — Build Floors
// ---------------------------------------------------------------------------

/** Build a single floor's complete data */
export function buildFloor(id: FloorId): FloorData {
  switch (id) {
    case FloorId.GROUND:
      return buildGroundFloor();
    case FloorId.UPPER:
      return buildUpperFloor();
    case FloorId.BASEMENT:
      return buildBasement();
    case FloorId.ROOFTOP:
      return buildRooftop();
  }
}

/** Build all 4 floors */
export function buildAllFloors(): Map<FloorId, FloorData> {
  const floors = new Map<FloorId, FloorData>();
  floors.set(FloorId.GROUND, buildFloor(FloorId.GROUND));
  floors.set(FloorId.UPPER, buildFloor(FloorId.UPPER));
  floors.set(FloorId.BASEMENT, buildFloor(FloorId.BASEMENT));
  floors.set(FloorId.ROOFTOP, buildFloor(FloorId.ROOFTOP));
  return floors;
}

// ---------------------------------------------------------------------------
// BFS Pathfinding — 4-directional
// ---------------------------------------------------------------------------

const BFS_DIRS = [
  { dc: 0, dr: -1 }, // up
  { dc: 0, dr: 1 },  // down
  { dc: -1, dr: 0 }, // left
  { dc: 1, dr: 0 },  // right
];

/**
 * Find a path from (startCol, startRow) to (endCol, endRow) using BFS.
 * Returns the path as an array of TilePos (excluding start, including end),
 * or an empty array if no path exists.
 *
 * The optional `ignoreCollisionAt` allows pathing to a tile that is normally
 * blocked (e.g., an agent's own desk seat).
 */
export function findPath(
  floor: FloorData,
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  ignoreCollisionAt?: TilePos,
): TilePos[] {
  // Bounds check
  if (
    startCol < 0 || startCol >= FLOOR_COLS ||
    startRow < 0 || startRow >= FLOOR_ROWS ||
    endCol < 0 || endCol >= FLOOR_COLS ||
    endRow < 0 || endRow >= FLOOR_ROWS
  ) {
    return [];
  }

  // Same tile — no movement needed
  if (startCol === endCol && startRow === endRow) {
    return [];
  }

  // Check if destination is walkable (or is the ignored collision tile)
  const endIgnored =
    ignoreCollisionAt !== undefined &&
    ignoreCollisionAt.col === endCol &&
    ignoreCollisionAt.row === endRow;

  if (!endIgnored && floor.collision[endRow][endCol]) {
    return [];
  }

  // BFS
  const visited: boolean[][] = Array.from({ length: FLOOR_ROWS }, () =>
    Array.from({ length: FLOOR_COLS }, () => false),
  );
  const parent: Array<Array<TilePos | null>> = Array.from({ length: FLOOR_ROWS }, () =>
    Array.from({ length: FLOOR_COLS }, () => null),
  );

  const queue: TilePos[] = [{ col: startCol, row: startRow }];
  visited[startRow][startCol] = true;

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.col === endCol && current.row === endRow) {
      // Reconstruct path (end -> start, then reverse)
      const path: TilePos[] = [];
      let node: TilePos | null = { col: endCol, row: endRow };
      while (node !== null && !(node.col === startCol && node.row === startRow)) {
        path.push(node);
        node = parent[node.row][node.col];
      }
      path.reverse();
      return path;
    }

    for (const d of BFS_DIRS) {
      const nc = current.col + d.dc;
      const nr = current.row + d.dr;

      if (nc < 0 || nc >= FLOOR_COLS || nr < 0 || nr >= FLOOR_ROWS) continue;
      if (visited[nr][nc]) continue;

      // Check walkability
      const isIgnored =
        ignoreCollisionAt !== undefined &&
        ignoreCollisionAt.col === nc &&
        ignoreCollisionAt.row === nr;

      if (!isIgnored && floor.collision[nr][nc]) continue;

      visited[nr][nc] = true;
      parent[nr][nc] = current;
      queue.push({ col: nc, row: nr });
    }
  }

  return []; // No path found
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/** Check if a tile is walkable (not blocked by collision) */
export function isWalkable(floor: FloorData, col: number, row: number): boolean {
  if (col < 0 || col >= FLOOR_COLS || row < 0 || row >= FLOOR_ROWS) {
    return false;
  }
  return !floor.collision[row][col];
}

/** Get the tile type at a given position */
export function getTileAt(floor: FloorData, col: number, row: number): TileType {
  if (col < 0 || col >= FLOOR_COLS || row < 0 || row >= FLOOR_ROWS) {
    return TileType.VOID;
  }
  return floor.tiles[row][col];
}

/**
 * Get a random walkable tile within the given bounds.
 * Defaults to the entire floor if no bounds are specified.
 */
export function getRandomWalkableTile(
  floor: FloorData,
  minCol = 0,
  minRow = 0,
  maxCol: number = FLOOR_COLS - 1,
  maxRow: number = FLOOR_ROWS - 1,
): TilePos {
  const candidates: TilePos[] = [];

  const c0 = Math.max(0, minCol);
  const r0 = Math.max(0, minRow);
  const c1 = Math.min(FLOOR_COLS - 1, maxCol);
  const r1 = Math.min(FLOOR_ROWS - 1, maxRow);

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!floor.collision[r][c]) {
        candidates.push({ col: c, row: r });
      }
    }
  }

  if (candidates.length === 0) {
    // Fallback: return center of floor — should never happen with valid maps
    return { col: Math.floor(FLOOR_COLS / 2), row: Math.floor(FLOOR_ROWS / 2) };
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}
