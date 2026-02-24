// ---------------------------------------------------------------------------
// Pixel Office V2 — Effects System
// ---------------------------------------------------------------------------

import type {
  EnvironmentState,
  TimeOfDay,
  Particle,
  ParticleType,
  ServerLed,
} from "./types";
import { TILE_SIZE, GRID_COLS } from "./types";

// ---------------------------------------------------------------------------
// Athens Time
// ---------------------------------------------------------------------------

export function getAthensTime(): { hour: number; minute: number } {
  const now = new Date();
  const athensStr = now.toLocaleString("en-US", { timeZone: "Europe/Athens" });
  const athens = new Date(athensStr);
  return { hour: athens.getHours(), minute: athens.getMinutes() };
}

export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 8) return "sunrise";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 19) return "sunset";
  return "night";
}

export function getNightOverlayAlpha(hour: number): number {
  if (hour >= 8 && hour < 17) return 0;
  if (hour >= 6 && hour < 8) return 0.05 * (1 - (hour - 6) / 2);
  if (hour >= 17 && hour < 19) return 0.05 * ((hour - 17) / 2);
  return 0.08;
}

// ---------------------------------------------------------------------------
// Environment State
// ---------------------------------------------------------------------------

export function createEnvironmentState(): EnvironmentState {
  const { hour, minute } = getAthensTime();
  return {
    timeOfDay: getTimeOfDay(hour),
    hour,
    minute,
    isRaining: false,
    rainTimer: 0,
    rainCheckTimer: 30 + Math.random() * 30,
    nightOverlayAlpha: getNightOverlayAlpha(hour),
  };
}

export function updateEnvironment(env: EnvironmentState, dt: number): void {
  // Update Athens time
  const { hour, minute } = getAthensTime();
  env.hour = hour;
  env.minute = minute;
  env.timeOfDay = getTimeOfDay(hour);
  env.nightOverlayAlpha = getNightOverlayAlpha(hour);

  // Rain logic
  if (env.isRaining) {
    env.rainTimer -= dt;
    if (env.rainTimer <= 0) {
      env.isRaining = false;
      env.rainCheckTimer = 30 + Math.random() * 30;
    }
  } else {
    env.rainCheckTimer -= dt;
    if (env.rainCheckTimer <= 0) {
      // 5% chance to start raining
      if (Math.random() < 0.05) {
        env.isRaining = true;
        env.rainTimer = 120 + Math.random() * 180; // 2-5 minutes
      }
      env.rainCheckTimer = 60; // Check every minute
    }
  }
}

// ---------------------------------------------------------------------------
// Window rendering helpers (colors for different times of day)
// ---------------------------------------------------------------------------

export function getWindowColors(timeOfDay: TimeOfDay): { top: string; bottom: string } {
  switch (timeOfDay) {
    case "sunrise":
      return { top: "#FF8844", bottom: "#FFAA66" };
    case "day":
      return { top: "#88BBEE", bottom: "#AADDFF" };
    case "sunset":
      return { top: "#CC4422", bottom: "#FF8844" };
    case "night":
      return { top: "#0A0A2A", bottom: "#151540" };
  }
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

export function createParticle(type: ParticleType, x: number, y: number): Particle {
  switch (type) {
    case "steam":
      return {
        type,
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: -8 - Math.random() * 6,
        life: 1.5 + Math.random(),
        maxLife: 2.5,
        color: "#CCCCDD",
        size: 1,
      };
    case "coffeeSteam":
      return {
        type,
        x,
        y,
        vx: (Math.random() - 0.5) * 3,
        vy: -6 - Math.random() * 4,
        life: 1 + Math.random() * 0.5,
        maxLife: 1.5,
        color: "#AAAACC",
        size: 1,
      };
    case "zzz":
      return {
        type,
        x,
        y,
        vx: 1 + Math.random() * 2,
        vy: -5 - Math.random() * 3,
        life: 2 + Math.random(),
        maxLife: 3,
        color: "#AAAAFF",
        size: 1,
        char: "Z",
      };
    case "music":
      return {
        type,
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: -8 - Math.random() * 4,
        life: 2 + Math.random(),
        maxLife: 3,
        color: "#FFAACC",
        size: 1,
        char: "\u266A",
      };
    case "star":
      return {
        type,
        x,
        y,
        vx: 0,
        vy: 0,
        life: 0.5 + Math.random() * 1.5,
        maxLife: 2,
        color: "#FFFFFF",
        size: 1,
      };
    case "rain":
      return {
        type,
        x,
        y,
        vx: -2,
        vy: 40 + Math.random() * 20,
        life: 0.5,
        maxLife: 0.5,
        color: "#6688CC",
        size: 2,
      };
    case "sparkle":
      return {
        type,
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 0.3 + Math.random() * 0.5,
        maxLife: 0.8,
        color: "#FFEE88",
        size: 1,
      };
  }
}

export function updateParticles(particles: Particle[], dt: number): Particle[] {
  const alive: Particle[] = [];
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life > 0) {
      alive.push(p);
    }
  }
  return alive;
}

