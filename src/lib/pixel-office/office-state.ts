// ---------------------------------------------------------------------------
// Pixel Office V3 — Pokemon Red Edition — Office State Manager
// ---------------------------------------------------------------------------
// Central state manager that ties all modules together. Manages GameState,
// floor transitions, agent syncing, player input, and the main game loop.
// The React component just calls update() each frame and passes state to
// the renderer.
// ---------------------------------------------------------------------------

import type {
  GameState,
  FloorData,
  Character,
  Cat,
  Particle,
  ServerLed,
  MonitorAnim,
  OfficeAgent,
} from "./types";

import {
  FloorId,
  TileType,
  TILE_SIZE,
  FLOOR_WIDTH,
  FLOOR_HEIGHT,
  MAX_DELTA,
  CAMERA_LERP,
  SPECTATOR_TIMEOUT,
  TRANSITION_DURATION,
} from "./types";

import {
  buildAllFloors,
  getTileAt,
  findPath,
} from "./tilemap";

import {
  type InputState,
  createInputState,
  createPlayer,
  createCharacter,
  createCat,
  updatePlayer,
  updateCharacter,
  updateCat,
  syncCharacterWithAgent,
  getNearestInteractable,
} from "./characters";

import {
  createEnvironmentState,
  updateEnvironment,
  createParticle,
  updateParticles,
  createServerLeds,
  updateServerLeds,
  createMonitorAnim,
  updateMonitorAnim,
  startTransition,
  updateTransition as updateTransitionState,
  createTransitionState,
} from "./effects";

import {
  createDialogState,
  updateDialog,
  advanceDialog,
  openCharacterDialog,
  openCatDialog,
  openDialog,
} from "./dialog";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PARTICLES = 200;
const SPECTATOR_CYCLE_INTERVAL = 10; // seconds between spectator target changes
const ZZZ_INTERVAL = 2.0;
const TYPING_SPARK_INTERVAL = 0.4;
const STEAM_INTERVAL = 0.15;
const BIRD_MIN_INTERVAL = 20;
const BIRD_MAX_INTERVAL = 30;
const CLOUD_MIN_INTERVAL = 10;
const CLOUD_MAX_INTERVAL = 15;
const MUSIC_NOTE_INTERVAL = 3;

// ---------------------------------------------------------------------------
// OfficeStateManager
// ---------------------------------------------------------------------------

export class OfficeStateManager {
  private floors: Map<FloorId, FloorData>;
  private state: GameState;
  private input: InputState;

  // Particle spawn timers
  private zzzTimer = 0;
  private steamTimer = 0;
  private typingSparkTimer = 0;
  private birdTimer: number;
  private cloudTimer: number;
  private musicTimer = 0;
  private rainTimer = 0;
  private starTimer = 0;

  // Spectator mode
  private spectatorCycleTimer = 0;

  constructor() {
    // 1. Build all 4 floors
    this.floors = buildAllFloors();

    // 2. Create player character
    const player = createPlayer(FloorId.GROUND);

    // 3. Create cat
    const cat = createCat(FloorId.GROUND);

    // 4. Create server LEDs for basement server racks
    const serverLeds = this.buildServerLeds();

    // 5. Create monitors for ground floor desks
    const monitors = this.buildMonitors();

    // 6. Initialize game state
    this.state = {
      currentFloor: FloorId.GROUND,
      characters: [],
      player,
      cat,
      camera: {
        x: player.x - FLOOR_WIDTH / 2,
        y: player.y - FLOOR_HEIGHT / 2,
        targetX: player.x - FLOOR_WIDTH / 2,
        targetY: player.y - FLOOR_HEIGHT / 2,
        spectatorMode: false,
        spectatorTargetId: null,
        idleTimer: 0,
      },
      dialog: createDialogState(),
      environment: createEnvironmentState(),
      transition: createTransitionState(),
      particles: [],
      serverLeds,
      monitors,
      achievements: new Set<string>(),
      frame: 0,
      time: 0,
    };

    // 7. Initialize input state
    this.input = createInputState();

    // 8. Randomize ambient timers
    this.birdTimer = BIRD_MIN_INTERVAL + Math.random() * (BIRD_MAX_INTERVAL - BIRD_MIN_INTERVAL);
    this.cloudTimer = CLOUD_MIN_INTERVAL + Math.random() * (CLOUD_MAX_INTERVAL - CLOUD_MIN_INTERVAL);
  }

