// ---------------------------------------------------------------------------
// Pixel Office V2 — Sprite Data
// ---------------------------------------------------------------------------

import type { SpriteData, CharacterPalette, CharacterSpriteSet } from "./types";

// ---------------------------------------------------------------------------
// Character Palettes
// ---------------------------------------------------------------------------

export const NAMED_PALETTES: Record<string, CharacterPalette> = {
  donna: { skin: "#F0C0A0", hair: "#CC4422", shirt: "#E07050", pants: "#8B4030", shoes: "#442020" },
  jarvis: { skin: "#E0C8A0", hair: "#223344", shirt: "#4090D0", pants: "#2A4060", shoes: "#1A2030" },
};

export const FALLBACK_PALETTES: CharacterPalette[] = [
  { skin: "#E8C8A8", hair: "#553322", shirt: "#9060C0", pants: "#503070", shoes: "#2A1840" },
  { skin: "#E0C0A0", hair: "#222222", shirt: "#40A060", pants: "#205030", shoes: "#102818" },
  { skin: "#E8D0B0", hair: "#AA4422", shirt: "#40A0A0", pants: "#205050", shoes: "#102828" },
  { skin: "#F0D0A0", hair: "#FFD700", shirt: "#C0A040", pants: "#806020", shoes: "#403010" },
];

export function getPalette(agentId: string, index: number): CharacterPalette {
  const key = agentId.toLowerCase();
  if (key in NAMED_PALETTES) return NAMED_PALETTES[key];
  return FALLBACK_PALETTES[index % FALLBACK_PALETTES.length];
}

export function lightenPalette(p: CharacterPalette): CharacterPalette {
  const lighten = (hex: string): string => {
    const c = hex.replace("#", "");
    const n = parseInt(c, 16);
    const r = Math.min(255, ((n >> 16) & 0xff) + 40);
    const g = Math.min(255, ((n >> 8) & 0xff) + 40);
    const b = Math.min(255, (n & 0xff) + 40);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };
  return {
    skin: lighten(p.skin),
    hair: lighten(p.hair),
    shirt: lighten(p.shirt),
    pants: lighten(p.pants),
    shoes: lighten(p.shoes),
  };
}

// ---------------------------------------------------------------------------
// Template Parser
// ---------------------------------------------------------------------------

type CharKey = "H" | "S" | "T" | "P" | "O" | "E" | "B" | "." | " ";

function parseCharTemplate(template: string, palette: CharacterPalette): SpriteData {
  const keyMap: Record<CharKey, string> = {
    H: palette.hair,
    S: palette.skin,
    T: palette.shirt,
    P: palette.pants,
    O: palette.shoes,
    E: "#FFFFFF",
    B: "#111111",
    ".": "",
    " ": "",
  };
  return template
    .split("\n")
    .filter((r) => r.length > 0)
    .map((row) => [...row].map((c) => keyMap[c as CharKey] ?? ""));
}

// ---------------------------------------------------------------------------
// Character Templates (16x16)
// Rows 0-1: hair, 2-3: head/face, 4: neck, 5-8: body+arms, 9-11: pants, 12-13: shoes, 14-15: empty
// ---------------------------------------------------------------------------

const FRONT_IDLE = `
......HHHH......
.....HHHHHH.....
.....SSSSS......
.....SEBBES.....
......SSSS......
.....TTTTTT.....
....TTTTTTTT....
....TTTTTTTT....
.....TTTTTT.....
.....PPPPPP.....
.....PP..PP.....
.....PP..PP.....
.....OO..OO.....
.....OO..OO.....
................
................
`;

const WALK_DOWN_1 = `
......HHHH......
.....HHHHHH.....
.....SSSSS......
.....SEBBES.....
......SSSS......
.....TTTTTT.....
....TTTTTTTT....
....TTTTTTTT....
.....TTTTTT.....
.....PPPPPP.....
......PP.PP.....
......PP.PP.....
......OO.OO.....
......OO..O.....
................
................
`;

