// ---------------------------------------------------------------------------
// Pixel Office V3 -- Pokemon Red Edition -- Sprite Data
// ---------------------------------------------------------------------------
// All sprites are programmatic (2D hex-color arrays). No external images.
// Aesthetic: Game Boy Color Pokemon Red indoor style -- chunky pixels,
// limited palettes, black outlines, muted but colorful.
// ---------------------------------------------------------------------------

import type {
  SpriteData,
  CharacterPalette,
  CharacterSpriteSet,
  CatSpriteSet,
} from "./types";
import { GBC } from "./types";

// ===== UTILITY =============================================================

/** Lighten every color in a palette by `amount` (0-255, default 40). */
export function lightenPalette(
  p: CharacterPalette,
  amount = 40,
): CharacterPalette {
  const lighten = (hex: string): string => {
    const c = hex.replace("#", "");
    const n = parseInt(c, 16);
    const r = Math.min(255, ((n >> 16) & 0xff) + amount);
    const g = Math.min(255, ((n >> 8) & 0xff) + amount);
    const b = Math.min(255, (n & 0xff) + amount);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };
  return {
    hair: lighten(p.hair),
    skin: lighten(p.skin),
    shirt: lighten(p.shirt),
    pants: lighten(p.pants),
    shoes: lighten(p.shoes),
    accent: lighten(p.accent),
  };
}

/** Create an empty sprite grid of given dimensions. */
function makeGrid(w: number, h: number): SpriteData {
  return Array.from({ length: h }, () => Array<string>(w).fill(""));
}

/** Fill a rectangle inside a sprite grid. */
function fillRect(
  sprite: SpriteData,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  for (let row = y; row < y + h && row < sprite.length; row++) {
    for (let col = x; col < x + w && col < sprite[row].length; col++) {
      if (row >= 0 && col >= 0) {
        sprite[row][col] = color;
      }
    }
  }
}

/** Set a single pixel. */
function setPixel(
  sprite: SpriteData,
  x: number,
  y: number,
  color: string,
): void {
  if (y >= 0 && y < sprite.length && x >= 0 && x < sprite[y].length) {
    sprite[y][x] = color;
  }
}

// ===== CHARACTER PALETTES ==================================================

export const GK_PALETTE: CharacterPalette = {
  hair: "#885530",
  skin: "#F0C8A0",
  shirt: "#3060C0",
  pants: "#203870",
  shoes: "#282828",
  accent: "#D03030", // red cap
};

export const DONNA_PALETTE: CharacterPalette = {
  hair: "#E07040",
  skin: "#F0C8A0",
  shirt: "#40A860",
  pants: "#206830",
  shoes: "#282828",
  accent: "#E07040", // matches hair
};

export const JARVIS_PALETTE: CharacterPalette = {
  hair: "#40A0D0",
  skin: "#F0C8A0",
  shirt: "#383848",
  pants: "#282838",
  shoes: "#181818",
  accent: "#40A0D0", // matches hair
};

export const SUB_AGENT_PALETTES: CharacterPalette[] = [
  {
    hair: "#553322",
    skin: "#E8C8A8",
    shirt: "#9060C0",
    pants: "#503070",
    shoes: "#2A1840",
    accent: "#B080E0",
  },
  {
    hair: "#222222",
    skin: "#E0C0A0",
    shirt: "#C0A040",
    pants: "#806020",
    shoes: "#403010",
    accent: "#E0C060",
  },
  {
    hair: "#AA4422",
    skin: "#E8D0B0",
    shirt: "#40A0A0",
    pants: "#205050",
    shoes: "#102828",
    accent: "#60C0C0",
  },
  {
    hair: "#FFD700",
    skin: "#F0D0A0",
    shirt: "#E08030",
    pants: "#A05820",
    shoes: "#503010",
    accent: "#FFE060",
  },
];

// ===== CHARACTER TEMPLATE SYSTEM ===========================================

// Template key:
// A = accent, H = hair, S = skin, T = shirt, P = pants
// O = shoes, E = eye white, B = black/outline, . = transparent

type CharKey = "A" | "H" | "S" | "T" | "P" | "O" | "E" | "B" | "." | " ";

function parseTemplate(template: string, palette: CharacterPalette): SpriteData {
  const keyMap: Record<CharKey, string> = {
    A: palette.accent,
    H: palette.hair,
    S: palette.skin,
    T: palette.shirt,
    P: palette.pants,
    O: palette.shoes,
    E: "#FFFFFF",
    B: GBC.black,
    ".": "",
    " ": "",
  };
  return template
    .split("\n")
    .filter((r) => r.length > 0)
    .map((row) => row.split("").map((c) => keyMap[c as CharKey] ?? ""));
}

// ---------------------------------------------------------------------------
// 16x16 CHARACTER TEMPLATES
// Pokemon Red style: black outline, chunky limbs, ~4 color body
// GK has a cap (accent A on top rows), others just hair
// ---------------------------------------------------------------------------

// ---------- FACING DOWN (toward camera) ----------

const DOWN_IDLE = `
....BBBBBB......
...BAAAAABB.....
...BAAAAABB.....
...BHHHHHHB.....
...BSEBBESB.....
...BBSSSSBB.....
....BSSSSB......
....BTTTTTB.....
...BTTTTTTTB....
...BTTTTTTTB....
....BTTTTB......
....BPPPPB......
....BPPPPB......
....BPBBPB......
....BOBBOB......
....BB..BB......
`;

const DOWN_WALK1 = `
....BBBBBB......
...BAAAAABB.....
...BAAAAABB.....
...BHHHHHHB.....
...BSEBBESB.....
...BBSSSSBB.....
....BSSSSB......
....BTTTTTB.....
...BTTTTTTTB....
...BTTTTTTTB....
....BTTTTB......
....BPPPPB......
.....BPPB.......
.....BPBBPB.....
.....BOBBOB.....
.....BB..BB.....
`;

const DOWN_WALK2 = `
....BBBBBB......
...BAAAAABB.....
...BAAAAABB.....
...BHHHHHHB.....
...BSEBBESB.....
...BBSSSSBB.....
....BSSSSB......
....BTTTTTB.....
...BTTTTTTTB....
...BTTTTTTTB....
....BTTTTB......
....BPPPPB......
...BPPB.........
...BPBBPB.......
...BOBBOB.......
...BB..BB.......
`;

// ---------- FACING UP (away from camera) ----------

const UP_IDLE = `
....BBBBBB......
...BHHHHHBB.....
...BHHHHHHB.....
...BHHHHHHB.....
...BHSSSHB......
....BSSSSB......
....BTTTTTB.....
...BTTTTTTTB....
...BTTTTTTTB....
....BTTTTB......
....BPPPPB......
....BPPPPB......
....BPBBPB......
....BOBBOB......
....BB..BB......
................
`;