export function spawnRainParticles(particles: Particle[], windowCols: number[]): void {
  // Rain only visible through the window area
  for (const col of windowCols) {
    if (Math.random() < 0.3) {
      const x = col * TILE_SIZE + Math.random() * TILE_SIZE;
      const y = 2 + Math.random() * 4;
      particles.push(createParticle("rain", x, y));
    }
  }
}

export function spawnWindowStars(
  particles: Particle[],
  windowCols: number[],
  frame: number,
): void {
  // Spawn twinkling stars in the window at night
  if (frame % 30 === 0) {
    const col = windowCols[Math.floor(Math.random() * windowCols.length)];
    const x = col * TILE_SIZE + Math.random() * TILE_SIZE;
    const y = 2 + Math.random() * 10;
    particles.push(createParticle("star", x, y));
  }
}

// ---------------------------------------------------------------------------
// Server LEDs
// ---------------------------------------------------------------------------

export function createServerLeds(): ServerLed[] {
  const leds: ServerLed[] = [];
  // 3 server racks at cols 3, 6, 9 in row 15-16
  for (let rack = 0; rack < 3; rack++) {
    const baseCol = 3 + rack * 3;
    const baseX = baseCol * TILE_SIZE;
    const baseY = 15 * TILE_SIZE;

    for (let ledIdx = 0; ledIdx < 4; ledIdx++) {
      leds.push({
        x: baseX + 12,
        y: baseY + 4 + ledIdx * 7,
        color: Math.random() < 0.5 ? "#44CC44" : "#CCAA33",
        blinkRate: 0.5 + Math.random() * 2,
        blinkTimer: Math.random() * 2,
        on: true,
      });
    }
  }
  return leds;
}

export function updateServerLeds(
  leds: ServerLed[],
  dt: number,
  activeAgentCount: number,
): void {
  for (const led of leds) {
    led.blinkTimer -= dt;
    if (led.blinkTimer <= 0) {
      led.on = !led.on;
      led.blinkTimer = led.blinkRate;

      // Update color based on agent activity
      if (activeAgentCount > 0) {
        led.color = Math.random() < 0.7 ? "#44CC44" : "#CCAA33";
      } else {
        led.color = Math.random() < 0.3 ? "#CCAA33" : "#CC3333";
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Music notes from the lounge
// ---------------------------------------------------------------------------

export function maybeSpawnMusicNote(particles: Particle[], frame: number): void {
  // Occasional music notes from lounge area
  if (frame % 90 === 0 && Math.random() < 0.3) {
    const x = 22 * TILE_SIZE + Math.random() * 4 * TILE_SIZE;
    const y = 16 * TILE_SIZE;
    particles.push(createParticle("music", x, y));
  }
}

// ---------------------------------------------------------------------------
// Window tile columns (for rain/stars)
// ---------------------------------------------------------------------------

export function getWindowCols(): number[] {
  // Window spans cols 8-12 in row 0
  return [8, 9, 10, 11, 12];
}

// ---------------------------------------------------------------------------
// Format time for clock display
// ---------------------------------------------------------------------------

export function formatClockTime(hour: number, minute: number): string {
  const h = hour.toString().padStart(2, "0");
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Get the pixel area where the window sits (for rendering) */
export function getWindowRect(): { x: number; y: number; w: number; h: number } {
  return {
    x: 8 * TILE_SIZE,
    y: 0,
    w: 5 * TILE_SIZE,
    h: TILE_SIZE,
  };
}

/** Compute clock hands angle. Returns hours and minutes angles in radians. */
export function getClockAngles(hour: number, minute: number): { hourAngle: number; minuteAngle: number } {
  const h12 = hour % 12;
  const hourAngle = ((h12 + minute / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  const minuteAngle = (minute / 60) * Math.PI * 2 - Math.PI / 2;
  return { hourAngle, minuteAngle };
}