  // =========================================================================
  // Public Getters
  // =========================================================================

  getState(): GameState {
    return this.state;
  }

  getFloors(): Map<FloorId, FloorData> {
    return this.floors;
  }

  getInput(): InputState {
    return this.input;
  }

  // =========================================================================
  // Keyboard Input
  // =========================================================================

  handleKeyDown(key: string): void {
    // Any key resets idle timer (exits spectator mode)
    this.state.camera.idleTimer = 0;
    if (this.state.camera.spectatorMode) {
      this.exitSpectatorMode();
    }

    // During transition, suppress ALL input
    if (this.state.transition.kind !== "none") {
      return;
    }

    // During dialog, only allow interact and ESC
    if (this.state.dialog.active) {
      if (key === " " || key === "Enter") {
        this.state.dialog = advanceDialog(this.state.dialog);
      } else if (key === "Escape") {
        this.state.dialog = {
          ...this.state.dialog,
          active: false,
        };
      }
      return;
    }

    switch (key) {
      case "ArrowUp":
      case "w":
      case "W":
        this.input.up = true;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        this.input.down = true;
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        this.input.left = true;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        this.input.right = true;
        break;
      case " ":
      case "Enter":
        this.input.interact = true;
        break;
      case "Tab":
        this.cycleSpectatorTarget();
        break;
      case "Escape":
        // Already handled above if dialog active
        break;
    }
  }

  handleKeyUp(key: string): void {
    switch (key) {
      case "ArrowUp":
      case "w":
      case "W":
        this.input.up = false;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        this.input.down = false;
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        this.input.left = false;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        this.input.right = false;
        break;
    }
  }

  // =========================================================================
  // Mouse Interaction
  // =========================================================================

  handleClick(character: Character | null, isCat: boolean): void {
    if (this.state.transition.kind !== "none") return;

    if (this.state.dialog.active) {
      this.state.dialog = advanceDialog(this.state.dialog);
      return;
    }

    if (isCat) {
      this.state.dialog = openCatDialog(this.state.dialog);
      return;
    }

    if (character && !character.isPlayer) {
      this.state.dialog = openCharacterDialog(this.state.dialog, character);
    }
  }

  // =========================================================================
  // Main Update Loop
  // =========================================================================

  update(dt: number): void {
    // 1. Cap delta time
    dt = Math.min(dt, MAX_DELTA);

    // 2. Update transition (if active, skip everything else)
    if (this.state.transition.kind !== "none") {
      this.updateTransition(dt);
      return;
    }

    // 3. Update dialog (if active)
    if (this.state.dialog.active) {
      this.state.dialog = updateDialog(this.state.dialog, dt);
    }

    // 4. Update environment (time of day, weather)
    this.state.environment = updateEnvironment(this.state.environment, dt);

    // 5. Update player
    const currentFloor = this.getCurrentFloor();
    const interacting = updatePlayer(this.state.player, this.input, currentFloor, dt);
    if (interacting) {
      this.handleInteraction();
    }

    // 6. Check stair tiles
    this.checkStairs();

    // 7. Check special tiles (secret room, achievements)
    this.checkSpecialTiles();

    // 8. Update all NPC characters on the current floor
    for (const char of this.state.characters) {
      if (char.floor === this.state.currentFloor) {
        updateCharacter(char, currentFloor, dt, this.state.characters);
      }
    }

    // 9. Update cat
    const catFloor = this.getFloor(this.state.cat.floor);
    updateCat(this.state.cat, catFloor, dt, this.state.characters, this.state.player);

    // 10. Update camera (follow player or spectator target)
    this.updateCamera(dt);

    // 11. Update server LEDs (if on basement)
    if (this.state.currentFloor === FloorId.BASEMENT) {
      updateServerLeds(this.state.serverLeds, dt);
    }

    // 12. Update monitor animations
    for (const mon of this.state.monitors) {
      updateMonitorAnim(mon, dt);
    }

    // 13. Spawn particles based on character states and environment
    this.spawnParticles(dt);

    // 14. Update particles
    this.state.particles = updateParticles(
      this.state.particles,
      dt,
      this.state.currentFloor,
    );

    // Cap particle count
    if (this.state.particles.length > MAX_PARTICLES) {
      this.state.particles = this.state.particles.slice(-MAX_PARTICLES);
    }

    // 15. Reset one-shot input
    this.input.interact = false;

    // 16. Advance frame counter
    this.state.frame++;
    this.state.time += dt;

    // 17. Update spectator idle timer
    this.updateSpectatorMode(dt);
  }

