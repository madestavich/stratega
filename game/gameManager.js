import { ConfigLoader } from "../import.js";
import { ObjectManager } from "../import.js";
import { GridManager } from "../import.js";
import { ActionManager } from "../import.js";
import { InputManager } from "../import.js";
import { SpriteLoader } from "../import.js";
import { Player } from "../import.js";
import { InterfaceManager } from "../import.js";
import { MapRenderer } from "../game_map/mapRender.js";
import { battleLogger } from "./battleLogger.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 1200;
canvas.height = 800;

class GameManager {
  constructor() {
    this.lastTime = 0;
    this.deltaTime = 0;
    // Use same timestep for both movement and animations for perfect sync
    // 36 FPS for movement, animations update every 3rd tick = 12 FPS
    this.moveTimeStep = Math.round(1000 / 36); // ~28ms
    this.fixedTimeStep = this.moveTimeStep * 3; // Exactly 84ms (12 FPS)
    this.accumulator = 0;
    this.moveAccumulator = 0;
    this.animationTickCounter = 0; // Counter for animation updates (every 3rd movement tick)
    this.debugMode = false;
    this.debugInterval = null;
    this.aoeDebugCells = null; // Cells to highlight for AoE attack debug
    this.isRunning = true;
    this.player = null;

    // Round management
    this.roundTimer = null;
    this.roundTimeLeft = 0;
    this.roundDuration = 30; // Default 30 seconds - буде оновлено з сервера
    this.isRoundActive = false;
    this.checkStatusInterval = null;
    this.isPaused = true; // Game starts paused during unit placement
    this.isRoomCreator; // Will be set during initialization
    this.currentUserId = null; // Current user ID - will be set during initialization

    // Battle disconnection handling
    this.battleDisconnected = false;
    this.battleCheckInterval = null;
    this.waitingForBattleEnd = false;
    this.battleEndProcessing = false; // Flag to prevent multiple battle end calls

    // Heartbeat system for tracking player online status
    this.heartbeatInterval = null;

    // Opponent offline tracking
    this.opponentOffline = false;
    this.opponentCheckInterval = null;

    // Flag to start battle after load (for deadlock recovery)
    this.shouldStartBattleAfterLoad = false;

    // Flag to allow reload without warning
    this.allowReload = false;

    // Flag to track if battle is in progress
    this.isBattleInProgress = false;

    //! ініціалізація об'єктів і інших менеджерів

    this.configLoader = new ConfigLoader();
    this.spriteLoader = new SpriteLoader(this.configLoader);

    // Initialize map renderer with default map
    this.mapRenderer = new MapRenderer("default_map.png");

    this.gridManager = new GridManager(ctx, {
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      rows: 80,
      cols: 70,
      skyRows: 16,
    });
    this.objectManager = new ObjectManager(
      ctx,
      this.gridManager,
      this.configLoader,
      this.spriteLoader
    );
    // Додаємо зворотне посилання для доступу до isRoomCreator
    this.objectManager.gameManager = this;
    this.actionManager = new ActionManager(this.objectManager);
    this.inputManager = new InputManager(canvas, this);

    this.interfaceManager = new InterfaceManager(
      this.spriteLoader,
      this.configLoader
    );

    document.addEventListener("keydown", (e) => {
      if (e.key === "`") {
        this.toggleDebugMode();
      }
    });

    // Prevent page refresh during battle
    window.addEventListener("beforeunload", (e) => {
      // Allow reload if explicitly permitted (e.g., after round ends)
      if (this.allowReload) {
        return;
      }

      // Show warning if battle is actively running
      if (this.isBattleInProgress && !this.battleDisconnected) {
        e.preventDefault();
        e.returnValue =
          "Бій активний! Якщо ви оновите сторінку, вам доведеться чекати завершення бою противником.";
        return e.returnValue;
      }
    });

    this.start();
  }

  toggleDebugMode() {
    this.debugMode = !this.debugMode;

    if (this.debugMode) {
      console.log(
        "%c Debug mode enabled.",
        "background: #222; color:rgb(47, 201, 9); font-size: 14px;"
      );

      // Оновлюємо сітку одразу при включенні режиму дебагу
      this.gridManager.updateGridObjects(this.objectManager);
    } else {
      console.log(
        "%c Debug mode disabled.",
        "background: #222; color:rgb(255, 38, 0); font-size: 14px;"
      );
      clearInterval(this.debugInterval);
    }

    // Викликаємо render для негайного відображення змін
    this.render();
  }

  async loadUnitIcons(race) {
    // Get all units for the race
    const raceData = this.configLoader.racesConfig[race];
    if (!raceData) return;

    // Collect all unit keys that need icons
    const unitKeys = [];
    Object.values(raceData.units).forEach((tier) => {
      Object.keys(tier).forEach((unitKey) => {
        unitKeys.push(`${unitKey}_icon`);
      });
    });

    // Load sprites for all unit icons
    if (unitKeys.length > 0) {
      await this.spriteLoader.loadSprites(unitKeys);
    }
  }

  async reloadUnitIcons() {
    console.log("Reloading unit icons for interface...");
    if (this.player && this.player.race) {
      await this.loadUnitIcons(this.player.race);
      console.log(`Unit icons reloaded for race: ${this.player.race}`);
    }
  }