const WALK_DOWN_2 = `
......HHHH......
.....HHHHHH.....
.....SSSSS......
.....SEBBES.....
......SSSS......
.....TTTTTT.....
....TTTTTTTT....
....TTTTTTTT....
.....TTTTTT.....
.....PPPPPP.....
.....PP.PP......
.....PP.PP......
.....OO.OO......
.....O..OO......
................
................
`;

const WALK_UP_1 = `
......HHHH......
.....HHHHHH.....
.....HHHHHH.....
.....HSSSSH.....
......SSSS......
.....TTTTTT.....
....TTTTTTTT....
....TTTTTTTT....
.....TTTTTT.....
.....PPPPPP.....
......PP.PP.....
......PP.PP.....
......OO.OO.....
......OO..O.....
................
................
`;

const WALK_UP_2 = `
......HHHH......
.....HHHHHH.....
.....HHHHHH.....
.....HSSSSH.....
......SSSS......
.....TTTTTT.....
....TTTTTTTT....
....TTTTTTTT....
.....TTTTTT.....
.....PPPPPP.....
.....PP.PP......
.....PP.PP......
.....OO.OO......
.....O..OO......
................
................
`;

const WALK_LEFT_1 = `
.....HHHH.......
.....HHHHH......
.....SSSSH......
.....SEBS.......
......SSS.......
.....TTTTT......
....TTTTTTT.....
....TTTTTTT.....
.....TTTTT......
......PPPPP.....
......PP.PP.....
.......P.PP.....
.......O.OO.....
.......O..O.....
................
................
`;

const WALK_LEFT_2 = `
.....HHHH.......
.....HHHHH......
.....SSSSH......
.....SEBS.......
......SSS.......
.....TTTTT......
....TTTTTTT.....
....TTTTTTT.....
.....TTTTT......
......PPPPP.....
.....PP..PP.....
.....PP...P.....
.....OO...O.....
.....O....O.....
................
................
`;

const WALK_RIGHT_1 = `
.......HHHH.....
......HHHHH.....
......HSSSS.....
.......SBES.....
.......SSS......
......TTTTT.....
.....TTTTTTT....
.....TTTTTTT....
......TTTTT.....
.....PPPPP......
.....PP.PP......
.....PP.P.......
.....OO.O.......
.....O..O.......
................
................
`;

const WALK_RIGHT_2 = `
.......HHHH.....
......HHHHH.....
......HSSSS.....
.......SBES.....
.......SSS......
......TTTTT.....
.....TTTTTTT....
.....TTTTTTT....
......TTTTT.....
.....PPPPP......
.....PP..PP.....
.....P...PP.....
.....O...OO.....
.....O....O.....
................
................
`;

// Typing: character seated facing up (toward monitor)
const TYPE_1 = `
......HHHH......
.....HHHHHH.....
.....HHHHHH.....
.....HSSSSH.....
......SSSS......
.....TTTTTT.....
...STTTTTTTTS...
...STTTTTTTTS...
.....TTTTTT.....
.....PPPPPP.....
.....PPPPPP.....
................
................
................
................
................
`;

const TYPE_2 = `
......HHHH......
.....HHHHHH.....
.....HHHHHH.....
.....HSSSSH.....
......SSSS......
.....TTTTTT.....
..STTTTTTTTTS...
..STTTTTTTTTS...
.....TTTTTT.....
.....PPPPPP.....
.....PPPPPP.....
................
................
................
................
................
`;

// Sleeping: head on desk, slumped forward
const SLEEP = `
................
................
................
......HHHH......
.....HHHHHH.....
.....SSSSHH.....
.....SSSSSS.....
...STTTTTTTS....
...STTTTTTTS....
.....TTTTTT.....
.....PPPPPP.....
.....PPPPPP.....
................
................
................
................
`;