  // =========================================================================
  // Agent Sync (called from API polling)
  // =========================================================================

  updateAgents(agents: OfficeAgent[]): void {
    const existingIds = new Set(this.state.characters.map((c) => c.id));
    const incomingIds = new Set(agents.map((a) => a.id));
    const groundFloor = this.getFloor(FloorId.GROUND);

    // Update existing characters
    for (const char of this.state.characters) {
      const agent = agents.find((a) => a.id === char.id);
      if (agent) {
        syncCharacterWithAgent(char, agent);
      }
    }

    // Add new characters
    for (const agent of agents) {
      if (!existingIds.has(agent.id)) {
        const deskIndex = this.findNextAvailableDesk(groundFloor);
        const desk = deskIndex >= 0 ? groundFloor.desks[deskIndex] : null;

        if (desk) {
          desk.assignedTo = agent.id;
        }

        const char = createCharacter(
          agent,
          desk,
          deskIndex >= 0 ? deskIndex : this.state.characters.length,
          FloorId.GROUND,
        );
        this.state.characters.push(char);
      }
    }

    // Remove characters whose agents are no longer in the list
    const removedChars = this.state.characters.filter(
      (c) => !incomingIds.has(c.id),
    );
    for (const removed of removedChars) {
      // Free up desk assignment
      if (removed.desk) {
        removed.desk.assignedTo = null;
      }
    }
    this.state.characters = this.state.characters.filter(
      (c) => incomingIds.has(c.id),
    );

    // Update monitor activities based on character state
    this.syncMonitors();
  }

  // =========================================================================
  // Private: Floor Helpers
  // =========================================================================

  private getCurrentFloor(): FloorData {
    return this.getFloor(this.state.currentFloor);
  }

  private getFloor(id: FloorId): FloorData {
    const floor = this.floors.get(id);
    if (!floor) {
      throw new Error(`Floor ${id} not found`);
    }
    return floor;
  }

  private findNextAvailableDesk(floor: FloorData): number {
    for (let i = 0; i < floor.desks.length; i++) {
      if (floor.desks[i].assignedTo === null) {
        return i;
      }
    }
    return -1;
  }

  // =========================================================================
  // Private: Transition
  // =========================================================================

  private updateTransition(dt: number): void {
    const prev = this.state.transition;
    const next = updateTransitionState(prev, dt);

    // Detect the moment fadeOut completes and fadeIn begins
    if (prev.kind === "fadeOut" && next.kind === "fadeIn") {
      this.performFloorSwitch();
    }

    this.state.transition = next;
  }

  private performFloorSwitch(): void {
    const targetFloor = this.state.transition.targetFloor;
    if (targetFloor === null) return;

    const newFloor = this.getFloor(targetFloor);
    this.state.currentFloor = targetFloor;

    // Move player to the corresponding stairs on the new floor
    // If we went UP, we arrive at stairsUp. If we went DOWN, we arrive at stairsDown.
    const oldFloor = this.state.player.floor;
    let arrivalPos = newFloor.stairsDown; // default

    if (targetFloor === FloorId.UPPER || targetFloor === FloorId.ROOFTOP) {
      // We came from below, so we arrive at stairsUp on the old floor's perspective
      // But on the new floor, we arrive at the stairs that lead back down
      arrivalPos = newFloor.stairsDown;
    }
    if (targetFloor === FloorId.GROUND) {
      // Arriving at ground: came from upper (arrive at stairsUp) or from basement (arrive at stairsDown)
      if (oldFloor === FloorId.UPPER || oldFloor === FloorId.ROOFTOP) {
        arrivalPos = newFloor.stairsUp;
      } else {
        arrivalPos = newFloor.stairsDown;
      }
    }
    if (targetFloor === FloorId.BASEMENT) {
      // Arriving at basement from ground: arrive at stairsUp
      arrivalPos = newFloor.stairsUp;
    }

    if (arrivalPos) {
      this.state.player.col = arrivalPos.col;
      this.state.player.row = arrivalPos.row;
      this.state.player.x = arrivalPos.col * TILE_SIZE;
      this.state.player.y = arrivalPos.row * TILE_SIZE;
    }

    this.state.player.floor = targetFloor;
    this.state.player.path = [];
    this.state.player.pathIndex = 0;
    this.state.player.moveProgress = 0;
    this.state.player.state = "idle";

    // Snap camera to new position
    this.state.camera.x = this.state.player.x - FLOOR_WIDTH / 2;
    this.state.camera.y = this.state.player.y - FLOOR_HEIGHT / 2;
    this.state.camera.targetX = this.state.camera.x;
    this.state.camera.targetY = this.state.camera.y;
  }

