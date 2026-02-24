// ---------------------------------------------------------------------------
// Pixel Office V2 — Office State Management
// ---------------------------------------------------------------------------

import type {
  OfficeState,
  OfficeAgent,
  Character,
  MonitorState,
  Particle,
  Furniture,
  ServerLed,
  Cat,
} from "./types";
import { MAX_DELTA } from "./types";
import {
  buildTileMap,
  buildWalkableGrid,
  buildFurniture,
  getDeskAssignments,
} from "./tilemap";
import {
  createEnvironmentState,
  updateEnvironment,
  updateParticles,
  spawnRainParticles,
  spawnWindowStars,
  createServerLeds,
  updateServerLeds,
  maybeSpawnMusicNote,
  getWindowCols,
  createParticle,
} from "./effects";
import {
  createCharacter,
  updateCharacter,
  syncCharacterWithAgent,
  createCat,
  updateCat,
} from "./characters";

// ---------------------------------------------------------------------------
// OfficeStateManager
// ---------------------------------------------------------------------------

export class OfficeStateManager {
  private characters: Character[] = [];
  private cat: Cat;
  private particles: Particle[] = [];
  private furniture: Furniture[];
  private serverLeds: ServerLed[];
  private monitors: MonitorState[] = [];
  private walkable: boolean[][];
  private environment = createEnvironmentState();
  private frame = 0;
  private time = 0;

  private steamTimer = 0;
  private zzzTimer = 0;
  private windowCols = getWindowCols();

  constructor() {
    this.furniture = buildFurniture();
    const tileMap = buildTileMap();
    this.walkable = buildWalkableGrid(tileMap, this.furniture);
    this.serverLeds = createServerLeds();

    // Cat starts in the lounge
    this.cat = createCat(20, 16);

    // Initialize monitors for each desk
    const desks = getDeskAssignments();
    this.monitors = desks.map((_, i) => ({
      deskIndex: i,
      activity: "off" as const,
      scrollOffset: 0,
      bounceX: 4,
      bounceY: 4,
      bounceDx: 1,
      bounceDy: 0.7,
    }));
  }

  // -----------------------------------------------------------------------
  // Called with API data every 5 seconds
  // -----------------------------------------------------------------------

  updateAgents(agents: OfficeAgent[]): void {
    const desks = getDeskAssignments();
    const existingIds = new Set(this.characters.map((c) => c.id));
    const incomingIds = new Set(agents.map((a) => a.id));

    // Update existing characters
    for (const char of this.characters) {
      const agent = agents.find((a) => a.id === char.id);
      if (agent) {
        syncCharacterWithAgent(char, agent);
      }
    }

    // Add new characters
    for (const agent of agents) {
      if (!existingIds.has(agent.id)) {
        const deskIndex = this.characters.length;
        const desk = deskIndex < desks.length ? desks[deskIndex] : null;
        const char = createCharacter(agent, desk, deskIndex, deskIndex);
        this.characters.push(char);
      }
    }

    // Remove characters that are no longer in the agent list
    this.characters = this.characters.filter((c) => incomingIds.has(c.id));

    // Update monitor states
    for (let i = 0; i < this.monitors.length; i++) {
      const char = this.characters.find((c) => c.deskIndex === i);
      if (char) {
        if (char.targetActivity === "typing" || char.targetActivity === "thinking") {
          this.monitors[i].activity = "typing";
        } else if (char.targetActivity === "sleeping") {
          this.monitors[i].activity = "sleeping";
        } else {
          this.monitors[i].activity = "idle";
        }
      } else {
        this.monitors[i].activity = "off";
      }
    }
  }

  // -----------------------------------------------------------------------
  // Called every frame
  // -----------------------------------------------------------------------

  update(dt: number): void {
    // Cap delta time
    const clampedDt = Math.min(dt, MAX_DELTA);

    this.frame++;
    this.time += clampedDt;

    // Update environment (day/night, rain)
    updateEnvironment(this.environment, clampedDt);

    // Update characters
    for (const char of this.characters) {
      updateCharacter(char, clampedDt, this.walkable);
    }

    // Update cat
    updateCat(this.cat, clampedDt, this.walkable, this.characters);

    // Update server LEDs
    const activeCount = this.characters.filter(
      (c) => c.status === "active",
    ).length;
    updateServerLeds(this.serverLeds, clampedDt, activeCount);

    // Update monitor animations
    for (const mon of this.monitors) {
      if (mon.activity === "typing") {
        mon.scrollOffset += clampedDt * 20;
      }
      if (mon.activity === "idle") {
        mon.bounceX += mon.bounceDx * clampedDt * 12;
        mon.bounceY += mon.bounceDy * clampedDt * 12;
        if (mon.bounceX <= 0 || mon.bounceX >= 10) mon.bounceDx *= -1;
        if (mon.bounceY <= 0 || mon.bounceY >= 6) mon.bounceDy *= -1;
        mon.bounceX = Math.max(0, Math.min(10, mon.bounceX));
        mon.bounceY = Math.max(0, Math.min(6, mon.bounceY));
      }
    }

    // Spawn particles
    this.updateParticleSpawning(clampedDt);

    // Update particles
    this.particles = updateParticles(this.particles, clampedDt);

    // Cap particle count
    if (this.particles.length > 200) {
      this.particles = this.particles.slice(-200);
    }
  }

  // -----------------------------------------------------------------------
  // Particle spawning
  // -----------------------------------------------------------------------

  private updateParticleSpawning(dt: number): void {
    // Steam from coffee machine when a character is in coffee state
    const someoneGettingCoffee = this.characters.some((c) => c.state === "coffee");
    if (someoneGettingCoffee) {
      this.steamTimer += dt;
      if (this.steamTimer >= 0.15) {
        this.steamTimer = 0;
        // Coffee machine is at col 31, row 2
        const x = 31 * 16 + 7;
        const y = 2 * 16 - 2;
        this.particles.push(createParticle("coffeeSteam", x, y));
      }
    }

    // ZZZ from sleeping characters
    this.zzzTimer += dt;
    if (this.zzzTimer >= 0.8) {
      this.zzzTimer = 0;
      for (const char of this.characters) {
        if (char.state === "sleep") {
          this.particles.push(createParticle("zzz", char.x + 12, char.y - 4));
        }
      }
      // ZZZ from sleeping cat
      if (this.cat.state === "sleep" && this.cat.path.length === 0) {
        this.particles.push(createParticle("zzz", this.cat.x + 6, this.cat.y - 2));
      }
    }

    // Rain through window
    if (this.environment.isRaining) {
      spawnRainParticles(this.particles, this.windowCols);
    }

    // Stars in window at night
    if (this.environment.timeOfDay === "night") {
      spawnWindowStars(this.particles, this.windowCols, this.frame);
    }

    // Music notes from lounge
    maybeSpawnMusicNote(this.particles, this.frame);
  }

  // -----------------------------------------------------------------------
  // Get state for rendering
  // -----------------------------------------------------------------------

  getState(): OfficeState {
    return {
      characters: this.characters,
      cat: this.cat,
      particles: this.particles,
      environment: this.environment,
      furniture: this.furniture,
      serverLeds: this.serverLeds,
      monitors: this.monitors,
      frame: this.frame,
      time: this.time,
    };
  }
}