const UP_WALK1 = `
....BBBBBB......
...BHHHHHBB.....
...BHHHHHHB.....
...BHHHHHHB.....
...BHSSSHB......
....BSSSSB......
....BTTTTTB.....
...BTTTTTTTB....
...BTTTTTTTB....
....BTTTTB......
....BPPPPB......
.....BPPB.......
.....BPBBPB.....
.....BOBBOB.....
.....BB..BB.....
................
`;

const UP_WALK2 = `
....BBBBBB......
...BHHHHHBB.....
...BHHHHHHB.....
...BHHHHHHB.....
...BHSSSHB......
....BSSSSB......
....BTTTTTB.....
...BTTTTTTTB....
...BTTTTTTTB....
....BTTTTB......
....BPPPPB......
...BPPB.........
...BPBBPB.......
...BOBBOB.......
...BB..BB.......
................
`;

// ---------- FACING LEFT ----------

const LEFT_IDLE = `
....BBBBB.......
...BAAAABB......
...BAAAAAB......
...BHHHHB.......
...BSEBSB......
...BBSSSB.......
....BSSB........
....BTTTB.......
...BTTTTTTB.....
...BTTTTTTB.....
....BTTTB.......
....BPPPB.......
....BPPPB.......
....BPBPB.......
....BOBOB.......
....BB.BB.......
`;

const LEFT_WALK1 = `
....BBBBB.......
...BAAAABB......
...BAAAAAB......
...BHHHHB.......
...BSEBSB......
...BBSSSB.......
....BSSB........
....BTTTB.......
...BTTTTTTB.....
...BTTTTTTB.....
....BTTTB.......
.....BPPB.......
.....BPPBB......
.....BPBBOB.....
.....BB..BB.....
................
`;

const LEFT_WALK2 = `
....BBBBB.......
...BAAAABB......
...BAAAAAB......
...BHHHHB.......
...BSEBSB......
...BBSSSB.......
....BSSB........
....BTTTB.......
...BTTTTTTB.....
...BTTTTTTB.....
....BTTTB.......
...BPPB.........
...BPPBB........
...BPBBOB.......
...BB..BB.......
................
`;

// ---------- FACING RIGHT ----------

const RIGHT_IDLE = `
.......BBBBB....
......BBAAAAB...
......BAAAAAB...
.......BHHHHB...
......BSBESB....
.......BSSSBB..
........BSSB....
.......BTTTB....
.....BTTTTTTB...
.....BTTTTTTB...
.......BTTTB....
.......BPPPB....
.......BPPPB....
.......BPBPB....
.......BOBOB....
.......BB.BB....
`;

const RIGHT_WALK1 = `
.......BBBBB....
......BBAAAAB...
......BAAAAAB...
.......BHHHHB...
......BSBESB....
.......BSSSBB..
........BSSB....
.......BTTTB....
.....BTTTTTTB...
.....BTTTTTTB...
.......BTTTB....
.......BPPB.....
......BBPPB.....
.....BOBBPB.....
.....BB..BB.....
................
`;

const RIGHT_WALK2 = `
.......BBBBB....
......BBAAAAB...
......BAAAAAB...
.......BHHHHB...
......BSBESB....
.......BSSSBB..
........BSSB....
.......BTTTB....
.....BTTTTTTB...
.....BTTTTTTB...
.......BTTTB....
.........BPPB...
........BBPPB...
.......BOBBPB...
.......BB..BB...
................
`;

// ---------- TYPING (seated, facing up toward monitor) ----------

const TYPE_1 = `
....BBBBBB......
...BHHHHHBB.....
...BHHHHHHB.....
...BHHHHHHB.....
...BHSSSHB......
....BSSSSB......
....BTTTTTB.....
..BSTTTTTTTTSB..
..BSTTTTTTTTSB..
....BTTTTTB.....
....BPPPPPB.....
....BPPPPPB.....
................
................
................
................
`;

const TYPE_2 = `
....BBBBBB......
...BHHHHHBB.....
...BHHHHHHB.....
...BHHHHHHB.....
...BHSSSHB......
....BSSSSB......
....BTTTTTB.....
.BSTTTTTTTTSB...
.BSTTTTTTTTSB...
....BTTTTTB.....
....BPPPPPB.....
....BPPPPPB.....
................
................
................
................
`;

// ---------- SLEEPING (head slumped on desk) ----------

const SLEEP = `
................
................
................
....BBBBBB......
...BHHHHHBB.....
...BHHHHHHB.....
...BSSSSHB......
...BSSSSSSB.....
..BSTTTTTTSB....
..BSTTTTTTSB....
....BTTTTTB.....
....BPPPPPB.....
....BPPPPPB.....
................
................
................
`;

// ===== BUILD CHARACTER SPRITES =============================================

export function buildCharacterSprites(
  palette: CharacterPalette,
): CharacterSpriteSet {
  return {
    down: [
      parseTemplate(DOWN_IDLE, palette),
      parseTemplate(DOWN_WALK1, palette),
      parseTemplate(DOWN_WALK2, palette),
    ],
    up: [
      parseTemplate(UP_IDLE, palette),
      parseTemplate(UP_WALK1, palette),
      parseTemplate(UP_WALK2, palette),
    ],
    left: [
      parseTemplate(LEFT_IDLE, palette),
      parseTemplate(LEFT_WALK1, palette),
      parseTemplate(LEFT_WALK2, palette),
    ],
    right: [
      parseTemplate(RIGHT_IDLE, palette),
      parseTemplate(RIGHT_WALK1, palette),
      parseTemplate(RIGHT_WALK2, palette),
    ],
    type: [
      parseTemplate(TYPE_1, palette),
      parseTemplate(TYPE_2, palette),
    ],
    sleep: parseTemplate(SLEEP, palette),
  };
}

// ===== CAT SPRITES (8x8) ==================================================

const C = "#E08040"; // cat body orange
const CS = "#C06020"; // cat stripe darker orange
const CB = "#FFD0A0"; // cat belly cream
const CE = "#44DD44"; // cat eye green
const BK = GBC.black; // outline
const _ = "";