export function buildCharacterSprites(palette: CharacterPalette): CharacterSpriteSet {
  return {
    front: parseCharTemplate(FRONT_IDLE, palette),
    walkDown: [
      parseCharTemplate(WALK_DOWN_1, palette),
      parseCharTemplate(WALK_DOWN_2, palette),
    ],
    walkUp: [
      parseCharTemplate(WALK_UP_1, palette),
      parseCharTemplate(WALK_UP_2, palette),
    ],
    walkLeft: [
      parseCharTemplate(WALK_LEFT_1, palette),
      parseCharTemplate(WALK_LEFT_2, palette),
    ],
    walkRight: [
      parseCharTemplate(WALK_RIGHT_1, palette),
      parseCharTemplate(WALK_RIGHT_2, palette),
    ],
    type: [parseCharTemplate(TYPE_1, palette), parseCharTemplate(TYPE_2, palette)],
    sleep: parseCharTemplate(SLEEP, palette),
  };
}

// ---------------------------------------------------------------------------
// Cat Sprites (8x8)
// ---------------------------------------------------------------------------

const CAT_BODY = "#E08040";
const CAT_STRIPE = "#C06020";
const CAT_BELLY = "#FFD0A0";
const CAT_EYE = "#44DD44";
const B = "#111111";
const _ = "";

export const CAT_SPRITES = {
  walkRight1: [
    [_, _, CAT_BODY, CAT_BODY, _, _, _, _],
    [_, CAT_BODY, CAT_STRIPE, CAT_BODY, CAT_BODY, _, _, _],
    [_, CAT_BODY, CAT_EYE, B, CAT_BODY, _, _, _],
    [_, CAT_BODY, CAT_BODY, CAT_BODY, CAT_BODY, CAT_BODY, _, _],
    [_, _, CAT_BELLY, CAT_BELLY, CAT_STRIPE, CAT_BODY, CAT_BODY, _],
    [_, _, CAT_BODY, _, CAT_BODY, _, CAT_BODY, _],
    [_, _, _, _, _, _, _, CAT_BODY],
    [_, _, _, _, _, _, _, _],
  ] as SpriteData,
  walkRight2: [
    [_, _, CAT_BODY, CAT_BODY, _, _, _, _],
    [_, CAT_BODY, CAT_STRIPE, CAT_BODY, CAT_BODY, _, _, _],
    [_, CAT_BODY, CAT_EYE, B, CAT_BODY, _, _, _],
    [_, CAT_BODY, CAT_BODY, CAT_BODY, CAT_BODY, CAT_BODY, _, _],
    [_, _, CAT_BELLY, CAT_BELLY, CAT_STRIPE, CAT_BODY, CAT_BODY, _],
    [_, _, _, CAT_BODY, _, CAT_BODY, _, _],
    [_, _, _, _, _, _, _, CAT_BODY],
    [_, _, _, _, _, _, _, _],
  ] as SpriteData,
  walkLeft1: [
    [_, _, _, _, CAT_BODY, CAT_BODY, _, _],
    [_, _, _, CAT_BODY, CAT_BODY, CAT_STRIPE, CAT_BODY, _],
    [_, _, _, CAT_BODY, B, CAT_EYE, CAT_BODY, _],
    [_, _, CAT_BODY, CAT_BODY, CAT_BODY, CAT_BODY, CAT_BODY, _],
    [_, CAT_BODY, CAT_BODY, CAT_STRIPE, CAT_BELLY, CAT_BELLY, _, _],
    [_, CAT_BODY, _, CAT_BODY, _, CAT_BODY, _, _],
    [CAT_BODY, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _],
  ] as SpriteData,
  walkLeft2: [
    [_, _, _, _, CAT_BODY, CAT_BODY, _, _],
    [_, _, _, CAT_BODY, CAT_BODY, CAT_STRIPE, CAT_BODY, _],
    [_, _, _, CAT_BODY, B, CAT_EYE, CAT_BODY, _],
    [_, _, CAT_BODY, CAT_BODY, CAT_BODY, CAT_BODY, CAT_BODY, _],
    [_, CAT_BODY, CAT_BODY, CAT_STRIPE, CAT_BELLY, CAT_BELLY, _, _],
    [_, _, CAT_BODY, _, CAT_BODY, _, _, _],
    [CAT_BODY, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _],
  ] as SpriteData,
  sit: [
    [_, _, CAT_BODY, CAT_BODY, _, _, _, _],
    [_, CAT_BODY, CAT_STRIPE, CAT_BODY, CAT_BODY, _, _, _],
    [_, CAT_BODY, CAT_EYE, B, CAT_BODY, _, _, _],
    [_, _, CAT_BODY, CAT_BODY, CAT_BODY, _, _, _],
    [_, _, CAT_BELLY, CAT_STRIPE, CAT_BODY, _, _, _],
    [_, CAT_BODY, CAT_BELLY, CAT_BELLY, CAT_BODY, _, _, _],
    [_, CAT_BODY, CAT_BODY, CAT_BODY, CAT_BODY, CAT_BODY, _, _],
    [_, _, _, _, _, _, _, _],
  ] as SpriteData,
  sleep: [
    [_, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _],
    [_, _, CAT_BODY, CAT_BODY, CAT_BODY, _, _, _],
    [_, CAT_BODY, CAT_STRIPE, CAT_STRIPE, CAT_BODY, CAT_BODY, _, _],
    [_, CAT_BODY, CAT_BELLY, CAT_BELLY, CAT_BELLY, CAT_BODY, _, _],
    [_, _, CAT_BODY, CAT_BODY, CAT_BODY, CAT_BODY, _, _],
    [_, _, _, _, _, _, CAT_BODY, _],
    [_, _, _, _, _, _, _, _],
  ] as SpriteData,
};