  async start() {
    await this.configLoader.loadRacesConfig();
    await this.objectManager.effectManager.loadEffectsConfig();
    await this.objectManager.initializeGame();

    // Determine if current player is room creator
    const roomInfo = await this.objectManager.getCurrentRoomId();
    if (roomInfo) {
      this.isRoomCreator = roomInfo.isCreator;

      // Get current user ID
      const lobbyState = await this.getRoomSettings();
      if (lobbyState) {
        this.currentUserId = this.isRoomCreator
          ? lobbyState.player1_id
          : lobbyState.player2_id;
      }

      // Після визначення ролі гравця оновлюємо напрямок погляду для всіх юнітів
      for (const unit of this.objectManager.objects) {
        unit.setLookDirectionByTeam();
      }
      for (const unit of this.objectManager.enemyObjects) {
        unit.setLookDirectionByTeam();
      }
    }

    // Check if we reconnected during battle
    const battleState = await this.checkBattleState();
    if (battleState && battleState.battle_started) {
      console.log("Reconnected during battle - checking situation...");

      // Check if BOTH players are not in battle
      const bothDisconnected =
        !battleState.player1_in_battle && !battleState.player2_in_battle;

      if (bothDisconnected) {
        // Both not in battle - both refreshed page or both left
        console.log(
          "Both players not in battle - restarting battle for everyone"
        );

        // Everyone who reconnects will restart the battle
        // This handles both cases:
        // 1. Both just refreshed F5 -> both will play
        // 2. Both left and came back -> both will play
        this.shouldStartBattleAfterLoad = true;
      } else {
        // One player still in battle - wait normally
        console.log("Other player is in battle - entering waiting mode");
        await this.handleBattleDisconnection(battleState);
        return; // Don't continue normal initialization
      }
    }

    // Load room settings from lobby
    console.log(
      "START: About to call getRoomSettings, currentRoomId =",
      this.objectManager.currentRoomId
    );
    const roomSettings = await this.getRoomSettings();
    console.log("Room settings loaded:", roomSettings);

    // Determine player race based on game mode
    let playerRace = "all"; // Default
    if (roomSettings.game_mode === "classic") {
      // Get race from room settings
      playerRace = this.isRoomCreator
        ? roomSettings.player1_race
        : roomSettings.player2_race;

      if (!playerRace) {
        playerRace = "all";
      }
    }

    // Create player with correct team based on room role
    const playerTeam = this.isRoomCreator ? 1 : 2;
    this.player = new Player({
      nickname: "Player1",
      race: playerRace,
      team: playerTeam,
      coins: 100,
      gameManager: this,
      roomId: roomInfo?.roomId || this.objectManager.currentRoomId,
      // Pass room settings to player
      startingMoney: roomSettings.starting_money || 1000,
      roundIncome: roomSettings.round_income || 200,
      maxUnitLimit: roomSettings.max_unit_limit || 40,
    });

    console.log(`Player created with team: ${playerTeam}, race: ${playerRace}`);

    // Initialize player resources from database (will override with DB values if they exist)
    await this.player.initializeResources();
    console.log("After initializeResources, money:", this.player.money);

    // Check if we should add income after battle (using localStorage flag)
    const shouldAddIncome = localStorage.getItem(
      `add_income_after_reload_${this.objectManager.currentRoomId}`
    );

    if (shouldAddIncome === "true") {
      console.log("Battle just ended - adding round income");
      await this.player.addRoundIncome();
      console.log("After addRoundIncome, money:", this.player.money);

      // Clear the flag
      localStorage.removeItem(
        `add_income_after_reload_${this.objectManager.currentRoomId}`
      );
    }

    this.interfaceManager.updatePlayerInterface(this.player);
    console.log("After updatePlayerInterface, money:", this.player.money);

    // Set round duration from room settings
    this.roundDuration = roomSettings.round_time || 45;
    console.log(`Round duration set to: ${this.roundDuration} seconds`);

    // Get round duration from server first (for sync)
    await this.getRoundDuration();

    // Start heartbeat system
    this.startHeartbeat();

    // Start checking opponent online status (for unit placement phase)
    this.startOpponentCheck();

    // Show debug info from previous increment if exists
    this.showIncrementDebugHistory();

    // Hide loading screen after everything is ready
    this.hideLoadingScreen();

    // If we detected deadlock, start battle automatically
    if (this.shouldStartBattleAfterLoad) {
      console.log("Starting battle after deadlock recovery...");
      this.shouldStartBattleAfterLoad = false;

      // Small delay to ensure everything is loaded
      setTimeout(() => {
        this.startGame();
      }, 1000);
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  hideLoadingScreen() {
    // Hide loading screen
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      loadingScreen.classList.add("hidden");
      // Remove from DOM after animation completes
      setTimeout(() => {
        loadingScreen.remove();
      }, 300);
    }

    // Smoothly fade out winner modal if it's visible (after reload from round end)
    const winnerModal = document.getElementById("round-winner-modal");
    if (winnerModal && winnerModal.style.display === "flex") {
      console.log(
        "Winner modal detected, will hide after 1.5s + 0.3s animation"
      );
      // Keep modal visible for 1.5 seconds before starting fade out
      setTimeout(() => {
        console.log("Starting fade-out animation");
        // Add fade-out class for smooth transition
        winnerModal.classList.add("fade-out");
        // Wait for animation to complete, then hide and start timer
        setTimeout(() => {
          console.log("Hiding modal and starting timer");
          // Don't remove display to prevent white flash - just make invisible
          winnerModal.style.opacity = "0";
          winnerModal.style.pointerEvents = "none";

          // Start round timer AFTER modal is hidden
          this.startRoundTimer();
        }, 300); // Fade animation duration (0.3 seconds)
      }, 1500); // Keep visible for 1.5 seconds

      // Don't start timer immediately - modal will start it after hiding
      return;
    }

    // If no winner modal, start timer immediately
    console.log("No winner modal, starting timer immediately");
    this.startRoundTimer();

    // Also hide waiting overlay if it's visible (should be hidden already)
    const waitingOverlay = document.getElementById("battle-waiting-overlay");
    if (waitingOverlay && waitingOverlay.style.display === "flex") {
      waitingOverlay.style.display = "none";
    }
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render map background first (lowest layer)
    this.mapRenderer.renderBackground(ctx, canvas.width, canvas.height);

    // Draw debug paths when debug mode is enabled
    if (this.debugMode) {
      this.gridManager.debugDrawGrid();
      this.gridManager.debugColorOccupiedCells();

      const moveAction = this.actionManager.actions.move;
      if (moveAction) {
        for (const obj of this.objectManager.objects) {
          // Only draw paths for objects that are alive and have a move target
          if (obj.moveTarget && !obj.isDead) {
            moveAction.debugDrawPath(obj);
          }
        }
        // Додаємо debug-лінії для другого гравця (enemyObjects, червоні)
        for (const obj of this.objectManager.enemyObjects) {
          if (obj.moveTarget && !obj.isDead) {
            // Use forceColor parameter to make enemy lines red
            moveAction.debugDrawPath(obj, "rgba(255,0,0,0.8)");
          }
        }
      }

      // Draw aura ranges for units with aura
      const auraAction = this.actionManager.actions.aura;
      if (auraAction) {
        for (const obj of this.objectManager.objects) {
          if (obj.auraConfig && !obj.isDead) {
            auraAction.debugDrawAuraRange(obj);
          }
        }
        for (const obj of this.objectManager.enemyObjects) {
          if (obj.auraConfig && !obj.isDead) {
            auraAction.debugDrawAuraRange(obj);
          }
        }
      }
    }
    // Draw the hover indicator
    this.inputManager.drawHoverIndicator(ctx);
    this.objectManager.renderAll();

    // Draw group selection indicators
    this.inputManager.drawGroupSelectionIndicators(ctx);

    // Рендеримо всі particles
    if (this.objectManager.particles) {
      for (const particle of this.objectManager.particles) {
        particle.draw();
      }
    }

    // Draw AoE attack cells LAST (on top of everything) in debug mode
    if (this.debugMode && this.aoeDebugCells) {
      this.gridManager.debugDrawAoECells(this.aoeDebugCells);
    }
  }

  loop(timestamp) {
    if (!this.isRunning) return;
    if (this.lastTime === 0) this.lastTime = timestamp;
    this.deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // Clamp deltaTime to prevent spiral of death and ensure determinism
    const maxDelta = 200; // Max 200ms (~5 FPS minimum)
    if (this.deltaTime > maxDelta) this.deltaTime = maxDelta;

    this.accumulator += this.deltaTime;
    this.moveAccumulator += this.deltaTime;

    // Цикл для РУХУ та АНІМАЦІЙ (36 FPS, анімації кожен 3-й тік = 12 FPS)
    while (this.moveAccumulator >= this.moveTimeStep) {
      // Check if this is an animation tick (every 3rd tick)
      const isAnimationTick = this.animationTickCounter % 3 === 0;

      // Update animations every 3rd tick (12 FPS) - ALWAYS, even when paused
      if (isAnimationTick) {
        const allObjects = [
          ...this.objectManager.objects,
          ...this.objectManager.enemyObjects,
        ];
        // Sort for deterministic animation order
        allObjects.sort((a, b) => a.id - b.id);
        for (const obj of allObjects) {
          if (obj.animator && !obj.animator.hasFinished) {
            obj.animator.nextFrame();
          }
        }
      }
      this.animationTickCounter++;

      if (!this.isPaused) {
        // Log tick state for determinism debugging (only in debug mode)
        if (this.debugMode) {
          battleLogger.logTick(this, isAnimationTick);
        }

        // Pass isAnimationTick to actionManager so attacks only process on animation frames
        this.actionManager.update(this.moveTimeStep, isAnimationTick);
        this.objectManager.updateParticles(this.moveTimeStep);
        this.objectManager.updateGridWithAllObjects();
      }
      this.moveAccumulator -= this.moveTimeStep;
      if (!this.isRunning) break;
    }

    // Effects update (12 FPS) - visual only, doesn't affect gameplay
    while (this.accumulator >= this.fixedTimeStep) {
      if (!this.isPaused) {
        this.objectManager.updateAll(this.fixedTimeStep);
      }

      this.accumulator -= this.fixedTimeStep;
      if (!this.isRunning) break;
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  // Round timer management
  async startRoundTimer() {
    if (!this.objectManager.currentRoomId) {
      console.warn("Cannot start round timer without room ID");
      return;
    }

    // Завжди запускаємо серверний таймер (сервер сам перевірить чи потрібно)
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "start_round_timer",
          room_id: this.objectManager.currentRoomId,
          duration: this.roundDuration,
        }),
      });