export function buildCatSprites(): CatSpriteSet {
  const downIdle: SpriteData = [
    [_, _, BK, BK, BK, BK, _, _],
    [_, BK, C, CS, CS, C, BK, _],
    [_, BK, CE, C, C, CE, BK, _],
    [_, _, BK, C, C, BK, _, _],
    [_, BK, C, CB, CB, C, BK, _],
    [_, BK, C, CS, CS, C, BK, _],
    [_, _, BK, C, C, BK, _, _],
    [_, _, _, BK, BK, _, _, _],
  ];

  const downWalk: SpriteData = [
    [_, _, BK, BK, BK, BK, _, _],
    [_, BK, C, CS, CS, C, BK, _],
    [_, BK, CE, C, C, CE, BK, _],
    [_, _, BK, C, C, BK, _, _],
    [_, BK, C, CB, CB, C, BK, _],
    [_, BK, C, CS, CS, C, BK, _],
    [_, BK, _, BK, BK, _, BK, _],
    [_, _, _, _, _, _, _, _],
  ];

  const upIdle: SpriteData = [
    [_, _, BK, BK, BK, BK, _, _],
    [_, BK, C, CS, CS, C, BK, _],
    [_, BK, C, C, C, C, BK, _],
    [_, _, BK, C, C, BK, _, _],
    [_, BK, CS, C, C, CS, BK, _],
    [_, BK, C, CS, CS, C, BK, _],
    [_, _, BK, C, C, BK, _, _],
    [_, _, _, BK, BK, _, _, _],
  ];

  const upWalk: SpriteData = [
    [_, _, BK, BK, BK, BK, _, _],
    [_, BK, C, CS, CS, C, BK, _],
    [_, BK, C, C, C, C, BK, _],
    [_, _, BK, C, C, BK, _, _],
    [_, BK, CS, C, C, CS, BK, _],
    [_, BK, C, CS, CS, C, BK, _],
    [_, BK, _, BK, BK, _, BK, _],
    [_, _, _, _, _, _, _, _],
  ];

  const leftIdle: SpriteData = [
    [_, BK, BK, _, _, _, _, _],
    [BK, C, CS, BK, BK, _, _, _],
    [BK, CE, BK, C, C, BK, _, _],
    [_, BK, C, CB, C, BK, _, _],
    [_, BK, C, CS, C, C, BK, _],
    [_, _, BK, C, C, C, BK, _],
    [_, _, BK, _, _, BK, _, _],
    [_, _, _, _, _, _, _, _],
  ];

  const leftWalk: SpriteData = [
    [_, BK, BK, _, _, _, _, _],
    [BK, C, CS, BK, BK, _, _, _],
    [BK, CE, BK, C, C, BK, _, _],
    [_, BK, C, CB, C, BK, _, _],
    [_, BK, C, CS, C, C, BK, _],
    [_, _, BK, C, C, C, BK, _],
    [_, BK, _, _, _, _, BK, _],
    [BK, _, _, _, _, _, _, _],
  ];

  const rightIdle: SpriteData = [
    [_, _, _, _, _, BK, BK, _],
    [_, _, _, BK, BK, CS, C, BK],
    [_, _, BK, C, C, BK, CE, BK],
    [_, _, BK, C, CB, C, BK, _],
    [_, BK, C, C, CS, C, BK, _],
    [_, BK, C, C, C, BK, _, _],
    [_, _, BK, _, _, BK, _, _],
    [_, _, _, _, _, _, _, _],
  ];

  const rightWalk: SpriteData = [
    [_, _, _, _, _, BK, BK, _],
    [_, _, _, BK, BK, CS, C, BK],
    [_, _, BK, C, C, BK, CE, BK],
    [_, _, BK, C, CB, C, BK, _],
    [_, BK, C, C, CS, C, BK, _],
    [_, BK, C, C, C, BK, _, _],
    [_, BK, _, _, _, _, BK, _],
    [_, _, _, _, _, _, _, BK],
  ];

  const sit: SpriteData = [
    [_, _, BK, BK, BK, BK, _, _],
    [_, BK, C, CS, CS, C, BK, _],
    [_, BK, CE, C, C, CE, BK, _],
    [_, _, BK, C, C, BK, _, _],
    [_, BK, CB, CS, CS, CB, BK, _],
    [_, BK, C, CB, CB, C, BK, _],
    [_, BK, C, C, C, C, BK, _],
    [_, _, BK, BK, BK, BK, _, _],
  ];

  const sleep: SpriteData = [
    [_, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _],
    [_, _, BK, BK, BK, BK, _, _],
    [_, BK, CS, CS, CS, C, BK, _],
    [_, BK, CB, CB, CB, C, BK, _],
    [_, _, BK, C, C, C, BK, _],
    [_, _, _, _, _, _, BK, _],
    [_, _, _, _, _, _, _, _],
  ];

  return {
    down: [downIdle, downWalk],
    up: [upIdle, upWalk],
    left: [leftIdle, leftWalk],
    right: [rightIdle, rightWalk],
    sit,
    sleep,
  };
}

// ===== FURNITURE SPRITE BUILDERS ===========================================

// --- Desk: L-shaped, 32x24 ------------------------------------------------

export function buildDeskSprite(): SpriteData {
  const W = 32;
  const H = 24;
  const s = makeGrid(W, H);
  // Top surface
  fillRect(s, 1, 2, 30, 8, GBC.woodMed);
  fillRect(s, 1, 2, 30, 2, GBC.woodLight); // highlight
  fillRect(s, 1, 9, 30, 1, GBC.woodDark); // bottom edge
  // Side edges
  fillRect(s, 0, 2, 1, 8, GBC.woodDark);
  fillRect(s, 31, 2, 1, 8, GBC.woodDark);
  // Legs
  fillRect(s, 2, 10, 2, 10, GBC.woodDark);
  fillRect(s, 28, 10, 2, 10, GBC.woodDark);
  // Cross bar
  fillRect(s, 4, 18, 24, 1, GBC.woodDark);
  // L-extension (right side return)
  fillRect(s, 22, 4, 10, 6, GBC.woodMed);
  fillRect(s, 22, 4, 10, 2, GBC.woodLight);
  fillRect(s, 22, 9, 10, 1, GBC.woodDark);
  // Outline top
  for (let x = 0; x < W; x++) setPixel(s, x, 1, GBC.black);
  return s;
}

// --- Monitor: 12x10 -------------------------------------------------------

export function buildMonitorSprite(): SpriteData {
  const W = 12;
  const H = 10;
  const s = makeGrid(W, H);
  // Frame
  fillRect(s, 1, 0, 10, 7, GBC.metalVDark);
  // Screen
  fillRect(s, 2, 1, 8, 5, "#1A2840");
  // Stand
  fillRect(s, 5, 7, 2, 1, GBC.metalDark);
  // Base
  fillRect(s, 3, 8, 6, 1, GBC.metalDark);
  // Power LED
  setPixel(s, 6, 6, GBC.ledGreen);
  return s;
}

// --- Chair: 12x14 ---------------------------------------------------------

export function buildChairSprite(): SpriteData {
  const W = 12;
  const H = 14;
  const s = makeGrid(W, H);
  // Back rest
  fillRect(s, 2, 0, 8, 5, GBC.metalDark);
  fillRect(s, 3, 1, 6, 3, "#4A3060");
  // Seat
  fillRect(s, 1, 5, 10, 4, "#3A2050");
  fillRect(s, 2, 6, 8, 2, "#5A4070");
  // Center post
  fillRect(s, 5, 9, 2, 2, GBC.metalVDark);
  // Wheels
  setPixel(s, 2, 11, GBC.metalDark);
  setPixel(s, 5, 12, GBC.metalDark);
  setPixel(s, 6, 12, GBC.metalDark);
  setPixel(s, 9, 11, GBC.metalDark);
  // Outline
  for (let x = 1; x < 11; x++) setPixel(s, x, 0, GBC.black);
  return s;
}

// --- Plant: 14x16 ---------------------------------------------------------