// ---------------------------------------------------------------------------
// Furniture Sprites
// ---------------------------------------------------------------------------

/** Build a desk sprite (3 tiles wide x 2 tiles tall = 48x32) */
export function buildDeskSprite(): SpriteData {
  const W = 48;
  const H = 32;
  const sprite: SpriteData = Array.from({ length: H }, () => Array(W).fill(""));
  const edge = "#8B6914";
  const top = "#A07828";
  const highlight = "#B8922E";
  const legColor = "#6B5010";
  const shadow = "#5A4010";

  // Desk surface
  for (let y = 4; y < 16; y++) {
    for (let x = 2; x < 46; x++) {
      sprite[y][x] = top;
    }
  }
  // Top edge highlight
  for (let x = 2; x < 46; x++) {
    sprite[4][x] = highlight;
    sprite[5][x] = highlight;
  }
  // Bottom edge
  for (let x = 2; x < 46; x++) {
    sprite[15][x] = edge;
  }
  // Side edges
  for (let y = 4; y < 16; y++) {
    sprite[y][2] = edge;
    sprite[y][3] = edge;
    sprite[y][44] = edge;
    sprite[y][45] = edge;
  }
  // Legs
  for (let y = 16; y < 28; y++) {
    sprite[y][4] = legColor;
    sprite[y][5] = legColor;
    sprite[y][42] = legColor;
    sprite[y][43] = legColor;
  }
  // Shadow under desk
  for (let x = 6; x < 42; x++) {
    sprite[27][x] = shadow;
  }

  return sprite;
}

/** Build a monitor sprite (16x16 placed on top of desk) */
export function buildMonitorSprite(): SpriteData {
  const W = 16;
  const H = 16;
  const sprite: SpriteData = Array.from({ length: H }, () => Array(W).fill(""));
  const frame = "#333333";
  const stand = "#444444";
  const base = "#555555";

  // Monitor frame
  for (let y = 0; y < 10; y++) {
    for (let x = 1; x < 15; x++) {
      sprite[y][x] = frame;
    }
  }
  // Screen area (inner, will be drawn dynamically)
  for (let y = 1; y < 9; y++) {
    for (let x = 2; x < 14; x++) {
      sprite[y][x] = "#1A2A3A";
    }
  }
  // Stand
  sprite[10][7] = stand;
  sprite[10][8] = stand;
  sprite[11][7] = stand;
  sprite[11][8] = stand;
  // Base
  for (let x = 5; x < 11; x++) {
    sprite[12][x] = base;
  }

  return sprite;
}