  // =========================================================================
  // Private: Stairs Check
  // =========================================================================

  private checkStairs(): void {
    // Don't start a transition if one is already in progress
    if (this.state.transition.kind !== "none") return;
    // Don't check stairs while player is moving between tiles
    if (this.state.player.moveProgress > 0) return;

    const floor = this.getCurrentFloor();
    const tile = getTileAt(floor, this.state.player.col, this.state.player.row);

    if (tile === TileType.STAIRS_UP) {
      const targetFloor = this.getStairsUpTarget(this.state.currentFloor);
      if (targetFloor !== null) {
        this.state.transition = startTransition(targetFloor);
      }
    } else if (tile === TileType.STAIRS_DOWN) {
      const targetFloor = this.getStairsDownTarget(this.state.currentFloor);
      if (targetFloor !== null) {
        this.state.transition = startTransition(targetFloor);
      }
    }
  }

  private getStairsUpTarget(current: FloorId): FloorId | null {
    switch (current) {
      case FloorId.GROUND:
        return FloorId.UPPER;
      case FloorId.UPPER:
        return FloorId.ROOFTOP;
      case FloorId.BASEMENT:
        return FloorId.GROUND;
      case FloorId.ROOFTOP:
        return null; // no stairs up from rooftop
    }
  }

  private getStairsDownTarget(current: FloorId): FloorId | null {
    switch (current) {
      case FloorId.GROUND:
        return FloorId.BASEMENT;
      case FloorId.UPPER:
        return FloorId.GROUND;
      case FloorId.ROOFTOP:
        return FloorId.UPPER;
      case FloorId.BASEMENT:
        return null; // no stairs down from basement
    }
  }

  // =========================================================================
  // Private: Special Tiles
  // =========================================================================

  private checkSpecialTiles(): void {
    if (this.state.player.moveProgress > 0) return;

    const floor = this.getCurrentFloor();
    for (const special of floor.secretTiles) {
      if (
        this.state.player.col === special.pos.col &&
        this.state.player.row === special.pos.row
      ) {
        if (special.kind === "secretDoor" && special.data) {
          if (!this.state.achievements.has("secretDoor")) {
            this.state.achievements.add("secretDoor");
            this.state.dialog = openDialog(
              this.state.dialog,
              "???",
              "\u{1F510}",
              special.data,
            );
            this.spawnAchievementBurst();
          }
        } else if (special.kind === "achievement" && special.data) {
          if (!this.state.achievements.has(special.data)) {
            this.state.achievements.add(special.data);
            this.state.dialog = openDialog(
              this.state.dialog,
              "Achievement",
              "\u{2B50}",
              `Achievement unlocked: ${special.data}!`,
            );
            this.spawnAchievementBurst();
          }
        } else if (special.kind === "arcade") {
          if (!this.state.achievements.has("arcade")) {
            this.state.achievements.add("arcade");
            this.state.dialog = openDialog(
              this.state.dialog,
              "Arcade Machine",
              "\u{1F3AE}",
              "INSERT COIN... Just kidding. High score: 999999!",
            );
            this.spawnAchievementBurst();
          }
        }
      }
    }
  }

  private spawnAchievementBurst(): void {
    const px = this.state.player.x + TILE_SIZE / 2;
    const py = this.state.player.y;
    for (let i = 0; i < 12; i++) {
      this.state.particles.push(
        createParticle("achievement", px, py, this.state.currentFloor),
      );
    }
  }

  // =========================================================================
  // Private: Interaction
  // =========================================================================

  private handleInteraction(): void {
    // If dialog is active, advance it
    if (this.state.dialog.active) {
      this.state.dialog = advanceDialog(this.state.dialog);
      return;
    }

    // Find nearest interactable
    const result = getNearestInteractable(
      this.state.player,
      this.state.characters,
      this.state.cat,
    );

    if (!result) return;

    if (result.type === "character") {
      this.state.dialog = openCharacterDialog(
        this.state.dialog,
        result.target,
      );
    } else if (result.type === "cat") {
      this.state.dialog = openCatDialog(this.state.dialog);
    }
  }