export function buildPlantSprite(): SpriteData {
  const W = 14;
  const H = 16;
  const s = makeGrid(W, H);
  // Pot
  fillRect(s, 4, 10, 6, 5, GBC.woodMed);
  fillRect(s, 3, 10, 8, 2, GBC.woodDark);
  fillRect(s, 5, 10, 4, 1, "#3E2415"); // soil
  // Leaves
  fillRect(s, 4, 4, 6, 6, GBC.plantMed);
  fillRect(s, 3, 5, 8, 4, GBC.plantMed);
  fillRect(s, 5, 3, 4, 2, GBC.plantLight);
  // Highlights
  setPixel(s, 5, 5, GBC.plantLight);
  setPixel(s, 8, 6, GBC.plantLight);
  setPixel(s, 6, 4, GBC.plantLight);
  // Stem
  setPixel(s, 6, 9, GBC.plantDark);
  setPixel(s, 7, 9, GBC.plantDark);
  // Dark leaves
  setPixel(s, 3, 8, GBC.plantDark);
  setPixel(s, 10, 7, GBC.plantDark);
  return s;
}

// --- Couch: L-shaped, 48x24 -----------------------------------------------

export function buildCouchSprite(): SpriteData {
  const W = 48;
  const H = 24;
  const s = makeGrid(W, H);
  const fab = "#4A3060";
  const dk = "#3A2050";
  const cush = "#5A4070";
  // Back
  fillRect(s, 2, 2, 44, 8, dk);
  // Seat
  fillRect(s, 0, 10, 48, 6, fab);
  // Cushion highlights
  fillRect(s, 4, 11, 16, 4, cush);
  fillRect(s, 24, 11, 20, 4, cush);
  // Arms
  fillRect(s, 0, 6, 2, 10, dk);
  fillRect(s, 46, 6, 2, 10, dk);
  // Legs
  fillRect(s, 2, 16, 2, 2, GBC.metalVDark);
  fillRect(s, 44, 16, 2, 2, GBC.metalVDark);
  // Outline
  for (let x = 0; x < W; x++) setPixel(s, x, 1, GBC.black);
  return s;
}

// --- Table: 32x16 ---------------------------------------------------------

export function buildTableSprite(): SpriteData {
  const W = 32;
  const H = 16;
  const s = makeGrid(W, H);
  // Top surface
  fillRect(s, 1, 2, 30, 5, GBC.woodLight);
  fillRect(s, 1, 6, 30, 1, GBC.woodDark);
  // Highlight
  fillRect(s, 2, 2, 28, 1, GBC.cream);
  // Legs
  fillRect(s, 3, 7, 2, 7, GBC.woodDark);
  fillRect(s, 27, 7, 2, 7, GBC.woodDark);
  // Outline
  for (let x = 0; x < W; x++) setPixel(s, x, 1, GBC.black);
  return s;
}

// --- Coffee Machine: 14x18 ------------------------------------------------

export function buildCoffeeMachineSprite(): SpriteData {
  const W = 14;
  const H = 18;
  const s = makeGrid(W, H);
  // Body
  fillRect(s, 2, 2, 10, 14, GBC.metalVDark);
  // Top section
  fillRect(s, 2, 2, 10, 4, GBC.metalDark);
  // Nozzle
  fillRect(s, 6, 8, 2, 3, "#1A1A1A");
  // Cup area
  fillRect(s, 4, 12, 6, 3, "#1A1A1A");
  // Red indicator
  setPixel(s, 10, 4, GBC.ledRed);
  // Buttons
  setPixel(s, 10, 7, GBC.metalLight);
  setPixel(s, 10, 9, GBC.metalLight);
  // Outline
  for (let x = 2; x < 12; x++) setPixel(s, x, 1, GBC.black);
  return s;
}

// --- Fridge: 16x24 --------------------------------------------------------

export function buildFridgeSprite(): SpriteData {
  const W = 16;
  const H = 24;
  const s = makeGrid(W, H);
  // Body
  fillRect(s, 1, 0, 14, 22, GBC.white);
  // Edges
  fillRect(s, 1, 0, 1, 22, GBC.gray);
  fillRect(s, 14, 0, 1, 22, GBC.gray);
  fillRect(s, 1, 0, 14, 1, GBC.gray);
  fillRect(s, 1, 21, 14, 1, GBC.gray);
  // Freezer divider
  fillRect(s, 2, 8, 12, 1, GBC.metalLight);
  // Handle
  fillRect(s, 12, 10, 1, 5, GBC.metalDark);
  fillRect(s, 12, 2, 1, 4, GBC.metalDark);
  // Feet
  fillRect(s, 2, 22, 2, 1, GBC.metalVDark);
  fillRect(s, 12, 22, 2, 1, GBC.metalVDark);
  return s;
}

// --- Microwave: 14x12 -----------------------------------------------------

export function buildMicrowaveSprite(): SpriteData {
  const W = 14;
  const H = 12;
  const s = makeGrid(W, H);
  // Body
  fillRect(s, 1, 1, 12, 9, GBC.metalDark);
  // Door
  fillRect(s, 2, 2, 7, 7, GBC.metalVDark);
  // Window
  fillRect(s, 3, 3, 5, 5, "#1A2840");
  // Buttons
  setPixel(s, 11, 3, GBC.metalLight);
  setPixel(s, 11, 5, GBC.metalLight);
  setPixel(s, 11, 7, GBC.metalLight);
  // Outline
  for (let x = 1; x < 13; x++) setPixel(s, x, 0, GBC.black);
  return s;
}

// --- Printer: 16x14 -------------------------------------------------------

export function buildPrinterSprite(): SpriteData {
  const W = 16;
  const H = 14;
  const s = makeGrid(W, H);
  // Body
  fillRect(s, 1, 3, 14, 9, GBC.metalLight);
  // Top panel
  fillRect(s, 2, 3, 12, 3, GBC.gray);
  // Paper input slot
  fillRect(s, 4, 2, 8, 1, GBC.white);
  // Paper output
  fillRect(s, 5, 8, 6, 1, GBC.white);
  // Dark underside
  fillRect(s, 1, 11, 14, 1, GBC.metalDark);
  // Button
  setPixel(s, 13, 5, GBC.ledGreen);
  // Feet
  setPixel(s, 2, 12, GBC.metalVDark);
  setPixel(s, 13, 12, GBC.metalVDark);
  return s;
}

// --- Bookshelf: 24x28 -----------------------------------------------------