/** Build a chair sprite (12x12) */
export function buildChairSprite(): SpriteData {
  const sprite: SpriteData = Array.from({ length: 12 }, () => Array(12).fill(""));
  const seat = "#3A3050";
  const back = "#2A2040";
  const leg = "#222222";

  // Chair back
  for (let y = 0; y < 4; y++) {
    for (let x = 2; x < 10; x++) {
      sprite[y][x] = back;
    }
  }
  // Seat
  for (let y = 4; y < 7; y++) {
    for (let x = 1; x < 11; x++) {
      sprite[y][x] = seat;
    }
  }
  // Legs
  sprite[7][2] = leg;
  sprite[8][2] = leg;
  sprite[7][9] = leg;
  sprite[8][9] = leg;
  sprite[9][1] = leg;
  sprite[9][10] = leg;

  return sprite;
}

/** Build whiteboard sprite (5 tiles wide x 2 tiles tall = 80x32) */
export function buildWhiteboardSprite(): SpriteData {
  const W = 64;
  const H = 24;
  const sprite: SpriteData = Array.from({ length: H }, () => Array(W).fill(""));
  const board = "#C8C8D4";
  const border = "#8888AA";
  const text = "#667799";

  // Board background
  for (let y = 2; y < 20; y++) {
    for (let x = 2; x < 62; x++) {
      sprite[y][x] = board;
    }
  }
  // Border
  for (let x = 2; x < 62; x++) {
    sprite[2][x] = border;
    sprite[19][x] = border;
  }
  for (let y = 2; y < 20; y++) {
    sprite[y][2] = border;
    sprite[y][61] = border;
  }
  // Text lines
  for (let line = 0; line < 4; line++) {
    const lineLen = 30 + (line * 7) % 20;
    for (let x = 5; x < 5 + lineLen && x < 58; x++) {
      sprite[5 + line * 4][x] = text;
    }
  }

  return sprite;
}

/** Build coffee machine sprite (16x24) */
export function buildCoffeeMachineSprite(): SpriteData {
  const W = 16;
  const H = 24;
  const sprite: SpriteData = Array.from({ length: H }, () => Array(W).fill(""));
  const body = "#2A2A2A";
  const top = "#3A3A3A";
  const detail = "#555555";
  const redLight = "#CC3333";
  const nozzle = "#1A1A1A";

  // Machine body
  for (let y = 4; y < 22; y++) {
    for (let x = 2; x < 14; x++) {
      sprite[y][x] = body;
    }
  }
  // Top panel
  for (let y = 4; y < 8; y++) {
    for (let x = 2; x < 14; x++) {
      sprite[y][x] = top;
    }
  }
  // Nozzle
  sprite[12][7] = detail;
  sprite[12][8] = detail;
  sprite[13][7] = nozzle;
  sprite[13][8] = nozzle;
  sprite[14][7] = nozzle;
  sprite[14][8] = nozzle;
  // Cup area
  for (let x = 5; x < 11; x++) {
    sprite[17][x] = nozzle;
    sprite[18][x] = nozzle;
    sprite[19][x] = nozzle;
  }
  // Red indicator light
  sprite[6][12] = redLight;
  // Button
  sprite[9][11] = detail;
  sprite[9][12] = detail;

  return sprite;
}

/** Build fridge sprite (16x32) */
export function buildFridgeSprite(): SpriteData {
  const W = 16;
  const H = 32;
  const sprite: SpriteData = Array.from({ length: H }, () => Array(W).fill(""));
  const body = "#D0D0D8";
  const dark = "#A0A0A8";
  const handle = "#888890";
  const line = "#B0B0B8";

  // Body
  for (let y = 0; y < 30; y++) {
    for (let x = 1; x < 15; x++) {
      sprite[y][x] = body;
    }
  }
  // Dark edges
  for (let y = 0; y < 30; y++) {
    sprite[y][1] = dark;
    sprite[y][14] = dark;
  }
  for (let x = 1; x < 15; x++) {
    sprite[0][x] = dark;
    sprite[29][x] = dark;
  }
  // Division line (freezer/fridge)
  for (let x = 2; x < 14; x++) {
    sprite[10][x] = line;
  }
  // Handle
  for (let y = 12; y < 18; y++) {
    sprite[y][12] = handle;
    sprite[y][13] = handle;
  }
  for (let y = 3; y < 8; y++) {
    sprite[y][12] = handle;
    sprite[y][13] = handle;
  }

  return sprite;
}

