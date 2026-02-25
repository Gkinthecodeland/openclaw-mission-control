// ---------------------------------------------------------------------------
// Pixel Office V3 — Pokemon Red Edition — Effects System
// ---------------------------------------------------------------------------
// Handles: day/night cycle, weather, particles, server LEDs, monitor
// animations, transitions, and all ambient visual effects.
// ---------------------------------------------------------------------------

import type {
  EnvironmentState,
  TimeOfDay,
  Particle,
  ParticleKind,
  ServerLed,
  MonitorAnim,
  TransitionState,
} from "./types";

import {
  FloorId,
  GBC,
  TRANSITION_DURATION,
} from "./types";

// ---------------------------------------------------------------------------
// Athens Time Helper
// ---------------------------------------------------------------------------

function getAthensTime(): { hour: number; minute: number } {
  const now = new Date();
  const athensStr = now.toLocaleString("en-US", { timeZone: "Europe/Athens" });
  const athens = new Date(athensStr);
  return { hour: athens.getHours(), minute: athens.getMinutes() };
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 8) return "sunrise";
  if (hour >= 8 && hour < 18) return "day";
  if (hour >= 18 && hour < 20) return "sunset";
  return "night";
}

export function getNightAlpha(hour: number, minute: number): number {
  const t = hour + minute / 60;
  // Day: 8AM - 5PM => 0
  if (t >= 8 && t < 17) return 0;
  // Transition in: 5PM - 8PM => 0 to 0.3
  if (t >= 17 && t < 20) return 0.3 * ((t - 17) / 3);
  // Night: 8PM - 6AM => 0.3
  if (t >= 20 || t < 6) return 0.3;
  // Transition out: 6AM - 8AM => 0.3 to 0
  return 0.3 * (1 - (t - 6) / 2);
}

export function getSkyColor(env: EnvironmentState): string {
  switch (env.timeOfDay) {
    case "sunrise":
      return GBC.skySunrise;
    case "day":
      return GBC.skyDay;
    case "sunset":
      return GBC.skySunset;
    case "night":
      return GBC.skyNight;
  }
}

export function getWindowColor(env: EnvironmentState): string {
  switch (env.timeOfDay) {
    case "sunrise":
      return GBC.skySunrise;
    case "day":
      return GBC.waterLight;
    case "sunset":
      return GBC.skySunset;
    case "night":
      return GBC.skyNight;
  }
}

export function createEnvironmentState(): EnvironmentState {
  const { hour, minute } = getAthensTime();
  return {
    timeOfDay: getTimeOfDay(hour),
    hour,
    minute,
    weather: "clear",
    weatherTimer: 0,
    weatherDuration: 0,
    nightAlpha: getNightAlpha(hour, minute),
  };
}