      const result = await response.json();
      if (result.success) {
        console.log(
          "Server round timer started/synced:",
          result.duration,
          "seconds"
        );
      } else {
        console.error("Failed to start server timer:", result.error);
      }
    } catch (error) {
      console.error("Error starting server timer:", error);
    }

    // Після запуску серверного таймера - отримуємо актуальний стан
    await this.checkRoundStatus();

    // В будь-якому разі запускаємо клієнтську синхронізацію
    if (!this.checkStatusInterval) {
      this.checkStatusInterval = setInterval(() => {
        this.checkRoundStatus();
      }, 1000);
    }
  }

  async pauseRoundTimer() {
    if (!this.objectManager.currentRoomId) {
      console.warn("Cannot pause round timer without room ID");
      return;
    }

    console.log("CLIENT: Calling pause_round_timer");

    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "pause_round_timer",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      const result = await response.json();
      if (result.success) {
        console.log(
          "CLIENT: Round timer paused:",
          result.time_left,
          "seconds left"
        );
      } else {
        console.error("CLIENT: Failed to pause timer:", result.error);
      }
    } catch (error) {
      console.error("CLIENT: Error pausing timer:", error);
    }
  }

  async resumeRoundTimer() {
    if (!this.objectManager.currentRoomId) {
      console.warn("Cannot resume round timer without room ID");
      return;
    }

    console.log("CLIENT: Calling resume_round_timer");

    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "resume_round_timer",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      const result = await response.json();
      if (result.success) {
        console.log(
          "CLIENT: Round timer resumed:",
          result.time_left,
          "seconds left"
        );
      } else {
        console.error("CLIENT: Failed to resume timer:", result.error);
      }
    } catch (error) {
      console.error("CLIENT: Error resuming timer:", error);
    }
  }

  async getRoomSettings() {
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "get_lobby_state",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const settings = {
          game_mode: result.settings.game_mode || "all_races",
          round_time: result.settings.round_time || 45,
          starting_money: result.settings.starting_money || 1000,
          round_income: result.settings.round_income || 200,
          max_unit_limit: result.settings.max_unit_limit || 40,
          player1_race: result.players.host?.race || null,
          player2_race: result.players.guest?.race || null,
          player1_id: result.players.host?.id || null,
          player2_id: result.players.guest?.id || null,
          player1_nickname: result.players.host?.username || null,
          player2_nickname: result.players.guest?.username || null,
          current_round: result.current_round || 1,
          winner_id: result.winner_id || null,
        };
        return settings;
      } else {
        return {
          game_mode: "all_races",
          round_time: 45,
          starting_money: 1000,
          round_income: 200,
          max_unit_limit: 40,
          player1_race: null,
          player2_race: null,
          player1_id: null,
          player2_id: null,
          player1_nickname: null,
          player2_nickname: null,
          current_round: 1,
          winner_id: null,
        };
      }
    } catch (error) {
      console.error("Error loading room settings:", error);
      return {
        game_mode: "all_races",
        round_time: 45,
        starting_money: 1000,
        round_income: 200,
        max_unit_limit: 40,
        player1_race: null,
        player2_race: null,
        player1_id: null,
        player2_id: null,
        player1_nickname: null,
        player2_nickname: null,
        current_round: 1,
        winner_id: null,
      };
    }
  }

  async getRoundDuration() {
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "check_round_status",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        this.roundDuration = result.round_time || 30;
        // Якщо є активний таймер - використовуємо серверний час
        if (result.round_active && result.time_left > 0) {
          this.roundTimeLeft = result.time_left;
          this.isRoundActive = true;
        } else {
          this.roundTimeLeft = this.roundDuration;
          this.isRoundActive = false;
        }
      }
    } catch (error) {
      this.roundTimeLeft = this.roundDuration; // Use default
    }
  }

  async checkRoundStatus() {
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "check_round_status",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Тільки оновлюємо таймер якщо він активний І гра на паузі (режим розстановки)
        if (result.round_active && result.time_left > 0 && this.isPaused) {
          this.roundTimeLeft = result.time_left;
          this.isRoundActive = true;
          this.updateTimerDisplay();
        }

        // Запускаємо гру тільки якщо обидва готові, гра на паузі і таймер активний
        if (
          result.should_start_game &&
          this.isPaused &&
          result.player1_ready &&
          result.player2_ready
        ) {
          console.log("DEBUG: All conditions met for game start:", {
            should_start_game: result.should_start_game,
            isPaused: this.isPaused,
            player1_ready: result.player1_ready,
            player2_ready: result.player2_ready,
          });
          console.log("Both players ready! Starting game logic...");
          this.startGame();
        }
      }
    } catch (error) {
      console.error("Error checking round status:", error);
    }
  }

  handleTimeUp() {
    console.log("Time is up! Auto-setting player as ready...");

    // Mark round as inactive
    this.isRoundActive = false;
    this.roundTimeLeft = 0;
    this.updateTimerDisplay();

    // Auto-set current player as ready
    this.setPlayerReady();
  }

  async setPlayerReady() {
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "set_ready",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log("Player marked as ready");
      }
    } catch (error) {
      console.error("Error setting player ready:", error);
    }
  }

  updateTimerDisplay() {
    // Find timer element and update it
    const timerElement = document.getElementById("round-timer");
    if (timerElement) {
      const minutes = Math.floor(this.roundTimeLeft / 60);
      const seconds = this.roundTimeLeft % 60;
      timerElement.textContent = `${minutes}:${seconds
        .toString()
        .padStart(2, "0")}`;

      // Add warning style when time is low
      if (this.roundTimeLeft <= 10) {
        timerElement.classList.add("warning");
      } else {
        timerElement.classList.remove("warning");
      }
    }
  }

  // Start game logic when both players are ready
  async startGame() {
    console.log("=== STARTING GAME LOGIC ===");
    console.log("DEBUG: startGame called, isPaused:", this.isPaused);
    console.trace("startGame call stack");

    // Reset battle end processing flag
    this.battleEndProcessing = false;

    // CRITICAL: Reset all timing counters for deterministic battle start
    this.animationTickCounter = 0;
    this.moveAccumulator = 0;
    this.accumulator = 0;

    // Mark that battle is in progress
    this.isBattleInProgress = true;

    // Mark current player as in battle
    await this.setBattleState(true);

    // Stop round placement timer and status checking
    if (this.checkStatusInterval) {
      clearInterval(this.checkStatusInterval);
      this.checkStatusInterval = null;
      console.log("DEBUG: Stopped checkStatusInterval in startGame");
    }

    // Stop any existing battle check interval to prevent double intervals
    if (this.battleCheckInterval) {
      clearInterval(this.battleCheckInterval);
      this.battleCheckInterval = null;
      console.log("DEBUG: Stopped existing battleCheckInterval in startGame");
    }

    this.isRoundActive = false;
    this.roundTimeLeft = 0;
    this.updateTimerDisplay(); // Візуально скидаємо таймер

    // CRITICAL: Load all units from database to ensure synchronization
    console.log("Loading latest units from database...");
    await this.objectManager.loadObjects();

    // Оновлюємо напрямок погляду після завантаження юнітів
    for (const unit of this.objectManager.objects) {
      unit.setLookDirectionByTeam();
    }
    for (const unit of this.objectManager.enemyObjects) {
      unit.setLookDirectionByTeam();
    }

    // Save current player units and sync with enemy (ensures both players have same data)
    await this.objectManager.synchronizeAfterTurn();
    console.log("Units synchronized. Starting game...");

    // Unpause the game - existing logic in update() will handle the rest
    this.isPaused = false;

    // Поновлюємо постріли всім ренджед юнітам на початку гри
    this.refillAllUnitsShots();

    // Flag to prevent multiple battle end calls
    this.battleEndProcessing = false;

    // Start checking for round end conditions (all units of one player dead)
    this.battleCheckInterval = setInterval(() => {
      this.checkBattleEnd();
    }, 500); // Check every 0.5 seconds
  }

  checkBattleEnd() {
    // Prevent multiple simultaneous calls
    if (this.battleEndProcessing) {
      return;
    }

    const playerUnits = this.objectManager.objects.filter((obj) => !obj.isDead);
    const enemyUnits = this.objectManager.enemyObjects.filter(
      (obj) => !obj.isDead
    );

    // Check if one team has no units left
    if (playerUnits.length === 0 || enemyUnits.length === 0) {
      // Mark that we're processing battle end
      this.battleEndProcessing = true;

      console.log(
        `%c=== BATTLE ENDED ===%c\nPlayer units: ${playerUnits.length}, Enemy units: ${enemyUnits.length}`,
        "color: red; font-weight: bold; font-size: 16px;",
        "color: white;"
      );

      // Stop battle checking
      if (this.battleCheckInterval) {
        clearInterval(this.battleCheckInterval);
        this.battleCheckInterval = null;
      }

      // Determine winner based on which array has survivors
      let winnerId = null;

      if (playerUnits.length > 0 && enemyUnits.length === 0) {
        winnerId = "current_player"; // Current player wins
        console.log(
          "%cWINNER: current_player",
          "color: green; font-weight: bold;"
        );
      } else if (enemyUnits.length > 0 && playerUnits.length === 0) {
        winnerId = "other_player"; // Other player wins
        console.log(
          "%cWINNER: other_player",
          "color: green; font-weight: bold;"
        );
      } else {
        console.log(
          "%cWARNING: Both teams destroyed! winnerId will be NULL",
          "color: orange; font-weight: bold;"
        );
      }

      console.log(`Calling endRound with winnerId: ${winnerId}`);

      // Download battle logs for debugging before ending round (only in debug mode)
      if (this.debugMode) {
        battleLogger.downloadLogs();
      }

      // End the round with winner info
      this.endRound(winnerId);
    }
  }

  async endRound(winnerId = null) {
    console.log(
      "%c=== END ROUND CALLED ===",
      "color: yellow; font-weight: bold; font-size: 16px;"
    );
    console.log("winnerId:", winnerId);

    // CRITICAL: Stop battle check interval FIRST to prevent multiple calls
    if (this.battleCheckInterval) {
      clearInterval(this.battleCheckInterval);
      this.battleCheckInterval = null;
      console.log("Stopped battleCheckInterval in endRound");
    }

    // Mark player as no longer in battle
    await this.setBattleState(false);

    // НЕ зупиняємо checkStatusInterval - потрібна синхронізація з сервером

    this.isRoundActive = false;
    this.roundTimeLeft = 0;
    this.updateTimerDisplay(); // Скидаємо таймер візуально

    // Clear all remaining particles to prevent them from being stuck in mid-air
    if (this.objectManager.particles) {
      this.objectManager.particles.length = 0;
      console.log("Cleared all remaining particles");
    }

    // Pause the game
    this.isPaused = true;

    // Mark that battle is no longer in progress
    this.isBattleInProgress = false;

    // Process round end and show winner modal
    await this.processRoundEnd(winnerId);
  }

  async processRoundEnd(winnerId) {
    // Get room players info to determine actual user ID
    const roomPlayers = await this.getRoomPlayers();
    if (!roomPlayers) {
      console.error("Could not get room players info");
      return;
    }

    console.log("=== PROCESS ROUND END DEBUG ===");
    console.log("winnerId from checkBattleEnd:", winnerId);
    console.log("roomPlayers:", roomPlayers);

    // Convert current_user_id to number for proper comparison
    const currentUserId = parseInt(roomPlayers.current_user_id);
    const creatorId = parseInt(roomPlayers.creator_id);
    const secondPlayerId = parseInt(roomPlayers.second_player_id);

    // Convert winner to user ID
    let actualWinnerId = null;
    if (winnerId === "current_player") {
      actualWinnerId = currentUserId;
      console.log("Winner is current_player, actualWinnerId:", actualWinnerId);
    } else if (winnerId === "other_player") {
      // Get the other player's ID (the one who is NOT current user)
      actualWinnerId = currentUserId === creatorId ? secondPlayerId : creatorId;
      console.log("Winner is other_player, actualWinnerId:", actualWinnerId);
    } else {
      console.error("UNEXPECTED winnerId value:", winnerId);
    }

    console.log(
      `Processing round end: ${winnerId} -> User ID: ${actualWinnerId}`
    );

    // Try to increment round - server will return was_first flag
    const incrementResult = await this.incrementRound(actualWinnerId);

    if (incrementResult && incrementResult.success) {
      // Calculate the battle round number (before increment)
      const battleRound = incrementResult.was_first
        ? incrementResult.new_round - 1
        : incrementResult.new_round - 1;

      // Get winner nickname
      const roomSettings = await this.getRoomSettings();
      let winnerNickname = "";
      if (actualWinnerId === roomSettings.player1_id) {
        winnerNickname = roomSettings.player1_nickname;
      } else if (actualWinnerId === roomSettings.player2_id) {
        winnerNickname = roomSettings.player2_nickname;
      }

      // Show winner modal
      this.showRoundWinnerModal(battleRound, winnerNickname);

      // First player incremented the round
      console.log("Round incremented successfully, reloading...");

      // Set flag for adding income after reload
      localStorage.setItem(
        `add_income_after_reload_${this.objectManager.currentRoomId}`,
        "true"
      );

      // Reload after showing modal
      setTimeout(async () => {
        await this.resetReadyStatus();
        this.allowReload = true;
        window.location.reload();
      }, 2000);
    } else if (
      incrementResult &&
      !incrementResult.success &&
      incrementResult.was_first === false
    ) {
      // Calculate the battle round number (before increment)
      const battleRound = incrementResult.new_round - 1;

      // Get winner nickname
      const roomSettings = await this.getRoomSettings();
      let winnerNickname = "";
      if (actualWinnerId === roomSettings.player1_id) {
        winnerNickname = roomSettings.player1_nickname;
      } else if (actualWinnerId === roomSettings.player2_id) {
        winnerNickname = roomSettings.player2_nickname;
      }

      // Show winner modal
      this.showRoundWinnerModal(battleRound, winnerNickname);

      // Second player - round already incremented by first player
      console.log("Round already incremented by other player, reloading...");

      // Set flag for adding income after reload
      localStorage.setItem(
        `add_income_after_reload_${this.objectManager.currentRoomId}`,
        "true"
      );

      // Reload after showing modal
      setTimeout(async () => {
        await this.resetReadyStatus();
        this.allowReload = true;
        window.location.reload();
      }, 2000);
    } else {
      console.error("Failed to increment round");
    }
  }

  showRoundWinnerModal(roundNumber, winnerNickname) {
    const modal = document.getElementById("round-winner-modal");
    const roundNumberEl = document.getElementById("round-number");
    const winnerNicknameEl = document.getElementById("winner-nickname");

    if (modal && roundNumberEl && winnerNicknameEl) {
      roundNumberEl.textContent = `Раунд ${roundNumber}`;
      winnerNicknameEl.textContent = winnerNickname;
      modal.style.display = "flex";
      console.log(
        `Showing winner modal: Round ${roundNumber}, Winner: ${winnerNickname}`
      );
    }
  }

  async getRoomPlayers() {
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "get_room_players",
          room_id: this.objectManager.currentRoomId,
        }),
      });
      const result = await response.json();
      return result.success ? result : null;
    } catch (error) {
      console.error("Error getting room players:", error);
      return null;
    }
  }

  async incrementRound(winnerId) {
    console.log(
      "%c=== INCREMENT ROUND CALLED ===",
      "color: cyan; font-weight: bold; font-size: 14px;"
    );
    console.log("winnerId being sent to server:", winnerId);
    console.log("room_id:", this.objectManager.currentRoomId);
    console.log("battleEndProcessing flag:", this.battleEndProcessing);
    console.trace("incrementRound call stack"); // Add stack trace

    try {
      const requestBody = {
        action: "increment_round",
        room_id: this.objectManager.currentRoomId,
        winner_id: winnerId,
      };
      console.log("Request body:", JSON.stringify(requestBody, null, 2));

      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Server error in incrementRound:",
          response.status,
          errorText
        );
        return false;
      }

      const result = await response.json();
      console.log(
        "%c=== INCREMENT ROUND RESPONSE ===",
        "color: cyan; font-weight: bold;"
      );
      console.log("Server response:", result);
      console.log("was_first:", result.was_first);
      console.log("new_round:", result.new_round);

      // Save increment info to localStorage for debugging after reload
      const incrementDebugInfo = {
        timestamp: new Date().toISOString(),
        winnerId: winnerId,
        was_first: result.was_first,
        new_round: result.new_round,
        old_round: result.new_round - (result.was_first ? 1 : 0),
        room_id: this.objectManager.currentRoomId,
        battleEndProcessing: this.battleEndProcessing,
      };

      // Get existing debug history
      const debugHistory = JSON.parse(
        localStorage.getItem("increment_debug_history") || "[]"
      );
      debugHistory.push(incrementDebugInfo);
      // Keep only last 20 entries to see pattern
      if (debugHistory.length > 20) debugHistory.shift();
      localStorage.setItem(
        "increment_debug_history",
        JSON.stringify(debugHistory)
      );

      if (result.success) {
        console.log(
          `%cRound incremented to: ${result.new_round}`,
          "color: green; font-weight: bold;"
        );
        return result; // Return full result with was_first flag
      } else {
        console.error("Failed to increment round:", result.error);
        return false;
      }
    } catch (error) {
      console.error("Error incrementing round:", error);
      return false;
    }
  }

  async resetUnitsToStartingPositions() {
    console.log("Resetting units to starting positions...");

    // Simply reload all units from database - this will reset positions, health, everything
    await this.objectManager.loadObjects();

    // Ensure all units have correct look direction and force restart animations
    for (const unit of this.objectManager.objects) {
      unit.setLookDirectionByTeam();
      // Force restart animation
      if (unit.animator) {
        unit.animator.currentFrame = 0;
        unit.animator.hasFinished = false;
        unit.animator.setAnimation("idle", true);
        // Manually trigger first frame
        unit.animator.nextFrame();
      }
    }
    for (const unit of this.objectManager.enemyObjects) {
      unit.setLookDirectionByTeam();
      // Force restart animation
      if (unit.animator) {
        unit.animator.currentFrame = 0;
        unit.animator.hasFinished = false;
        unit.animator.setAnimation("idle", true);
        // Manually trigger first frame
        unit.animator.nextFrame();
      }
    }

    // Update grid
    this.objectManager.updateGridWithAllObjects();

    console.log(
      `Units reloaded from database: ${this.objectManager.objects.length} player, ${this.objectManager.enemyObjects.length} enemy`
    );

    // Force multiple renders to ensure everything updates
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.render();
      }, i * 100);
    }

    console.log("=== RESET COMPLETE ===");
  }

  // Check if player can place unit at given position (considering unit size)
  canPlaceUnitAt(gridCol, gridRow, unitConfig) {
    const gridCols = this.gridManager.cols; // Total columns
    const midpoint = Math.floor(gridCols / 2); // Middle of the map

    // Get unit dimensions
    const gridWidth = unitConfig?.gridWidth || 1;
    const gridHeight = unitConfig?.gridHeight || 1;
    const expansionDirection = unitConfig?.expansionDirection || "bottomRight";

    // Calculate all cells the unit will occupy
    let startCol = gridCol;
    let endCol = gridCol;

    switch (expansionDirection) {
      case "topLeft":
        startCol = gridCol - (gridWidth - 1);
        endCol = gridCol;
        break;
      case "topRight":
        startCol = gridCol;
        endCol = gridCol + (gridWidth - 1);
        break;
      case "bottomLeft":
        startCol = gridCol - (gridWidth - 1);
        endCol = gridCol;
        break;
      case "bottomRight":
      default:
        startCol = gridCol;
        endCol = gridCol + (gridWidth - 1);
        break;
    }

    // Check if ALL occupied cells are in the correct zone
    if (this.isRoomCreator) {
      // Host (creator) can only place units in left half
      // All cells must be < midpoint
      return endCol < midpoint;
    } else {
      // Guest (player 2) can only place units in right half
      // All cells must be >= midpoint
      return startCol >= midpoint;
    }
  }

  // Get allowed placement zone info for UI feedback
  getPlacementZoneInfo() {
    const gridCols = this.gridManager.cols;
    const midpoint = Math.floor(gridCols / 2);

    if (this.isRoomCreator) {
      return {
        minCol: 0,
        maxCol: midpoint - 1,
        side: "left",
      };
    } else {
      return {
        minCol: midpoint,
        maxCol: gridCols - 1,
        side: "right",
      };
    }
  }

  async pauseForNextRound() {
    console.log("Pausing for next round...");

    // Pause the game
    this.isPaused = true;

    // Поновлюємо постріли всім ренджед юнітам перед новим раундом
    this.refillAllUnitsShots();

    // Reset ready status for new round
    await this.resetReadyStatus();

    // Start new round timer
    await this.startRoundTimer();
  }

  async resetReadyStatus() {
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "reset_ready_status",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log("Ready status reset for new round");

        // Reset UI button
        const readyButton = document.getElementById("ready-button");
        if (readyButton) {
          readyButton.disabled = false;
          readyButton.textContent = "ГОТОВИЙ";
          readyButton.style.backgroundColor = "";
        }
      }
    } catch (error) {
      console.error("Error resetting ready status:", error);
    }
  }

  // Поновлює постріли всім ренджед юнітам (на початку гри або раунду)
  refillAllUnitsShots() {
    console.log("Refilling shots and resetting attack states for all units...");

    // Reset battle logger for deterministic logging (only in debug mode)
    if (this.debugMode) {
      battleLogger.reset();
    }

    // Скидаємо стани для юнітів гравця
    for (const unit of this.objectManager.objects) {
      // Reset attack state for deterministic start
      unit.attackCooldown = 0;
      unit.isAttacking = false;
      unit.attackTarget = null;
      unit.attackDamageDealt = false;

      if (unit.isRanged && unit.maxShots !== null) {
        unit.refillShots();
      }
    }

    // Скидаємо стани для юнітів ворога
    for (const unit of this.objectManager.enemyObjects) {
      // Reset attack state for deterministic start
      unit.attackCooldown = 0;
      unit.isAttacking = false;
      unit.attackTarget = null;
      unit.attackDamageDealt = false;

      if (unit.isRanged && unit.maxShots !== null) {
        unit.refillShots();
      }
    }

    console.log("All units reset for battle start");
  }

  // Check battle state on reconnect
  async checkBattleState() {
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "get_battle_state",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      const result = await response.json();
      return result.success ? result : null;
    } catch (error) {
      console.error("Error checking battle state:", error);
      return null;
    }
  }

  // Set battle state
  async setBattleState(inBattle) {
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "set_battle_state",
          room_id: this.objectManager.currentRoomId,
          in_battle: inBattle,
        }),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("Error setting battle state:", error);
      return false;
    }
  }

  // Clear winner to prevent modal re-showing on reload
  async clearWinner() {
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "clear_winner",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("Error clearing winner:", error);
      return false;
    }
  }

  // Handle case when player refreshed during battle
  async handleBattleDisconnection(battleState) {
    console.log("handleBattleDisconnection called with state:", battleState);
    this.battleDisconnected = true;
    this.waitingForBattleEnd = true;
    this.isPaused = true;

    // Show waiting message first (before hiding loading screen to prevent flash)
    this.showWaitingForBattleMessage();

    // Then hide loading screen
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      loadingScreen.classList.add("hidden");
      setTimeout(() => {
        loadingScreen.remove();
      }, 300);
    }

    // Mark current player as not in battle
    console.log("Setting current player as NOT in battle...");
    await this.setBattleState(false);

    // Start checking for battle completion OR deadlock
    this.battleCompletionCheckInterval = setInterval(async () => {
      // FIRST: Check if both players are now waiting (deadlock)
      const currentBattleState = await this.checkBattleState();

      if (
        currentBattleState &&
        !currentBattleState.player1_in_battle &&
        !currentBattleState.player2_in_battle
      ) {
        // Both players are waiting! Reload page to restart properly
        console.log(
          "%c=== DEADLOCK DETECTED ===%c\nBoth players in waiting mode. Reloading to restart battle...",
          "color: orange; font-weight: bold; font-size: 16px;",
          "color: white;"
        );

        clearInterval(this.battleCompletionCheckInterval);
        this.battleCompletionCheckInterval = null;

        // Allow reload without warning
        this.allowReload = true;

        // Reload page - will detect bothDisconnected in start() and auto-start battle
        window.location.reload();

        return;
      }

      // SECOND: Check if battle completed normally
      const completionState = await this.checkBattleCompletion();
      console.log("Battle completion check:", completionState);

      if (completionState && completionState.battle_completed) {
        console.log(
          "Battle completed by other player! Winner:",
          completionState.winner_id
        );
        clearInterval(this.battleCompletionCheckInterval);
        this.battleCompletionCheckInterval = null;

        // Battle completed - just reload
        console.log("Battle completed during reconnect, reloading...");
        await this.resetReadyStatus();
        this.allowReload = true;
        window.location.reload();
      } else {
        console.log("Battle not yet completed, continuing to wait...");
      }
    }, 2000); // Check every 2 seconds
  }

  // Check if battle is completed
  async checkBattleCompletion() {
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "check_battle_completion",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      const result = await response.json();
      return result.success ? result : null;
    } catch (error) {
      console.error("Error checking battle completion:", error);
      return null;
    }
  }

  // Show waiting message
  showWaitingForBattleMessage() {
    // Create overlay if it doesn't exist
    let overlay = document.getElementById("battle-waiting-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "battle-waiting-overlay";
      overlay.className = "battle-waiting-overlay";
      overlay.innerHTML = `
        <div class="battle-waiting-content">
          <div class="battle-waiting-title">Очікування завершення бою</div>
          <div class="battle-waiting-text">Будь ласка, зачекайте поки інший гравець завершить бій...</div>
          <div class="battle-waiting-spinner"></div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.style.display = "flex";
  }

  // Hide waiting message
  hideWaitingForBattleMessage() {
    const overlay = document.getElementById("battle-waiting-overlay");
    if (overlay) {
      overlay.style.display = "none";
    }
    this.battleDisconnected = false;
    this.waitingForBattleEnd = false;
  }

  // ========== HEARTBEAT SYSTEM ==========

  // Start heartbeat - send ping every 5 seconds to update last_active
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Send initial heartbeat
    this.sendHeartbeat();

    // Send heartbeat every 5 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 5000);

    console.log("Heartbeat started - sending ping every 5 seconds");
  }

  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log("Heartbeat stopped");
    }
  }

  // Send heartbeat ping to server
  async sendHeartbeat() {
    if (!this.objectManager.currentRoomId) return;

    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "heartbeat",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      const result = await response.json();
      // Heartbeat успішний - не логуємо щоб не засмічувати консоль
    } catch (error) {
      console.error("Error sending heartbeat:", error);
    }
  }

  // Start checking opponent online status (during unit placement only)
  startOpponentCheck() {
    if (this.opponentCheckInterval) {
      clearInterval(this.opponentCheckInterval);
    }

    // Check immediately
    this.checkOpponentOnline();

    // Check every 3 seconds
    this.opponentCheckInterval = setInterval(() => {
      // Only check during unit placement (when paused)
      if (this.isPaused && !this.isBattleInProgress) {
        this.checkOpponentOnline();
      }
    }, 3000);

    console.log("Opponent online check started");
  }

  // Stop checking opponent status
  stopOpponentCheck() {
    if (this.opponentCheckInterval) {
      clearInterval(this.opponentCheckInterval);
      this.opponentCheckInterval = null;
      console.log("Opponent online check stopped");
    }
  }

  // Check if opponent is online
  async checkOpponentOnline() {
    if (!this.objectManager.currentRoomId) return;

    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "check_players_online",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Determine which player is opponent
        const isPlayer1 = this.isRoomCreator;
        const opponentOnline = isPlayer1
          ? result.player2_online
          : result.player1_online;

        // Check if opponent status changed
        if (this.opponentOffline !== !opponentOnline) {
          const wasOffline = this.opponentOffline;
          this.opponentOffline = !opponentOnline;

          if (this.opponentOffline) {
            console.log("Opponent went OFFLINE");
            this.handleOpponentOffline();
          } else {
            console.log("Opponent came back ONLINE");
            this.handleOpponentOnline(wasOffline);
          }
        }
      }
    } catch (error) {
      console.error("Error checking opponent online:", error);
    }
  }

  // Handle opponent going offline during unit placement
  async handleOpponentOffline() {
    // Pause the round timer
    if (this.isRoundActive) {
      console.log("Pausing round timer - opponent offline");
      await this.pauseRoundTimer();
    }

    // Show notification
    this.showOpponentOfflineMessage();
  }

  // Handle opponent coming back online
  async handleOpponentOnline(wasOffline) {
    // Resume round timer if it was paused
    console.log("Opponent back online - resuming game");

    // Only resume if opponent was actually offline (meaning we paused the timer)
    if (wasOffline) {
      console.log("CLIENT: Resuming timer after opponent reconnect");
      await this.resumeRoundTimer();
    }

    // Hide notification
    this.hideOpponentOfflineMessage();
  }

  // Show opponent offline message
  showOpponentOfflineMessage() {
    // Create overlay if it doesn't exist
    let overlay = document.getElementById("opponent-offline-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "opponent-offline-overlay";
      overlay.className = "battle-waiting-overlay";
      overlay.innerHTML = `
        <div class="battle-waiting-content">
          <div class="battle-waiting-spinner"></div>
          <h2 class="battle-waiting-title">Опонент відключився</h2>
          <p class="battle-waiting-subtitle">Очікування повернення гравця...</p>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.style.display = "flex";
  }

  // Hide opponent offline message
  hideOpponentOfflineMessage() {
    const overlay = document.getElementById("opponent-offline-overlay");
    if (overlay) {
      overlay.style.display = "none";
    }
  }

  // ========== DEADLOCK DETECTION ==========

  // Show increment round debug history from localStorage
  showIncrementDebugHistory() {
    const debugHistory = JSON.parse(
      localStorage.getItem("increment_debug_history") || "[]"
    );

    if (debugHistory.length > 0) {
      console.log(
        "%c=== INCREMENT ROUND DEBUG HISTORY ===",
        "color: yellow; font-weight: bold; font-size: 14px;"
      );
      console.log(`Total increments: ${debugHistory.length}`);
      console.table(debugHistory);

      // Check for potential issues
      const roomIncrements = debugHistory.filter(
        (d) => d.room_id === this.objectManager.currentRoomId
      );
      if (roomIncrements.length > 1) {
        const lastTwo = roomIncrements.slice(-2);
        if (lastTwo.length === 2) {
          const roundDiff = lastTwo[1].new_round - lastTwo[0].new_round;
          if (roundDiff > 1) {
            console.warn(
              `%cWARNING: Round jumped by ${roundDiff} (from ${lastTwo[0].new_round} to ${lastTwo[1].new_round})`,
              "color: red; font-weight: bold;"
            );
          }
        }
      }
    }
  }

  // Check for battle deadlock (both players offline during battle)
  async checkBattleDeadlock() {
    if (!this.objectManager.currentRoomId) return false;

    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "detect_battle_deadlock",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      const result = await response.json();

      if (result.success && result.is_deadlock) {
        console.log(
          "%c=== BATTLE DEADLOCK DETECTED ===%c\nBoth players were offline during battle. Restarting battle...",
          "color: red; font-weight: bold; font-size: 16px;",
          "color: white;"
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking battle deadlock:", error);
      return false;
    }
  }
}

window.gameManager = new GameManager();