/** Build microwave sprite (16x12) */
export function buildMicrowaveSprite(): SpriteData {
  const W = 16;
  const H = 12;
  const sprite: SpriteData = Array.from({ length: H }, () => Array(W).fill(""));
  const body = "#444450";
  const door = "#222230";
  const glass = "#1A2A3A";
  const btn = "#666670";

  // Body
  for (let y = 1; y < 11; y++) {
    for (let x = 1; x < 15; x++) {
      sprite[y][x] = body;
    }
  }
  // Door/window
  for (let y = 2; y < 9; y++) {
    for (let x = 2; x < 10; x++) {
      sprite[y][x] = door;
    }
  }
  for (let y = 3; y < 8; y++) {
    for (let x = 3; x < 9; x++) {
      sprite[y][x] = glass;
    }
  }
  // Buttons
  sprite[3][12] = btn;
  sprite[5][12] = btn;
  sprite[7][12] = btn;

  return sprite;
}

/** Build kitchen table sprite (32x20) */
export function buildKitchenTableSprite(): SpriteData {
  const W = 32;
  const H = 20;
  const sprite: SpriteData = Array.from({ length: H }, () => Array(W).fill(""));
  const top = "#7A5A2E";
  const edge = "#5A4020";
  const leg = "#4A3018";

  // Table top
  for (let y = 2; y < 8; y++) {
    for (let x = 1; x < 31; x++) {
      sprite[y][x] = top;
    }
  }
  // Edge
  for (let x = 1; x < 31; x++) {
    sprite[7][x] = edge;
  }
  // Legs
  for (let y = 8; y < 16; y++) {
    sprite[y][3] = leg;
    sprite[y][4] = leg;
    sprite[y][27] = leg;
    sprite[y][28] = leg;
  }

  return sprite;
}

/** Build server rack sprite (16x32) */
export function buildServerRackSprite(): SpriteData {
  const W = 16;
  const H = 32;
  const sprite: SpriteData = Array.from({ length: H }, () => Array(W).fill(""));
  const body = "#1A1A2A";
  const panel = "#222238";
  const vent = "#151525";
  const accent = "#2A2A40";

  // Body
  for (let y = 0; y < 30; y++) {
    for (let x = 1; x < 15; x++) {
      sprite[y][x] = body;
    }
  }
  // Panel sections
  for (let section = 0; section < 4; section++) {
    const sy = 2 + section * 7;
    for (let y = sy; y < sy + 5; y++) {
      for (let x = 2; x < 14; x++) {
        sprite[y][x] = panel;
      }
    }
    // Vent lines
    for (let x = 3; x < 13; x += 2) {
      sprite[sy + 2][x] = vent;
      sprite[sy + 3][x] = vent;
    }
    // Accent line at top of section
    for (let x = 2; x < 14; x++) {
      sprite[sy][x] = accent;
    }
  }

  return sprite;
}

/** Build couch sprite (48x20) */
export function buildCouchSprite(): SpriteData {
  const W = 48;
  const H = 20;
  const sprite: SpriteData = Array.from({ length: H }, () => Array(W).fill(""));
  const fabric = "#4A3060";
  const dark = "#3A2050";
  const cushion = "#5A4070";
  const leg = "#222222";

  // Back
  for (let y = 0; y < 8; y++) {
    for (let x = 2; x < 46; x++) {
      sprite[y][x] = dark;
    }
  }
  // Seat
  for (let y = 8; y < 14; y++) {
    for (let x = 0; x < 48; x++) {
      sprite[y][x] = fabric;
    }
  }
  // Cushion highlights
  for (let y = 9; y < 13; y++) {
    for (let x = 4; x < 20; x++) sprite[y][x] = cushion;
    for (let x = 24; x < 44; x++) sprite[y][x] = cushion;
  }
  // Arms
  for (let y = 4; y < 14; y++) {
    sprite[y][0] = dark;
    sprite[y][1] = dark;
    sprite[y][46] = dark;
    sprite[y][47] = dark;
  }
  // Legs
  sprite[14][2] = leg;
  sprite[15][2] = leg;
  sprite[14][45] = leg;
  sprite[15][45] = leg;

  return sprite;
}