export function buildBookshelfSprite(): SpriteData {
  const W = 24;
  const H = 28;
  const s = makeGrid(W, H);
  const bookColors = [GBC.red, GBC.blue, GBC.plantDark, GBC.orange, GBC.purple, GBC.yellow];
  // Frame
  fillRect(s, 0, 0, 2, 28, GBC.woodDark);
  fillRect(s, 22, 0, 2, 28, GBC.woodDark);
  fillRect(s, 0, 0, 24, 1, GBC.woodDark);
  fillRect(s, 0, 27, 24, 1, GBC.woodDark);
  // Back panel
  fillRect(s, 2, 1, 20, 26, GBC.woodLight);
  // Three shelves
  for (let shelf = 0; shelf < 3; shelf++) {
    const sy = 8 + shelf * 9;
    fillRect(s, 2, sy, 20, 1, GBC.woodMed);
    // Books on each shelf
    let bx = 3;
    for (let bi = 0; bi < 5 && bx < 20; bi++) {
      const bw = 2 + (bi % 2);
      const bh = 4 + (bi % 3);
      const bc = bookColors[(shelf * 2 + bi) % bookColors.length];
      fillRect(s, bx, sy - bh, bw, bh, bc);
      bx += bw + 1;
    }
  }
  return s;
}

// --- Server Rack: 16x32 with LED spots ------------------------------------

export function buildServerRackSprite(): SpriteData {
  const W = 16;
  const H = 32;
  const s = makeGrid(W, H);
  const body = "#1A1A2A";
  const panel = "#222238";
  const vent = "#151525";
  const accent = "#2A2A40";
  // Body
  fillRect(s, 1, 0, 14, 30, body);
  // 4 panel sections
  for (let sec = 0; sec < 4; sec++) {
    const sy = 2 + sec * 7;
    fillRect(s, 2, sy, 12, 5, panel);
    fillRect(s, 2, sy, 12, 1, accent);
    // Vent lines
    for (let x = 3; x < 13; x += 2) {
      setPixel(s, x, sy + 2, vent);
      setPixel(s, x, sy + 3, vent);
    }
    // LEDs (2 per section)
    setPixel(s, 13, sy + 1, GBC.ledGreen);
    setPixel(s, 13, sy + 3, GBC.ledYellow);
  }
  // Outline
  fillRect(s, 0, 0, 1, 30, GBC.black);
  fillRect(s, 15, 0, 1, 30, GBC.black);
  fillRect(s, 0, 0, 16, 1, GBC.black);
  return s;
}

// --- Arcade Machine: 16x28 ------------------------------------------------

export function buildArcadeMachineSprite(): SpriteData {
  const W = 16;
  const H = 28;
  const s = makeGrid(W, H);
  // Cabinet body
  fillRect(s, 2, 2, 12, 24, GBC.metalVDark);
  // Marquee (top)
  fillRect(s, 3, 2, 10, 4, GBC.red);
  fillRect(s, 5, 3, 6, 2, GBC.yellow);
  // Screen
  fillRect(s, 3, 7, 10, 8, "#1A2840");
  // Screen content hint
  fillRect(s, 5, 9, 2, 2, GBC.ledGreen);
  setPixel(s, 9, 10, GBC.red);
  setPixel(s, 10, 11, GBC.yellow);
  // Control panel
  fillRect(s, 3, 16, 10, 4, GBC.metalDark);
  // Joystick
  setPixel(s, 5, 17, GBC.metalLight);
  setPixel(s, 5, 16, GBC.metalLight);
  // Buttons
  setPixel(s, 9, 17, GBC.red);
  setPixel(s, 11, 17, GBC.blue);
  // Coin slot area
  fillRect(s, 6, 21, 4, 1, GBC.metalDark);
  setPixel(s, 7, 22, GBC.yellow);
  // Outline
  for (let y = 2; y < 26; y++) {
    setPixel(s, 1, y, GBC.black);
    setPixel(s, 14, y, GBC.black);
  }
  for (let x = 2; x < 14; x++) setPixel(s, x, 1, GBC.black);
  return s;
}

// --- Projector: ceiling-mounted screen, 32x24 ------------------------------

export function buildProjectorSprite(): SpriteData {
  const W = 32;
  const H = 24;
  const s = makeGrid(W, H);
  // Mounting bar
  fillRect(s, 14, 0, 4, 2, GBC.metalDark);
  // Screen frame
  fillRect(s, 1, 2, 30, 20, GBC.white);
  fillRect(s, 0, 2, 1, 20, GBC.metalDark);
  fillRect(s, 31, 2, 1, 20, GBC.metalDark);
  fillRect(s, 0, 2, 32, 1, GBC.metalDark);
  fillRect(s, 0, 21, 32, 1, GBC.metalDark);
  // Screen interior
  fillRect(s, 2, 3, 28, 17, GBC.cream);
  // Light spot hint
  fillRect(s, 10, 8, 12, 6, GBC.white);
  return s;
}

// --- Whiteboard: 32x20 ----------------------------------------------------

export function buildWhiteboardSprite(): SpriteData {
  const W = 32;
  const H = 20;
  const s = makeGrid(W, H);
  // Board
  fillRect(s, 1, 1, 30, 16, GBC.white);
  // Border
  fillRect(s, 0, 0, 32, 1, GBC.metalDark);
  fillRect(s, 0, 17, 32, 1, GBC.metalDark);
  fillRect(s, 0, 0, 1, 18, GBC.metalDark);
  fillRect(s, 31, 0, 1, 18, GBC.metalDark);
  // Text lines (marker scribbles)
  fillRect(s, 3, 4, 18, 1, GBC.blue);
  fillRect(s, 3, 7, 22, 1, GBC.red);
  fillRect(s, 3, 10, 14, 1, GBC.blue);
  fillRect(s, 3, 13, 20, 1, GBC.plantDark);
  // Marker tray
  fillRect(s, 4, 18, 24, 2, GBC.metalLight);
  setPixel(s, 6, 18, GBC.red);
  setPixel(s, 10, 18, GBC.blue);
  setPixel(s, 14, 18, GBC.black);
  return s;
}

// --- TV: wall-mounted, 24x16 ----------------------------------------------

export function buildTVSprite(): SpriteData {
  const W = 24;
  const H = 16;
  const s = makeGrid(W, H);
  // Frame
  fillRect(s, 0, 1, 24, 13, GBC.metalVDark);
  // Screen
  fillRect(s, 1, 2, 22, 11, "#1A2840");
  // Mount bracket
  fillRect(s, 10, 0, 4, 1, GBC.metalDark);
  // Power LED
  setPixel(s, 12, 13, GBC.ledGreen);
  // Screen content
  fillRect(s, 4, 4, 8, 4, GBC.blue);
  fillRect(s, 14, 5, 6, 3, GBC.waterLight);
  return s;
}

// --- Bean Bag: 16x12 ------------------------------------------------------

export function buildBeanBagSprite(): SpriteData {
  const W = 16;
  const H = 12;
  const s = makeGrid(W, H);
  const color = "#C87878";
  const dark = "#A85858";
  // Blob shape
  fillRect(s, 3, 3, 10, 7, color);
  fillRect(s, 2, 4, 12, 5, color);
  fillRect(s, 4, 2, 8, 2, color);
  // Shadow/fold
  fillRect(s, 4, 7, 8, 2, dark);
  fillRect(s, 3, 8, 2, 1, dark);
  // Outline (bottom curve)
  for (let x = 3; x < 13; x++) setPixel(s, x, 10, GBC.black);
  setPixel(s, 2, 9, GBC.black);
  setPixel(s, 13, 9, GBC.black);
  return s;
}

