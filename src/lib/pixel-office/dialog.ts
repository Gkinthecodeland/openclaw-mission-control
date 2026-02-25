// ---------------------------------------------------------------------------
// Pixel Office V3 — Pokemon Red Edition — Dialog System
// ---------------------------------------------------------------------------

import type { Character, DialogState } from "./types";
import { DIALOG_CHAR_SPEED, DIALOG_MARGIN, GBC } from "./types";

// ---------------------------------------------------------------------------
// Dialog Text Pools
// ---------------------------------------------------------------------------

const TYPING_LINES: readonly string[] = [
  "I'm deep in code right now.",
  "Compiling... almost there.",
  "Just pushed some changes.",
  "Refactoring this module...",
  "Writing tests for the new feature.",
  "Debugging a tricky edge case.",
  "Reviewing a pull request.",
  "Deploying to staging...",
];

const TYPING_WITH_TASK_PREFIX: readonly string[] = [
  "I'm deep in code right now. Working on ",
  "Currently focused on ",
  "Making progress on ",
];

const THINKING_LINES: readonly string[] = [
  "Hmm, let me think about this...",
  "Analyzing the codebase...",
  "Processing...",
  "Considering the architecture here...",
  "Weighing the tradeoffs...",
  "Let me reason through this.",
];

const IDLE_LINES: readonly string[] = [
  "Just thinking... Need something?",
  "Taking a breather.",
  "What's up?",
  "Standing by, ready to help.",
  "Enjoying a quiet moment.",
  "Waiting for the next task.",
];

const SLEEPING_LINES: readonly string[] = [
  "Zzz... *snore* ...Zzz",
  "Five more minutes...",
  "*mumbles about code*",
  "Zzz... merge conflict... Zzz...",
  "*dreaming of clean builds*",
];

const COFFEE_LINES: readonly string[] = [
  "Getting my caffeine fix!",
  "Can't code without coffee.",
  "Mmm, freshly brewed.",
  "Fuel for the mind!",
  "The best part of the morning.",
];