  // =========================================================================
  // Private: Camera
  // =========================================================================

  private updateCamera(dt: number): void {
    let followX: number;
    let followY: number;

    if (this.state.camera.spectatorMode && this.state.camera.spectatorTargetId) {
      const target = this.state.characters.find(
        (c) => c.id === this.state.camera.spectatorTargetId,
      );
      if (target && target.floor === this.state.currentFloor) {
        followX = target.x;
        followY = target.y;
      } else {
        followX = this.state.player.x;
        followY = this.state.player.y;
      }
    } else {
      followX = this.state.player.x;
      followY = this.state.player.y;
    }

    // Center camera on follow target
    this.state.camera.targetX = followX - FLOOR_WIDTH / 2;
    this.state.camera.targetY = followY - FLOOR_HEIGHT / 2;

    // Smooth interpolation (lerp)
    const lerpFactor = 1 - Math.pow(1 - CAMERA_LERP, dt * 60);
    this.state.camera.x += (this.state.camera.targetX - this.state.camera.x) * lerpFactor;
    this.state.camera.y += (this.state.camera.targetY - this.state.camera.y) * lerpFactor;
  }

  // =========================================================================
  // Private: Spectator Mode
  // =========================================================================

  private updateSpectatorMode(dt: number): void {
    // Only accumulate idle time when no movement keys are pressed
    const hasInput =
      this.input.up || this.input.down || this.input.left || this.input.right;

    if (hasInput) {
      this.state.camera.idleTimer = 0;
      if (this.state.camera.spectatorMode) {
        this.exitSpectatorMode();
      }
      return;
    }

    this.state.camera.idleTimer += dt;

    if (
      !this.state.camera.spectatorMode &&
      this.state.camera.idleTimer > SPECTATOR_TIMEOUT
    ) {
      this.enterSpectatorMode();
    }

    // Cycle spectator target
    if (this.state.camera.spectatorMode) {
      this.spectatorCycleTimer += dt;
      if (this.spectatorCycleTimer >= SPECTATOR_CYCLE_INTERVAL) {
        this.spectatorCycleTimer = 0;
        this.pickNextSpectatorTarget();
      }
    }
  }

  private enterSpectatorMode(): void {
    this.state.camera.spectatorMode = true;
    this.spectatorCycleTimer = 0;
    this.pickNextSpectatorTarget();
  }

  private exitSpectatorMode(): void {
    this.state.camera.spectatorMode = false;
    this.state.camera.spectatorTargetId = null;
    this.spectatorCycleTimer = 0;
  }

  private pickNextSpectatorTarget(): void {
    // Prefer characters that are typing (most active)
    const typing = this.state.characters.filter(
      (c) => c.floor === this.state.currentFloor && c.state === "type",
    );
    if (typing.length > 0) {
      // Pick a different target than current if possible
      const others = typing.filter(
        (c) => c.id !== this.state.camera.spectatorTargetId,
      );
      const pool = others.length > 0 ? others : typing;
      this.state.camera.spectatorTargetId =
        pool[Math.floor(Math.random() * pool.length)].id;
      return;
    }

    // Fallback: any character on the current floor
    const onFloor = this.state.characters.filter(
      (c) => c.floor === this.state.currentFloor,
    );
    if (onFloor.length > 0) {
      const others = onFloor.filter(
        (c) => c.id !== this.state.camera.spectatorTargetId,
      );
      const pool = others.length > 0 ? others : onFloor;
      this.state.camera.spectatorTargetId =
        pool[Math.floor(Math.random() * pool.length)].id;
      return;
    }

    this.state.camera.spectatorTargetId = null;
  }

  private cycleSpectatorTarget(): void {
    if (this.state.characters.length === 0) return;

    const onFloor = this.state.characters.filter(
      (c) => c.floor === this.state.currentFloor,
    );
    if (onFloor.length === 0) return;

    const currentIdx = onFloor.findIndex(
      (c) => c.id === this.state.camera.spectatorTargetId,
    );
    const nextIdx = (currentIdx + 1) % onFloor.length;
    this.state.camera.spectatorTargetId = onFloor[nextIdx].id;

    // Briefly enter spectator mode to follow the target
    if (!this.state.camera.spectatorMode) {
      this.state.camera.spectatorMode = true;
    }
    this.spectatorCycleTimer = 0;
  }