// --- Bench: park bench, 24x16 ---------------------------------------------

export function buildBenchSprite(): SpriteData {
  const W = 24;
  const H = 16;
  const s = makeGrid(W, H);
  // Back rest slats
  fillRect(s, 2, 2, 20, 2, GBC.woodLight);
  fillRect(s, 2, 5, 20, 2, GBC.woodLight);
  // Seat
  fillRect(s, 1, 8, 22, 3, GBC.woodMed);
  fillRect(s, 1, 8, 22, 1, GBC.woodLight);
  // Legs (iron/metal)
  fillRect(s, 3, 11, 2, 4, GBC.metalVDark);
  fillRect(s, 19, 11, 2, 4, GBC.metalVDark);
  // Arm rests
  fillRect(s, 1, 4, 2, 7, GBC.metalDark);
  fillRect(s, 21, 4, 2, 7, GBC.metalDark);
  return s;
}

// --- Tree: small indoor/outdoor tree, 20x28 --------------------------------

export function buildTreeSprite(): SpriteData {
  const W = 20;
  const H = 28;
  const s = makeGrid(W, H);
  // Trunk
  fillRect(s, 8, 16, 4, 10, GBC.woodDark);
  fillRect(s, 9, 16, 2, 10, GBC.woodMed);
  // Canopy (layered circles)
  fillRect(s, 4, 2, 12, 14, GBC.plantMed);
  fillRect(s, 2, 4, 16, 10, GBC.plantMed);
  fillRect(s, 6, 0, 8, 4, GBC.plantMed);
  // Highlights
  fillRect(s, 6, 3, 4, 3, GBC.plantLight);
  fillRect(s, 3, 7, 3, 2, GBC.plantLight);
  fillRect(s, 13, 5, 3, 2, GBC.plantLight);
  // Dark spots
  setPixel(s, 5, 10, GBC.plantDark);
  setPixel(s, 12, 12, GBC.plantDark);
  setPixel(s, 8, 6, GBC.plantDark);
  // Ground shadow
  fillRect(s, 5, 26, 10, 1, GBC.woodDark);
  return s;
}

// --- Antenna: satellite dish, 16x24 ----------------------------------------

export function buildAntennaSprite(): SpriteData {
  const W = 16;
  const H = 24;
  const s = makeGrid(W, H);
  // Pole
  fillRect(s, 7, 8, 2, 14, GBC.metalDark);
  // Base
  fillRect(s, 4, 20, 8, 2, GBC.metalDark);
  fillRect(s, 5, 22, 6, 1, GBC.metalVDark);
  // Dish (parabolic curve approximation)
  fillRect(s, 2, 2, 12, 2, GBC.metalLight);
  fillRect(s, 1, 4, 14, 2, GBC.gray);
  fillRect(s, 3, 6, 10, 2, GBC.metalLight);
  // Feed horn
  setPixel(s, 8, 3, GBC.metalVDark);
  // Signal dot
  setPixel(s, 8, 1, GBC.ledGreen);
  return s;
}

// --- Solar Panel: 24x12 ---------------------------------------------------

export function buildSolarPanelSprite(): SpriteData {
  const W = 24;
  const H = 12;
  const s = makeGrid(W, H);
  // Panel frame
  fillRect(s, 0, 1, 24, 8, GBC.metalDark);
  // Solar cells (dark blue grid)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      fillRect(s, 1 + col * 5, 2 + row * 3, 4, 2, GBC.waterDark);
    }
  }
  // Grid lines (silver)
  for (let x = 0; x < 24; x += 5) {
    fillRect(s, x, 1, 1, 8, GBC.metalLight);
  }
  // Stand legs
  fillRect(s, 4, 9, 2, 3, GBC.metalVDark);
  fillRect(s, 18, 9, 2, 3, GBC.metalVDark);
  return s;
}

// --- Bird Bath: 12x16 -----------------------------------------------------

export function buildBirdBathSprite(): SpriteData {
  const W = 12;
  const H = 16;
  const s = makeGrid(W, H);
  // Bowl
  fillRect(s, 1, 3, 10, 3, GBC.gray);
  fillRect(s, 2, 4, 8, 1, GBC.waterLight);
  // Pedestal
  fillRect(s, 4, 6, 4, 8, GBC.gray);
  fillRect(s, 5, 6, 2, 8, GBC.metalLight);
  // Base
  fillRect(s, 2, 14, 8, 2, GBC.metalDark);
  // Water shimmer
  setPixel(s, 4, 4, GBC.white);
  return s;
}

// --- Garden Bed: 24x10 ----------------------------------------------------

export function buildGardenBedSprite(): SpriteData {
  const W = 24;
  const H = 10;
  const s = makeGrid(W, H);
  // Wooden border
  fillRect(s, 0, 4, 24, 6, GBC.woodMed);
  fillRect(s, 1, 5, 22, 4, GBC.woodDark);
  // Soil
  fillRect(s, 1, 5, 22, 3, "#3E2415");
  // Flowers
  setPixel(s, 3, 3, GBC.red);
  setPixel(s, 3, 4, GBC.plantMed);
  setPixel(s, 7, 2, GBC.yellow);
  setPixel(s, 7, 3, GBC.plantMed);
  setPixel(s, 11, 3, GBC.pink);
  setPixel(s, 11, 4, GBC.plantMed);
  setPixel(s, 15, 2, GBC.orange);
  setPixel(s, 15, 3, GBC.plantMed);
  setPixel(s, 19, 3, GBC.purple);
  setPixel(s, 19, 4, GBC.plantMed);
  // Leaves
  setPixel(s, 4, 4, GBC.plantLight);
  setPixel(s, 8, 3, GBC.plantLight);
  setPixel(s, 16, 3, GBC.plantLight);
  return s;
}

// --- Sink: kitchen sink, 16x14 ---------------------------------------------

export function buildSinkSprite(): SpriteData {
  const W = 16;
  const H = 14;
  const s = makeGrid(W, H);
  // Counter top
  fillRect(s, 0, 0, 16, 4, GBC.metalLight);
  // Basin
  fillRect(s, 2, 1, 12, 3, GBC.gray);
  fillRect(s, 3, 2, 10, 1, GBC.waterLight);
  // Faucet
  fillRect(s, 7, 0, 2, 1, GBC.metalDark);
  setPixel(s, 7, 0, GBC.metalVDark);
  // Cabinet below
  fillRect(s, 0, 4, 16, 9, GBC.woodMed);
  fillRect(s, 1, 5, 6, 7, GBC.woodLight);
  fillRect(s, 9, 5, 6, 7, GBC.woodLight);
  // Handles
  setPixel(s, 6, 8, GBC.metalDark);
  setPixel(s, 10, 8, GBC.metalDark);
  // Bottom edge
  fillRect(s, 0, 13, 16, 1, GBC.woodDark);
  return s;
}