const CAT_LINES: readonly string[] = [
  "Meow!",
  "Mrrrow?",
  "Purr... *rubs against your leg*",
  "*stares at you judgmentally*",
  "*knocks something off the desk*",
  "Prrrrr...",
  "*blinks slowly*",
  "Meow? Meow meow.",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickRandom(pool: readonly string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Word-wrap text to fit within a given pixel width when rendered at a given
 * font size. Splitting is done on space boundaries. Returns an array of lines.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const test = currentLine.length === 0 ? word : `${currentLine} ${word}`;
    const measured = ctx.measureText(test).width;
    if (measured > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Dialog Text Selection
// ---------------------------------------------------------------------------

export function getDialogText(character: Character): string {
  switch (character.state) {
    case "type": {
      if (character.currentTask) {
        return pickRandom(TYPING_WITH_TASK_PREFIX) + character.currentTask + ".";
      }
      return pickRandom(TYPING_LINES);
    }
    case "think":
      return pickRandom(THINKING_LINES);
    case "idle":
    case "walk":
      return pickRandom(IDLE_LINES);
    case "sleep":
      return pickRandom(SLEEPING_LINES);
    case "coffee":
      return pickRandom(COFFEE_LINES);
  }
}

export function getCatDialogText(): string {
  return pickRandom(CAT_LINES);
}

// ---------------------------------------------------------------------------
// State Constructors & Updaters (immutable)
// ---------------------------------------------------------------------------

export function createDialogState(): DialogState {
  return {
    active: false,
    text: "",
    displayedChars: 0,
    charTimer: 0,
    speaker: "",
    speakerEmoji: "",
    finished: false,
  };
}

export function openCharacterDialog(
  dialog: DialogState,
  character: Character,
): DialogState {
  const text = getDialogText(character);
  return {
    active: true,
    text,
    displayedChars: 0,
    charTimer: 0,
    speaker: character.name,
    speakerEmoji: character.emoji,
    finished: false,
  };
}

export function openCatDialog(dialog: DialogState): DialogState {
  const text = getCatDialogText();
  return {
    active: true,
    text,
    displayedChars: 0,
    charTimer: 0,
    speaker: "Office Cat",
    speakerEmoji: "\uD83D\uDC31",
    finished: false,
  };
}

export function openDialog(
  dialog: DialogState,
  speaker: string,
  emoji: string,
  text: string,
): DialogState {
  return {
    active: true,
    text,
    displayedChars: 0,
    charTimer: 0,
    speaker,
    speakerEmoji: emoji,
    finished: false,
  };
}

export function updateDialog(dialog: DialogState, dt: number): DialogState {
  if (!dialog.active || dialog.finished) {
    return dialog;
  }

  const newTimer = dialog.charTimer + dt;
  let chars = dialog.displayedChars;
  let timer = newTimer;

  // Reveal characters based on elapsed time
  while (timer >= DIALOG_CHAR_SPEED && chars < dialog.text.length) {
    chars += 1;
    timer -= DIALOG_CHAR_SPEED;
  }

  const finished = chars >= dialog.text.length;

  return {
    ...dialog,
    displayedChars: chars,
    charTimer: finished ? 0 : timer,
    finished,
  };
}

export function advanceDialog(dialog: DialogState): DialogState {
  if (!dialog.active) {
    return dialog;
  }

  // If text is still typing, reveal all text instantly
  if (!dialog.finished) {
    return {
      ...dialog,
      displayedChars: dialog.text.length,
      charTimer: 0,
      finished: true,
    };
  }

  // If finished, close the dialog
  return {
    ...dialog,
    active: false,
  };
}

export function isDialogActive(dialog: DialogState): boolean {
  return dialog.active;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const FONT_SIZE = 14;
const SPEAKER_FONT_SIZE = 13;
const LINE_HEIGHT = 20;
const BOX_MAX_WIDTH = 600;
const BOX_MIN_HEIGHT = 80;
const BOX_PADDING = 14;
const BORDER_OUTER = 3;
const BORDER_INNER = 2;
const INDICATOR_SIZE = 6;
const BOTTOM_OFFSET = 24;

export function renderDialog(
  ctx: CanvasRenderingContext2D,
  dialog: DialogState,
  canvasWidth: number,
  canvasHeight: number,
  frame: number,
): void {
  if (!dialog.active) {
    return;
  }

  ctx.save();

  // --- Measure text to determine box height ---
  const boxWidth = Math.min(canvasWidth * 0.8, BOX_MAX_WIDTH);
  const textAreaWidth = boxWidth - BOX_PADDING * 2 - DIALOG_MARGIN * 2;

  // Set font for measurement
  ctx.font = `${FONT_SIZE}px monospace`;

  // Build the visible text (typewriter)
  const visibleText = dialog.text.slice(0, dialog.displayedChars);

  // Wrap the full text to know total height, but only display visible
  const fullLines = wrapText(ctx, dialog.text, textAreaWidth);
  const lineCount = Math.max(fullLines.length, 1);

  // Speaker line height
  const speakerHeight = SPEAKER_FONT_SIZE + 6;
  const textBlockHeight = lineCount * LINE_HEIGHT;
  const contentHeight = speakerHeight + textBlockHeight;
  const boxHeight = Math.max(
    BOX_MIN_HEIGHT,
    contentHeight + BOX_PADDING * 2 + DIALOG_MARGIN,
  );

  // --- Position (centered horizontally, near bottom) ---
  const boxX = Math.floor((canvasWidth - boxWidth) / 2);
  const boxY = canvasHeight - boxHeight - BOTTOM_OFFSET;

  // --- Draw outer border (dark) ---
  ctx.fillStyle = GBC.black;
  ctx.fillRect(
    boxX - BORDER_OUTER,
    boxY - BORDER_OUTER,
    boxWidth + BORDER_OUTER * 2,
    boxHeight + BORDER_OUTER * 2,
  );

  // --- Draw inner border (medium gray — GBC double-border style) ---
  ctx.fillStyle = GBC.dialogBorder;
  ctx.fillRect(
    boxX - BORDER_INNER,
    boxY - BORDER_INNER,
    boxWidth + BORDER_INNER * 2,
    boxHeight + BORDER_INNER * 2,
  );

  // --- Draw background ---
  ctx.fillStyle = GBC.dialogBg;
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  // --- Draw inner shadow line at top (subtle depth) ---
  ctx.fillStyle = GBC.dialogShadow;
  ctx.fillRect(boxX, boxY, boxWidth, 1);

  // --- Speaker name ---
  const textX = boxX + BOX_PADDING + DIALOG_MARGIN;
  let textY = boxY + BOX_PADDING + SPEAKER_FONT_SIZE;

  ctx.font = `bold ${SPEAKER_FONT_SIZE}px monospace`;
  ctx.fillStyle = GBC.dialogText;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    `${dialog.speakerEmoji} ${dialog.speaker}`,
    textX,
    textY,
  );

  textY += speakerHeight;

  // --- Body text with typewriter effect ---
  ctx.font = `${FONT_SIZE}px monospace`;
  ctx.fillStyle = GBC.dialogText;

  // We need to render the wrapped visible text. To handle word-wrap correctly
  // with the typewriter, we walk through the full wrapped lines and render
  // only up to displayedChars total characters.
  let charsRendered = 0;

  for (let i = 0; i < fullLines.length; i++) {
    const line = fullLines[i];
    // How many chars from this line can we show?
    const remainingChars = dialog.displayedChars - charsRendered;
    if (remainingChars <= 0) {
      break;
    }

    // Account for the space that was consumed during wrapping. The wrapText
    // function splits on spaces, so each line boundary costs one space from
    // the original text except possibly the last line. We track characters
    // as they appear in the individual lines.
    const visibleLineChars = Math.min(line.length, remainingChars);
    const visibleLine = line.slice(0, visibleLineChars);

    ctx.fillText(visibleLine, textX, textY + i * LINE_HEIGHT);
    charsRendered += line.length;

    // Account for the space between wrapped lines (the space that was the
    // break point). Only count it if this is not the last line.
    if (i < fullLines.length - 1) {
      charsRendered += 1;
    }
  }

  // --- Triangle indicator (bouncing) when text is finished ---
  if (dialog.finished) {
    const indicatorX = boxX + boxWidth - BOX_PADDING - INDICATOR_SIZE * 2;
    const bounce = Math.floor(frame / 15) % 2 === 0 ? 0 : 2;
    const indicatorY =
      boxY + boxHeight - BOX_PADDING - INDICATOR_SIZE + bounce;

    ctx.fillStyle = GBC.dialogText;
    ctx.beginPath();
    ctx.moveTo(indicatorX, indicatorY);
    ctx.lineTo(indicatorX + INDICATOR_SIZE, indicatorY);
    ctx.lineTo(
      indicatorX + INDICATOR_SIZE / 2,
      indicatorY + INDICATOR_SIZE,
    );
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Achievement Toast
// ---------------------------------------------------------------------------

const ACHIEVEMENT_WIDTH = 280;
const ACHIEVEMENT_HEIGHT = 56;
const ACHIEVEMENT_BORDER = 3;
const ACHIEVEMENT_TOP_OFFSET = 20;

export function renderAchievement(
  ctx: CanvasRenderingContext2D,
  text: string,
  progress: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  // Calculate alpha based on progress phase:
  // 0.0 - 0.3: fade in
  // 0.3 - 0.7: hold
  // 0.7 - 1.0: fade out
  let alpha: number;
  if (progress < 0.3) {
    alpha = progress / 0.3;
  } else if (progress < 0.7) {
    alpha = 1;
  } else {
    alpha = 1 - (progress - 0.7) / 0.3;
  }

  alpha = Math.max(0, Math.min(1, alpha));
  if (alpha <= 0) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  const boxX = Math.floor((canvasWidth - ACHIEVEMENT_WIDTH) / 2);
  const boxY = ACHIEVEMENT_TOP_OFFSET;

  // Golden border
  ctx.fillStyle = GBC.yellow;
  ctx.fillRect(
    boxX - ACHIEVEMENT_BORDER,
    boxY - ACHIEVEMENT_BORDER,
    ACHIEVEMENT_WIDTH + ACHIEVEMENT_BORDER * 2,
    ACHIEVEMENT_HEIGHT + ACHIEVEMENT_BORDER * 2,
  );

  // Dark inner border
  ctx.fillStyle = GBC.black;
  ctx.fillRect(
    boxX - 1,
    boxY - 1,
    ACHIEVEMENT_WIDTH + 2,
    ACHIEVEMENT_HEIGHT + 2,
  );

  // Background
  ctx.fillStyle = GBC.dialogBg;
  ctx.fillRect(boxX, boxY, ACHIEVEMENT_WIDTH, ACHIEVEMENT_HEIGHT);

  // "Achievement Unlocked!" header
  ctx.font = "bold 12px monospace";
  ctx.fillStyle = GBC.yellow;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    "\u2B50 Achievement Unlocked!",
    boxX + 12,
    boxY + 20,
  );

  // Achievement text
  ctx.font = "11px monospace";
  ctx.fillStyle = GBC.dialogText;
  ctx.fillText(text, boxX + 12, boxY + 40);

  ctx.restore();
}