  // =========================================================================
  // Private: Particle Spawning
  // =========================================================================

  private spawnParticles(dt: number): void {
    if (this.state.particles.length >= MAX_PARTICLES) return;

    const floor = this.state.currentFloor;

    // --- Characters typing: occasional typing sparks ---
    this.typingSparkTimer += dt;
    if (this.typingSparkTimer >= TYPING_SPARK_INTERVAL) {
      this.typingSparkTimer = 0;
      for (const char of this.state.characters) {
        if (
          char.floor === floor &&
          char.state === "type" &&
          this.state.particles.length < MAX_PARTICLES
        ) {
          if (Math.random() < 0.4) {
            this.state.particles.push(
              createParticle(
                "typingSpark",
                char.x + TILE_SIZE / 2,
                char.y - 2,
                floor,
              ),
            );
          }
        }
      }
    }

    // --- Characters sleeping: zzz particles ---
    this.zzzTimer += dt;
    if (this.zzzTimer >= ZZZ_INTERVAL) {
      this.zzzTimer = 0;
      for (const char of this.state.characters) {
        if (
          char.floor === floor &&
          char.state === "sleep" &&
          this.state.particles.length < MAX_PARTICLES
        ) {
          this.state.particles.push(
            createParticle("zzz", char.x + 12, char.y - 4, floor),
          );
        }
      }
      // Cat sleeping
      if (
        this.state.cat.floor === floor &&
        this.state.cat.state === "sleep" &&
        this.state.cat.path.length === 0 &&
        this.state.particles.length < MAX_PARTICLES
      ) {
        this.state.particles.push(
          createParticle("zzz", this.state.cat.x + 6, this.state.cat.y - 2, floor),
        );
      }
    }

    // --- Coffee machine in use: steam particles ---
    const someoneGettingCoffee = this.state.characters.some(
      (c) => c.floor === floor && c.coffeeState === "brewing",
    );
    if (someoneGettingCoffee) {
      this.steamTimer += dt;
      if (this.steamTimer >= STEAM_INTERVAL) {
        this.steamTimer = 0;
        const currentFloorData = this.getCurrentFloor();
        if (
          currentFloorData.coffeeMachine &&
          this.state.particles.length < MAX_PARTICLES
        ) {
          this.state.particles.push(
            createParticle(
              "coffeeSteam",
              currentFloorData.coffeeMachine.col * TILE_SIZE + 7,
              currentFloorData.coffeeMachine.row * TILE_SIZE - 2,
              floor,
            ),
          );
        }
      }
    } else {
      this.steamTimer = 0;
    }

    // --- Rain: rain particles on rooftop or window tiles ---
    if (this.state.environment.weather === "rain") {
      this.rainTimer += dt;
      if (this.rainTimer >= 0.05) {
        this.rainTimer = 0;
        if (floor === FloorId.ROOFTOP) {
          // Rain drops across the rooftop
          if (this.state.particles.length < MAX_PARTICLES) {
            const rx = Math.random() * FLOOR_WIDTH;
            this.state.particles.push(createParticle("rain", rx, 0, floor));
          }
        } else {
          // Rain visible through windows on indoor floors
          const currentFloorData = this.getCurrentFloor();
          if (this.state.particles.length < MAX_PARTICLES) {
            // Find window tiles in top row
            for (let c = 0; c < currentFloorData.tiles[0].length; c++) {
              if (
                currentFloorData.tiles.length > 2 &&
                currentFloorData.tiles[2][c] === TileType.WINDOW &&
                Math.random() < 0.1 &&
                this.state.particles.length < MAX_PARTICLES
              ) {
                this.state.particles.push(
                  createParticle(
                    "rain",
                    c * TILE_SIZE + Math.random() * TILE_SIZE,
                    2 * TILE_SIZE,
                    floor,
                  ),
                );
              }
            }
          }
        }
      }
    }

    // --- Night: star particles in windows ---
    if (this.state.environment.timeOfDay === "night") {
      this.starTimer += dt;
      if (this.starTimer >= 1.0) {
        this.starTimer = 0;
        if (
          floor !== FloorId.ROOFTOP &&
          this.state.particles.length < MAX_PARTICLES
        ) {
          const currentFloorData = this.getCurrentFloor();
          // Scatter stars in window tiles
          for (let c = 0; c < currentFloorData.tiles[0].length; c++) {
            if (
              currentFloorData.tiles.length > 2 &&
              currentFloorData.tiles[2][c] === TileType.WINDOW &&
              Math.random() < 0.15 &&
              this.state.particles.length < MAX_PARTICLES
            ) {
              this.state.particles.push(
                createParticle(
                  "star",
                  c * TILE_SIZE + Math.random() * TILE_SIZE,
                  2 * TILE_SIZE + Math.random() * TILE_SIZE,
                  floor,
                ),
              );
            }
          }
        }
        // Stars visible on rooftop
        if (floor === FloorId.ROOFTOP && this.state.particles.length < MAX_PARTICLES) {
          for (let i = 0; i < 3; i++) {
            if (this.state.particles.length < MAX_PARTICLES) {
              this.state.particles.push(
                createParticle(
                  "star",
                  Math.random() * FLOOR_WIDTH,
                  Math.random() * TILE_SIZE * 2,
                  floor,
                ),
              );
            }
          }
        }
      }
    }

    // --- Rooftop: birds every 20-30s ---
    if (floor === FloorId.ROOFTOP) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer =
          BIRD_MIN_INTERVAL + Math.random() * (BIRD_MAX_INTERVAL - BIRD_MIN_INTERVAL);
        if (this.state.particles.length < MAX_PARTICLES) {
          const birdY = TILE_SIZE * (2 + Math.random() * 4);
          this.state.particles.push(createParticle("bird", 0, birdY, floor));
        }
      }
    }

    // --- Rooftop: clouds every 10-15s ---
    if (floor === FloorId.ROOFTOP) {
      this.cloudTimer -= dt;
      if (this.cloudTimer <= 0) {
        this.cloudTimer =
          CLOUD_MIN_INTERVAL + Math.random() * (CLOUD_MAX_INTERVAL - CLOUD_MIN_INTERVAL);
        if (this.state.particles.length < MAX_PARTICLES) {
          const cloudY = TILE_SIZE * (1 + Math.random() * 3);
          this.state.particles.push(createParticle("cloud", 0, cloudY, floor));
        }
      }
    }

    // --- Lounge (upper floor): occasional music note particles ---
    if (floor === FloorId.UPPER) {
      this.musicTimer += dt;
      if (this.musicTimer >= MUSIC_NOTE_INTERVAL) {
        this.musicTimer = 0;
        if (Math.random() < 0.3 && this.state.particles.length < MAX_PARTICLES) {
          // Music notes near the TV/lounge area (cols 16-18, rows 5-6)
          const mx = (16 + Math.random() * 3) * TILE_SIZE;
          const my = (5 + Math.random() * 2) * TILE_SIZE;
          this.state.particles.push(createParticle("music", mx, my, floor));
        }
      }
    }
  }

  // =========================================================================
  // Private: Server LEDs
  // =========================================================================

  private buildServerLeds(): ServerLed[] {
    const basement = this.floors.get(FloorId.BASEMENT);
    if (!basement) return [];

    const rackPositions: Array<{ x: number; y: number }> = [];
    for (const furn of basement.furniture) {
      if (furn.kind === "serverRack") {
        rackPositions.push({
          x: furn.col * TILE_SIZE,
          y: furn.row * TILE_SIZE,
        });
      }
    }

    return createServerLeds(rackPositions);
  }

  // =========================================================================
  // Private: Monitor Animations
  // =========================================================================

  private buildMonitors(): MonitorAnim[] {
    const ground = this.floors.get(FloorId.GROUND);
    if (!ground) return [];

    // Also include basement desk if present
    const basement = this.floors.get(FloorId.BASEMENT);
    const allDesks = [
      ...ground.desks.map((_, i) => i),
      ...(basement ? basement.desks.map((_, i) => i + ground.desks.length) : []),
    ];

    return allDesks.map((idx) => createMonitorAnim(idx));
  }

  private syncMonitors(): void {
    const groundFloor = this.getFloor(FloorId.GROUND);

    for (const mon of this.state.monitors) {
      // Find the character assigned to this desk index
      const char = this.state.characters.find(
        (c) => c.deskIndex === mon.deskIndex && c.deskIndex < groundFloor.desks.length,
      );

      if (char) {
        mon.activity = char.targetActivity;
      } else {
        mon.activity = "off";
      }
    }
  }
}