// --- Water Cooler: 10x18 --------------------------------------------------

export function buildWaterCoolerSprite(): SpriteData {
  const W = 10;
  const H = 18;
  const s = makeGrid(W, H);
  // Water bottle (top)
  fillRect(s, 3, 0, 4, 6, GBC.waterLight);
  fillRect(s, 4, 1, 2, 4, GBC.waterDark);
  // Body
  fillRect(s, 2, 6, 6, 8, GBC.gray);
  fillRect(s, 2, 6, 6, 1, GBC.metalLight);
  // Taps
  setPixel(s, 2, 9, GBC.blue);
  setPixel(s, 7, 9, GBC.red);
  // Drip tray
  fillRect(s, 2, 12, 6, 1, GBC.metalDark);
  // Legs
  fillRect(s, 2, 14, 2, 3, GBC.metalVDark);
  fillRect(s, 6, 14, 2, 3, GBC.metalVDark);
  return s;
}

// --- Trash Can: 10x14 -----------------------------------------------------

export function buildTrashCanSprite(): SpriteData {
  const W = 10;
  const H = 14;
  const s = makeGrid(W, H);
  // Lid
  fillRect(s, 1, 0, 8, 2, GBC.metalDark);
  fillRect(s, 4, 0, 2, 1, GBC.metalLight); // handle
  // Body (tapered)
  fillRect(s, 1, 2, 8, 10, GBC.metalDark);
  fillRect(s, 2, 3, 6, 8, GBC.gray);
  // Vertical lines
  for (let y = 3; y < 11; y += 2) {
    setPixel(s, 3, y, GBC.metalDark);
    setPixel(s, 6, y, GBC.metalDark);
  }
  // Base
  fillRect(s, 1, 12, 8, 1, GBC.metalVDark);
  return s;
}

// --- Secret Desk: glowing desk, 24x20 -------------------------------------

export function buildSecretDeskSprite(): SpriteData {
  const W = 24;
  const H = 20;
  const s = makeGrid(W, H);
  // Desk surface (dark with glow)
  fillRect(s, 1, 2, 22, 8, GBC.metalVDark);
  fillRect(s, 2, 3, 20, 2, "#1A2848"); // dark blue surface
  // Glow edge
  fillRect(s, 1, 2, 22, 1, GBC.purple);
  fillRect(s, 0, 3, 1, 6, GBC.purple);
  fillRect(s, 23, 3, 1, 6, GBC.purple);
  fillRect(s, 1, 9, 22, 1, GBC.purple);
  // Legs
  fillRect(s, 2, 10, 2, 8, GBC.metalVDark);
  fillRect(s, 20, 10, 2, 8, GBC.metalVDark);
  // Glow spots on surface
  setPixel(s, 6, 4, GBC.ledGreen);
  setPixel(s, 12, 3, GBC.ledGreen);
  setPixel(s, 18, 4, GBC.ledGreen);
  // Cross bar
  fillRect(s, 4, 16, 16, 1, GBC.metalVDark);
  return s;
}

// --- Pita Poster: wall poster, 14x18 --------------------------------------

export function buildPitaPosterSprite(): SpriteData {
  const W = 14;
  const H = 18;
  const s = makeGrid(W, H);
  // Paper background
  fillRect(s, 1, 1, 12, 16, GBC.cream);
  // Border
  fillRect(s, 0, 0, 14, 1, GBC.woodDark);
  fillRect(s, 0, 17, 14, 1, GBC.woodDark);
  fillRect(s, 0, 0, 1, 18, GBC.woodDark);
  fillRect(s, 13, 0, 1, 18, GBC.woodDark);
  // Pita bread circle (golden brown)
  fillRect(s, 4, 5, 6, 6, GBC.orange);
  fillRect(s, 3, 6, 8, 4, GBC.orange);
  fillRect(s, 5, 4, 4, 1, GBC.orange);
  fillRect(s, 5, 11, 4, 1, GBC.orange);
  // Highlight on pita
  setPixel(s, 5, 6, GBC.yellow);
  setPixel(s, 6, 7, GBC.yellow);
  // Text line at bottom
  fillRect(s, 3, 14, 8, 1, GBC.red);
  fillRect(s, 4, 15, 6, 1, GBC.woodDark);
  return s;
}

// --- Welcome Mat: floor mat, 24x8 -----------------------------------------

export function buildWelcomeMatSprite(): SpriteData {
  const W = 24;
  const H = 8;
  const s = makeGrid(W, H);
  // Mat body
  fillRect(s, 0, 0, 24, 8, "#806040");
  // Border stripe
  fillRect(s, 0, 0, 24, 1, "#604020");
  fillRect(s, 0, 7, 24, 1, "#604020");
  fillRect(s, 0, 0, 1, 8, "#604020");
  fillRect(s, 23, 0, 1, 8, "#604020");
  // Text pattern (WELCOME implied via pixel pattern)
  fillRect(s, 3, 3, 2, 2, GBC.cream);
  fillRect(s, 7, 3, 2, 2, GBC.cream);
  fillRect(s, 11, 3, 2, 2, GBC.cream);
  fillRect(s, 15, 3, 2, 2, GBC.cream);
  fillRect(s, 19, 3, 2, 2, GBC.cream);
  return s;
}

// --- AC Unit: wall-mounted, 20x16 -----------------------------------------

export function buildACUnitSprite(): SpriteData {
  const W = 20;
  const H = 16;
  const s = makeGrid(W, H);
  // Body
  fillRect(s, 0, 2, 20, 10, GBC.white);
  // Top edge
  fillRect(s, 0, 2, 20, 1, GBC.gray);
  // Vent slats
  for (let y = 5; y < 11; y += 2) {
    fillRect(s, 2, y, 16, 1, GBC.gray);
  }
  // Side edges
  fillRect(s, 0, 2, 1, 10, GBC.metalLight);
  fillRect(s, 19, 2, 1, 10, GBC.metalLight);
  // LED indicator
  setPixel(s, 17, 3, GBC.ledGreen);
  // Bottom drip edge
  fillRect(s, 0, 12, 20, 1, GBC.metalDark);
  // Wall mount
  fillRect(s, 3, 0, 3, 2, GBC.metalDark);
  fillRect(s, 14, 0, 3, 2, GBC.metalDark);
  return s;
}

// --- Caution Sign: 10x14 --------------------------------------------------

export function buildCautionSignSprite(): SpriteData {
  const W = 10;
  const H = 14;
  const s = makeGrid(W, H);
  // Triangle sign
  fillRect(s, 4, 0, 2, 1, GBC.yellow);
  fillRect(s, 3, 1, 4, 1, GBC.yellow);
  fillRect(s, 2, 2, 6, 1, GBC.yellow);
  fillRect(s, 1, 3, 8, 1, GBC.yellow);
  fillRect(s, 0, 4, 10, 2, GBC.yellow);
  // Exclamation mark
  setPixel(s, 4, 1, GBC.black);
  setPixel(s, 5, 1, GBC.black);
  setPixel(s, 4, 2, GBC.black);
  setPixel(s, 5, 2, GBC.black);
  setPixel(s, 4, 4, GBC.black);
  setPixel(s, 5, 4, GBC.black);
  // Pole
  fillRect(s, 4, 6, 2, 7, GBC.metalDark);
  // Base
  fillRect(s, 2, 12, 6, 2, GBC.metalDark);
  return s;
}