export function updateEnvironment(
  env: EnvironmentState,
  dt: number,
): EnvironmentState {
  const { hour, minute } = getAthensTime();
  const timeOfDay = getTimeOfDay(hour);
  const nightAlpha = getNightAlpha(hour, minute);

  let weather = env.weather;
  let weatherTimer = env.weatherTimer;
  let weatherDuration = env.weatherDuration;

  if (weather === ("rain")) {
    weatherTimer -= dt;
    if (weatherTimer <= 0) {
      weather = "clear";
      weatherTimer = 30 + Math.random() * 30;
      weatherDuration = 0;
    }
  } else {
    weatherTimer -= dt;
    if (weatherTimer <= 0) {
      if (Math.random() < 0.05) {
        weather = "rain";
        weatherDuration = 120 + Math.random() * 180; // 2-5 minutes
        weatherTimer = weatherDuration;
      } else {
        weatherTimer = 30 + Math.random() * 30;
      }
    }
  }

  return {
    timeOfDay,
    hour,
    minute,
    weather,
    weatherTimer,
    weatherDuration,
    nightAlpha,
  };
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

export function createParticle(
  kind: ParticleKind,
  x: number,
  y: number,
  floor: FloorId,
): Particle {
  switch (kind) {
    case "steam":
      return {
        kind,
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: -8 - Math.random() * 6,
        life: 1.5 + Math.random(),
        maxLife: 2.5,
        color: GBC.gray,
        size: 1,
        floor,
      };

    case "coffeeSteam":
      return {
        kind,
        x,
        y,
        vx: (Math.random() - 0.5) * 3,
        vy: -6 - Math.random() * 4,
        life: 1 + Math.random() * 0.5,
        maxLife: 1.5,
        color: GBC.gray,
        size: 1,
        floor,
      };

    case "zzz":
      return {
        kind,
        x,
        y,
        vx: 1 + Math.random() * 2,
        vy: -5 - Math.random() * 3,
        life: 2 + Math.random(),
        maxLife: 3,
        color: GBC.waterLight,
        size: 1,
        char: "Z",
        floor,
      };

    case "sparkle":
      return {
        kind,
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 0.3 + Math.random() * 0.5,
        maxLife: 0.8,
        color: GBC.yellow,
        size: 1,
        floor,
      };

    case "rain":
      return {
        kind,
        x,
        y: y || 0,
        vx: -2,
        vy: 40 + Math.random() * 20,
        life: 0.5,
        maxLife: 0.5,
        color: GBC.waterDark,
        size: 2,
        floor,
      };

    case "star":
      return {
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        life: 0.5 + Math.random() * 1.5,
        maxLife: 2,
        color: GBC.white,
        size: 1,
        floor,
      };

    case "typingSpark":
      return {
        kind,
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: -4 - Math.random() * 6,
        life: 0.2 + Math.random() * 0.3,
        maxLife: 0.5,
        color: GBC.ledGreen,
        size: 1,
        floor,
      };

    case "paper":
      return {
        kind,
        x,
        y,
        vx: 6 + Math.random() * 4,
        vy: Math.random() * 2 - 1,
        life: 1.5 + Math.random() * 0.5,
        maxLife: 2,
        color: GBC.white,
        size: 2,
        floor,
      };

    case "knock":
      return {
        kind,
        x,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: -8 - Math.random() * 4,
        life: 0.8 + Math.random() * 0.5,
        maxLife: 1.3,
        color: randomKnockColor(),
        size: 1,
        floor,
      };

    case "bird":
      return {
        kind,
        x: -8,
        y,
        vx: 20 + Math.random() * 10,
        vy: (Math.random() - 0.5) * 4,
        life: 8 + Math.random() * 4,
        maxLife: 12,
        color: GBC.metalDark,
        size: 2,
        char: "V",
        floor,
      };

    case "cloud":
      return {
        kind,
        x: -20,
        y,
        vx: 3 + Math.random() * 3,
        vy: 0,
        life: 20 + Math.random() * 10,
        maxLife: 30,
        color: GBC.white,
        size: 4,
        floor,
      };

    case "music":
      return {
        kind,
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: -8 - Math.random() * 4,
        life: 2 + Math.random(),
        maxLife: 3,
        color: GBC.pink,
        size: 1,
        char: "\u266A",
        floor,
      };

    case "achievement":
      return {
        kind,
        x,
        y,
        vx: (Math.random() - 0.5) * 16,
        vy: -12 - Math.random() * 8,
        life: 0.8 + Math.random() * 0.5,
        maxLife: 1.3,
        color: GBC.yellow,
        size: 2,
        char: "\u2605",
        floor,
      };
  }
}

function randomKnockColor(): string {
  const colors = [GBC.red, GBC.blue, GBC.yellow, GBC.plantMed, GBC.orange];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function updateParticles(
  particles: Particle[],
  dt: number,
  currentFloor: FloorId,
): Particle[] {
  const alive: Particle[] = [];
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    // Only process particles on the current floor
    if (p.floor !== currentFloor) {
      alive.push(p);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    // Gravity for knock particles
    if (p.kind === "knock") {
      p.vy += 30 * dt;
    }

    if (p.life > 0) {
      alive.push(p);
    }
  }
  return alive;
}

// Convenience spawners

export function spawnSteamParticle(
  x: number,
  y: number,
  floor: FloorId,
): Particle {
  return createParticle("steam", x, y, floor);
}

export function spawnZzzParticle(
  x: number,
  y: number,
  floor: FloorId,
): Particle {
  return createParticle("zzz", x, y, floor);
}

export function spawnRainParticle(x: number, floor: FloorId): Particle {
  return createParticle("rain", x, 0, floor);
}

export function spawnStarParticle(
  x: number,
  y: number,
  floor: FloorId,
): Particle {
  return createParticle("star", x, y, floor);
}

export function spawnTypingSparkParticle(
  x: number,
  y: number,
  floor: FloorId,
): Particle {
  return createParticle("typingSpark", x, y, floor);
}

export function spawnBirdParticle(y: number, floor: FloorId): Particle {
  return createParticle("bird", 0, y, floor);
}

export function spawnCloudParticle(y: number, floor: FloorId): Particle {
  return createParticle("cloud", 0, y, floor);
}

export function spawnSparkleParticle(
  x: number,
  y: number,
  floor: FloorId,
): Particle {
  return createParticle("sparkle", x, y, floor);
}

export function spawnAchievementParticle(
  x: number,
  y: number,
  floor: FloorId,
): Particle {
  return createParticle("achievement", x, y, floor);
}

// ---------------------------------------------------------------------------
// Server LEDs
// ---------------------------------------------------------------------------

export function createServerLeds(
  rackPositions: Array<{ x: number; y: number }>,
): ServerLed[] {
  const leds: ServerLed[] = [];
  const ledColors = [GBC.ledGreen, GBC.ledYellow, GBC.ledRed];

  for (const rack of rackPositions) {
    const ledsPerRack = 4;
    for (let i = 0; i < ledsPerRack; i++) {
      leds.push({
        x: rack.x + 12,
        y: rack.y + 3 + i * 6,
        color: ledColors[Math.floor(Math.random() * ledColors.length)],
        blinkRate: 0.3 + Math.random() * 2.5,
        blinkTimer: Math.random() * 3,
        on: Math.random() > 0.2,
      });
    }
  }
  return leds;
}

export function updateServerLeds(leds: ServerLed[], dt: number): void {
  for (let i = 0; i < leds.length; i++) {
    const led = leds[i];
    led.blinkTimer -= dt;
    if (led.blinkTimer <= 0) {
      led.on = !led.on;
      led.blinkTimer = led.blinkRate * (0.7 + Math.random() * 0.6);

      // Occasionally change color
      if (Math.random() < 0.15) {
        const roll = Math.random();
        if (roll < 0.6) {
          led.color = GBC.ledGreen;
        } else if (roll < 0.85) {
          led.color = GBC.ledYellow;
        } else {
          led.color = GBC.ledRed;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Monitor Animations
// ---------------------------------------------------------------------------

export function createMonitorAnim(deskIndex: number): MonitorAnim {
  return {
    deskIndex,
    activity: "idle",
    scrollOffset: 0,
    cursorBlink: true,
    cursorTimer: 0,
    bounceX: 3,
    bounceY: 3,
    bounceDx: 12 + Math.random() * 8,
    bounceDy: 8 + Math.random() * 6,
  };
}

export function updateMonitorAnim(mon: MonitorAnim, dt: number): void {
  switch (mon.activity) {
    case "typing": {
      // Scroll text upward and blink cursor
      mon.scrollOffset += dt * 12;
      mon.cursorTimer += dt;
      if (mon.cursorTimer >= 0.4) {
        mon.cursorBlink = !mon.cursorBlink;
        mon.cursorTimer = 0;
      }
      break;
    }
    case "thinking": {
      // Slow pulse via cursor timer
      mon.cursorTimer += dt;
      if (mon.cursorTimer >= 1.5) {
        mon.cursorTimer = 0;
      }
      break;
    }
    case "idle": {
      // Screensaver bounce
      const screenW = 10;
      const screenH = 6;
      mon.bounceX += mon.bounceDx * dt;
      mon.bounceY += mon.bounceDy * dt;
      if (mon.bounceX <= 0 || mon.bounceX >= screenW) {
        mon.bounceDx = -mon.bounceDx;
        mon.bounceX = Math.max(0, Math.min(screenW, mon.bounceX));
      }
      if (mon.bounceY <= 0 || mon.bounceY >= screenH) {
        mon.bounceDy = -mon.bounceDy;
        mon.bounceY = Math.max(0, Math.min(screenH, mon.bounceY));
      }
      break;
    }
    case "sleeping":
    case "off":
      // Nothing to update
      break;
    case "walking":
      // Monitor shows idle/screensaver when agent is walking
      mon.bounceX += mon.bounceDx * dt * 0.5;
      mon.bounceY += mon.bounceDy * dt * 0.5;
      if (mon.bounceX <= 0 || mon.bounceX >= 10) mon.bounceDx = -mon.bounceDx;
      if (mon.bounceY <= 0 || mon.bounceY >= 6) mon.bounceDy = -mon.bounceDy;
      break;
  }
}

// ---------------------------------------------------------------------------
// Rendering Helpers
// ---------------------------------------------------------------------------

export function renderNightOverlay(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  w: number,
  h: number,
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = GBC.skyNight;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function renderParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  camX: number,
  camY: number,
  zoom: number,
): void {
  const sx = (p.x - camX) * zoom;
  const sy = (p.y - camY) * zoom;

  // Fade-out in last 30% of life
  const fadeRatio = p.maxLife > 0 ? p.life / (p.maxLife * 0.3) : 1;
  const opacity = Math.min(1, Math.max(0, fadeRatio));

  ctx.save();
  ctx.globalAlpha = opacity;

  if (p.char) {
    // Text-based particles (Z, music notes, birds, stars/achievement)
    const fontSize = Math.max(6, p.size * zoom * 2.5);
    ctx.font = `${fontSize}px monospace`;
    ctx.fillStyle = p.color;
    ctx.fillText(p.char, sx, sy);
  } else if (p.kind === "cloud") {
    // Cloud: render as a blob of white rectangles
    const cw = p.size * zoom;
    const ch = p.size * zoom * 0.5;
    ctx.fillStyle = p.color;
    ctx.fillRect(sx, sy, cw * 2, ch);
    ctx.fillRect(sx + cw * 0.3, sy - ch * 0.6, cw * 1.2, ch);
    ctx.fillRect(sx + cw * 0.8, sy - ch, cw * 0.6, ch * 0.7);
  } else if (p.kind === "paper") {
    // Paper: small white rectangle
    const pw = 3 * zoom;
    const ph = 2 * zoom;
    ctx.fillStyle = p.color;
    ctx.fillRect(sx, sy, pw, ph);
  } else if (p.kind === "rain") {
    // Rain: vertical blue streak
    ctx.fillStyle = p.color;
    ctx.fillRect(sx, sy, zoom, p.size * zoom * 1.5);
  } else {
    // Default: small pixel dot
    const s = p.size * zoom;
    ctx.fillStyle = p.color;
    ctx.fillRect(sx, sy, s, s);
  }

  ctx.restore();
}

export function renderServerLed(
  ctx: CanvasRenderingContext2D,
  led: ServerLed,
  camX: number,
  camY: number,
  zoom: number,
): void {
  const sx = (led.x - camX) * zoom;
  const sy = (led.y - camY) * zoom;
  const radius = zoom;

  if (led.on) {
    // Glow effect: larger faint circle behind the LED
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = led.color;
    ctx.fillRect(sx - radius, sy - radius, radius * 3, radius * 3);
    ctx.restore();

    // Bright LED dot
    ctx.fillStyle = led.color;
    ctx.fillRect(sx, sy, radius, radius);
  } else {
    ctx.fillStyle = GBC.ledOff;
    ctx.fillRect(sx, sy, radius, radius);
  }
}

export function renderMonitorScreen(
  ctx: CanvasRenderingContext2D,
  mon: MonitorAnim,
  screenX: number,
  screenY: number,
  zoom: number,
  frame: number,
): void {
  // Monitor screen area in zoomed pixels
  const sw = 10 * zoom;
  const sh = 6 * zoom;

  ctx.save();

  switch (mon.activity) {
    case "typing": {
      // Dark green background with scrolling green text lines
      ctx.fillStyle = "#0A1808";
      ctx.fillRect(screenX, screenY, sw, sh);

      ctx.fillStyle = GBC.ledGreen;
      const lineH = zoom;
      const lineSpacing = zoom * 1.5;
      const scrollPx = (mon.scrollOffset * zoom) % (lineSpacing * 6);
      for (let i = 0; i < 5; i++) {
        const ly = screenY + i * lineSpacing - scrollPx % lineSpacing;
        if (ly < screenY || ly > screenY + sh - lineH) continue;
        // Pseudo-random line widths using index and frame
        const lineW =
          sw * (0.3 + ((((i + frame) * 7) % 11) / 11) * 0.6);
        ctx.fillRect(screenX + zoom, ly, lineW, lineH * 0.6);
      }

      // Blinking cursor
      if (mon.cursorBlink) {
        const cursorY =
          screenY + sh - zoom * 2;
        ctx.fillStyle = GBC.ledGreen;
        ctx.fillRect(screenX + zoom, cursorY, zoom * 0.8, zoom);
      }
      break;
    }

    case "thinking": {
      // Dim pulsing screen
      const pulse = Math.sin(mon.cursorTimer * Math.PI / 0.75);
      const brightness = 0.15 + pulse * 0.1;
      ctx.fillStyle = "#0A1808";
      ctx.fillRect(screenX, screenY, sw, sh);

      ctx.globalAlpha = Math.max(0, brightness);
      ctx.fillStyle = GBC.blue;
      ctx.fillRect(screenX, screenY, sw, sh);

      // Ellipsis dots
      ctx.globalAlpha = 1;
      ctx.fillStyle = GBC.white;
      const dotCount = 1 + Math.floor(mon.cursorTimer / 0.5) % 3;
      for (let d = 0; d < dotCount; d++) {
        ctx.fillRect(
          screenX + sw * 0.3 + d * zoom * 1.5,
          screenY + sh * 0.45,
          zoom * 0.6,
          zoom * 0.6,
        );
      }
      break;
    }

    case "idle":
    case "walking": {
      // Blue screensaver with bouncing dot
      ctx.fillStyle = GBC.skyNight;
      ctx.fillRect(screenX, screenY, sw, sh);

      ctx.fillStyle = GBC.waterLight;
      const bx = screenX + (mon.bounceX / 10) * sw;
      const by = screenY + (mon.bounceY / 6) * sh;
      ctx.fillRect(bx, by, zoom, zoom);
      break;
    }

    case "sleeping":
    case "off": {
      // Dark/off screen
      ctx.fillStyle = GBC.metalVDark;
      ctx.fillRect(screenX, screenY, sw, sh);
      break;
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Transitions (Pokemon-style fade to black)
// ---------------------------------------------------------------------------

export function createTransitionState(): TransitionState {
  return {
    kind: "none",
    progress: 0,
    targetFloor: null,
    duration: TRANSITION_DURATION,
  };
}

export function startTransition(target: FloorId): TransitionState {
  return {
    kind: "fadeOut",
    progress: 0,
    targetFloor: target,
    duration: TRANSITION_DURATION,
  };
}

export function updateTransition(
  t: TransitionState,
  dt: number,
): TransitionState {
  if (t.kind === ("none")) return t;

  const newProgress = t.progress + dt / t.duration;

  if (newProgress >= 1) {
    if (t.kind === ("fadeOut")) {
      // Switch to fadeIn
      return {
        kind: "fadeIn",
        progress: 0,
        targetFloor: t.targetFloor,
        duration: t.duration,
      };
    }
    // fadeIn complete
    return {
      kind: "none",
      progress: 0,
      targetFloor: null,
      duration: t.duration,
    };
  }

  return {
    kind: t.kind,
    progress: newProgress,
    targetFloor: t.targetFloor,
    duration: t.duration,
  };
}

export function renderTransition(
  ctx: CanvasRenderingContext2D,
  t: TransitionState,
  w: number,
  h: number,
): void {
  if (t.kind === ("none")) return;

  let alpha: number;
  if (t.kind === ("fadeOut")) {
    alpha = t.progress; // 0 -> 1 (transparent to black)
  } else {
    alpha = 1 - t.progress; // 1 -> 0 (black to transparent)
  }

  alpha = Math.max(0, Math.min(1, alpha));
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = GBC.black;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