/** Build bookshelf sprite (24x32) */
export function buildBookshelfSprite(): SpriteData {
  const W = 24;
  const H = 32;
  const sprite: SpriteData = Array.from({ length: H }, () => Array(W).fill(""));
  const wood = "#6B4226";
  const shelf = "#5A3620";
  const bookColors = ["#CC3333", "#3366CC", "#33AA33", "#CC9933", "#9933CC", "#CC6633"];

  // Frame
  for (let y = 0; y < 30; y++) {
    sprite[y][0] = wood;
    sprite[y][1] = wood;
    sprite[y][22] = wood;
    sprite[y][23] = wood;
  }
  for (let x = 0; x < 24; x++) {
    sprite[0][x] = wood;
    sprite[29][x] = wood;
  }

  // Shelves and books
  for (let shelfIdx = 0; shelfIdx < 3; shelfIdx++) {
    const shelfY = 9 + shelfIdx * 10;
    for (let x = 2; x < 22; x++) {
      sprite[shelfY][x] = shelf;
    }
    // Books on shelf
    let bx = 3;
    for (let bookIdx = 0; bookIdx < 6 && bx < 20; bookIdx++) {
      const bookW = 2 + (bookIdx % 2);
      const bookH = 5 + (bookIdx % 3);
      const bookColor = bookColors[bookIdx % bookColors.length];
      for (let y = shelfY - bookH; y < shelfY; y++) {
        for (let x = bx; x < bx + bookW && x < 21; x++) {
          sprite[y][x] = bookColor;
        }
      }
      bx += bookW + 1;
    }
  }

  return sprite;
}

/** Build plant sprite (12x20) */
export function buildPlantSprite(): SpriteData {
  const W = 12;
  const H = 20;
  const sprite: SpriteData = Array.from({ length: H }, () => Array(W).fill(""));
  const pot = "#6B4226";
  const potDark = "#5A3620";
  const soil = "#3E2415";
  const green = "#2E7D32";
  const light = "#4CAF50";

  // Pot
  for (let y = 12; y < 18; y++) {
    for (let x = 3; x < 9; x++) {
      sprite[y][x] = pot;
    }
  }
  // Pot rim
  for (let x = 2; x < 10; x++) {
    sprite[12][x] = potDark;
    sprite[13][x] = potDark;
  }
  // Soil
  for (let x = 3; x < 9; x++) {
    sprite[12][x] = soil;
  }
  // Leaves (bushy)
  const leafPositions = [
    [4, 4], [5, 3], [6, 3], [7, 4],
    [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5],
    [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6],
    [4, 7], [5, 7], [6, 7], [7, 7],
    [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8],
    [4, 9], [5, 9], [6, 9], [7, 9],
    [5, 10], [6, 10],
    [5, 11], [6, 11],
  ];
  for (const [lx, ly] of leafPositions) {
    sprite[ly][lx] = green;
  }
  // Highlights
  sprite[5][5] = light;
  sprite[5][6] = light;
  sprite[6][4] = light;
  sprite[7][6] = light;
  sprite[8][5] = light;

  return sprite;
}

/** Build pizza box sprite (10x6) */
export function buildPizzaBoxSprite(): SpriteData {
  const W = 10;
  const H = 6;
  const sprite: SpriteData = Array.from({ length: H }, () => Array(W).fill(""));
  const box = "#C8A060";
  const lid = "#B89050";
  const stripe = "#CC3333";

  for (let y = 1; y < 5; y++) {
    for (let x = 1; x < 9; x++) {
      sprite[y][x] = box;
    }
  }
  for (let x = 1; x < 9; x++) {
    sprite[1][x] = lid;
  }
  // Red stripe
  for (let x = 2; x < 8; x++) {
    sprite[2][x] = stripe;
  }

  return sprite;
}

/** Build post-it note sprite (5x5) */
export function buildPostItSprite(color: string): SpriteData {
  const sprite: SpriteData = Array.from({ length: 5 }, () => Array(5).fill(""));
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      sprite[y][x] = color;
    }
  }
  // Folded corner
  sprite[0][3] = "";
  return sprite;
}