// --- Fruit Bowl: small, 10x8 ----------------------------------------------

export function buildFruitBowlSprite(): SpriteData {
  const W = 10;
  const H = 8;
  const s = makeGrid(W, H);
  // Bowl
  fillRect(s, 1, 4, 8, 3, GBC.cream);
  fillRect(s, 2, 3, 6, 1, GBC.cream);
  fillRect(s, 2, 7, 6, 1, GBC.woodMed);
  // Fruits
  setPixel(s, 3, 2, GBC.red); // apple
  setPixel(s, 4, 3, GBC.red);
  setPixel(s, 5, 2, GBC.yellow); // banana
  setPixel(s, 6, 2, GBC.yellow);
  setPixel(s, 7, 3, GBC.orange); // orange
  setPixel(s, 4, 1, GBC.plantDark); // stem
  return s;
}

// --- Rug: conference room, 48x32 ------------------------------------------

export function buildRugSprite(): SpriteData {
  const W = 48;
  const H = 32;
  const s = makeGrid(W, H);
  // Main rug body
  fillRect(s, 0, 0, 48, 32, GBC.carpetRed);
  // Border
  fillRect(s, 0, 0, 48, 2, GBC.carpetLight);
  fillRect(s, 0, 30, 48, 2, GBC.carpetLight);
  fillRect(s, 0, 0, 2, 32, GBC.carpetLight);
  fillRect(s, 46, 0, 2, 32, GBC.carpetLight);
  // Inner border
  fillRect(s, 4, 4, 40, 1, "#8A4848");
  fillRect(s, 4, 27, 40, 1, "#8A4848");
  fillRect(s, 4, 4, 1, 24, "#8A4848");
  fillRect(s, 43, 4, 1, 24, "#8A4848");
  // Center diamond pattern
  fillRect(s, 21, 13, 6, 6, GBC.carpetLight);
  fillRect(s, 22, 12, 4, 1, GBC.carpetLight);
  fillRect(s, 22, 19, 4, 1, GBC.carpetLight);
  fillRect(s, 20, 15, 1, 2, GBC.carpetLight);
  fillRect(s, 27, 15, 1, 2, GBC.carpetLight);
  return s;
}

// --- Clock: wall clock, 12x12 ---------------------------------------------

export function buildClockSprite(): SpriteData {
  const W = 12;
  const H = 12;
  const s = makeGrid(W, H);
  // Circle face
  fillRect(s, 3, 0, 6, 1, GBC.cream);
  fillRect(s, 1, 1, 10, 1, GBC.cream);
  fillRect(s, 0, 2, 12, 8, GBC.cream);
  fillRect(s, 1, 10, 10, 1, GBC.cream);
  fillRect(s, 3, 11, 6, 1, GBC.cream);
  // Outline
  fillRect(s, 3, 0, 6, 1, GBC.metalDark);
  setPixel(s, 2, 1, GBC.metalDark);
  setPixel(s, 9, 1, GBC.metalDark);
  setPixel(s, 1, 2, GBC.metalDark);
  setPixel(s, 10, 2, GBC.metalDark);
  setPixel(s, 0, 3, GBC.metalDark);
  setPixel(s, 11, 3, GBC.metalDark);
  setPixel(s, 0, 8, GBC.metalDark);
  setPixel(s, 11, 8, GBC.metalDark);
  setPixel(s, 1, 9, GBC.metalDark);
  setPixel(s, 10, 9, GBC.metalDark);
  setPixel(s, 2, 10, GBC.metalDark);
  setPixel(s, 9, 10, GBC.metalDark);
  fillRect(s, 3, 11, 6, 1, GBC.metalDark);
  // Hour marks (12, 3, 6, 9)
  setPixel(s, 5, 1, GBC.black); // 12
  setPixel(s, 6, 1, GBC.black);
  setPixel(s, 10, 5, GBC.black); // 3
  setPixel(s, 10, 6, GBC.black);
  setPixel(s, 5, 10, GBC.black); // 6
  setPixel(s, 6, 10, GBC.black);
  setPixel(s, 1, 5, GBC.black); // 9
  setPixel(s, 1, 6, GBC.black);
  // Hands (static position ~10:10)
  setPixel(s, 5, 5, GBC.black); // center
  setPixel(s, 6, 5, GBC.black);
  setPixel(s, 5, 6, GBC.black);
  setPixel(s, 6, 6, GBC.black);
  // Hour hand (pointing up-left ~10)
  setPixel(s, 4, 4, GBC.black);
  setPixel(s, 3, 3, GBC.black);
  // Minute hand (pointing up-right ~2)
  setPixel(s, 7, 4, GBC.black);
  setPixel(s, 8, 3, GBC.black);
  return s;
}

// --- Stairs: tile overlay, 16x16 ------------------------------------------

export function buildStairsSprite(): SpriteData {
  const W = 16;
  const H = 16;
  const s = makeGrid(W, H);
  // Stair steps (4 steps)
  for (let step = 0; step < 4; step++) {
    const y = step * 4;
    const x = step * 2;
    fillRect(s, x, y, 16 - x, 4, GBC.woodMed);
    fillRect(s, x, y, 16 - x, 1, GBC.woodLight);
    fillRect(s, x, y + 3, 16 - x, 1, GBC.woodDark);
  }
  // Side railing
  fillRect(s, 0, 0, 1, 16, GBC.metalDark);
  return s;
}

// --- Railing: rooftop railing, 16x16 --------------------------------------

export function buildRailingSprite(): SpriteData {
  const W = 16;
  const H = 16;
  const s = makeGrid(W, H);
  // Top bar
  fillRect(s, 0, 2, 16, 2, GBC.metalDark);
  fillRect(s, 0, 2, 16, 1, GBC.metalLight);
  // Vertical posts
  fillRect(s, 1, 2, 2, 12, GBC.metalDark);
  fillRect(s, 7, 2, 2, 12, GBC.metalDark);
  fillRect(s, 13, 2, 2, 12, GBC.metalDark);
  // Middle bar
  fillRect(s, 0, 8, 16, 1, GBC.metalDark);
  // Post caps
  setPixel(s, 1, 1, GBC.metalLight);
  setPixel(s, 2, 1, GBC.metalLight);
  setPixel(s, 7, 1, GBC.metalLight);
  setPixel(s, 8, 1, GBC.metalLight);
  setPixel(s, 13, 1, GBC.metalLight);
  setPixel(s, 14, 1, GBC.metalLight);
  return s;
}
