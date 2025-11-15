import { ConfigLoader } from "../import.js";
import { ObjectManager } from "../import.js";
import { GridManager } from "../import.js";
import { ActionManager } from "../import.js";
import { InputManager } from "../import.js";
import { SpriteLoader } from "../import.js";
import { Player } from "../import.js";
import { InterfaceManager } from "../import.js";
import { MapRenderer } from "../game_map/mapRender.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 1200;
canvas.height = 800;

class GameManager {
  constructor() {
    this.lastTime = 0;
    this.deltaTime = 0;
    this.fixedTimeStep = 1000 / 12;
    this.accumulator = 0;
    this.debugMode = false;
    this.debugInterval = null;
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
    console.log("START: gameManager.start() called");
    await this.configLoader.loadRacesConfig();
    console.log("START: racesConfig loaded");
    await this.objectManager.initializeGame();
    console.log("START: initializeGame completed");

    // Determine if current player is room creator
    const roomInfo = await this.objectManager.getCurrentRoomId();
    console.log("START: roomInfo =", roomInfo);
    if (roomInfo) {
      this.isRoomCreator = roomInfo.isCreator;

      // Get current user ID
      const roomPlayers = await this.getRoomPlayers();
      if (roomPlayers) {
        this.currentUserId = roomPlayers.current_user_id;
        console.log("Current user ID:", this.currentUserId);
      }

      console.log(
        `Player is ${this.isRoomCreator ? "host (creator)" : "guest (player 2)"}
      `
      );

      // Після визначення ролі гравця оновлюємо напрямок погляду для всіх юнітів
      try {
        console.log(
          "START: About to update look direction for objects, count:",
          this.objectManager.objects.length
        );
        for (const unit of this.objectManager.objects) {
          unit.setLookDirectionByTeam();
        }
        console.log(
          "START: About to update look direction for enemyObjects, count:",
          this.objectManager.enemyObjects.length
        );
        for (const unit of this.objectManager.enemyObjects) {
          unit.setLookDirectionByTeam();
        }
        console.log("START: Look direction update completed");
      } catch (error) {
        console.error("START: Error updating look direction:", error);
      }
    } else {
      console.log("DEBUG: roomInfo is null/undefined");
    }

    // Check if we reconnected during battle
    const battleState = await this.checkBattleState();
    if (battleState && battleState.battle_started) {
      console.log("Reconnected during battle - entering waiting mode");
      await this.handleBattleDisconnection(battleState);
      return; // Don't continue normal initialization
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

      console.log(
        `Classic mode - isRoomCreator: ${this.isRoomCreator}, player1_race: ${roomSettings.player1_race}, player2_race: ${roomSettings.player2_race}, selected race: ${playerRace}`
      );

      if (!playerRace) {
        console.warn("Race not selected in classic mode, defaulting to 'all'");
        playerRace = "all";
      } else {
        console.log(`Player race set to: ${playerRace}`);
      }
    } else {
      console.log(`All races mode - player can use any race`);
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

    this.interfaceManager.updatePlayerInterface(this.player);

    // Set round duration from room settings
    this.roundDuration = roomSettings.round_time || 45;
    console.log(`Round duration set to: ${this.roundDuration} seconds`);

    // Get round duration from server first (for sync)
    await this.getRoundDuration();

    // Start round management
    await this.startRoundTimer();

    // Hide loading screen after everything is ready
    this.hideLoadingScreen();

    requestAnimationFrame((t) => this.loop(t));
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      loadingScreen.classList.add("hidden");
      // Remove from DOM after animation completes
      setTimeout(() => {
        loadingScreen.remove();
      }, 300);
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
    }
    // Draw the hover indicator
    this.inputManager.drawHoverIndicator(ctx);
    this.objectManager.renderAll();
    // Рендеримо всі particles
    if (this.objectManager.particles) {
      for (const particle of this.objectManager.particles) {
        particle.draw();
      }
    }
  }

  loop(timestamp) {
    if (!this.isRunning) return; // Не продовжуємо цикл, якщо гра зупинена
    if (this.lastTime === 0) this.lastTime = timestamp;
    this.deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;
    this.accumulator += this.deltaTime;

    while (this.accumulator >= this.fixedTimeStep) {
      // Оновлюємо анімації для всіх об'єктів незалежно від режиму
      const allObjects = [
        ...this.objectManager.objects,
        ...this.objectManager.enemyObjects,
      ];
      for (const obj of allObjects) {
        if (obj.animator && !obj.animator.hasFinished) {
          obj.animator.nextFrame();
        }
      }

      // Оновлюємо ВСЮ логіку (юніти, particles, дії, сітка) через objectManager.updateAll
      if (!this.isPaused) {
        this.objectManager.updateAll(this.fixedTimeStep);
        this.actionManager.update(this.fixedTimeStep);
        this.objectManager.updateGridWithAllObjects();
      }

      this.accumulator -= this.fixedTimeStep;

      // Якщо гра зупинена через помилку, виходимо з циклу
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

  async getRoomSettings() {
    console.log(
      "getRoomSettings: called with currentRoomId =",
      this.objectManager.currentRoomId
    );
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

      console.log("getRoomSettings: response status =", response.status);
      const result = await response.json();
      console.log("getRoomSettings: result =", result);

      if (result.success) {
        const settings = {
          game_mode: result.settings.game_mode || "all_races",
          round_time: result.settings.round_time || 45,
          starting_money: result.settings.starting_money || 1000,
          round_income: result.settings.round_income || 200,
          max_unit_limit: result.settings.max_unit_limit || 40,
          player1_race: result.players.host?.race || null,
          player2_race: result.players.guest?.race || null,
        };
        console.log("getRoomSettings: returning settings =", settings);
        return settings;
      } else {
        console.warn("Failed to load room settings, using defaults");
        return {
          game_mode: "all_races",
          round_time: 45,
          starting_money: 1000,
          round_income: 200,
          max_unit_limit: 40,
          player1_race: null,
          player2_race: null,
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

    // Start checking for round end conditions (all units of one player dead)
    this.battleCheckInterval = setInterval(() => {
      this.checkBattleEnd();
    }, 500); // Check every 0.5 seconds
  }

  checkBattleEnd() {
    const playerUnits = this.objectManager.objects.filter((obj) => !obj.isDead);
    const enemyUnits = this.objectManager.enemyObjects.filter(
      (obj) => !obj.isDead
    );

    // Check if one team has no units left
    if (playerUnits.length === 0 || enemyUnits.length === 0) {
      console.log(
        `Battle ended! Player units: ${playerUnits.length}, Enemy units: ${enemyUnits.length}`
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
      } else if (enemyUnits.length > 0 && playerUnits.length === 0) {
        winnerId = "other_player"; // Other player wins
      }

      console.log(
        `Winner determined: ${winnerId} (current player units: ${playerUnits.length}, enemy units: ${enemyUnits.length})`
      );

      // End the round with winner info
      this.endRound(winnerId);
    }
  }

  async endRound(winnerId = null) {
    console.log("Round ended! Processing winner...");

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

    // Convert winner to user ID
    let actualWinnerId = null;
    if (winnerId === "current_player") {
      actualWinnerId = roomPlayers.current_user_id;
    } else if (winnerId === "other_player") {
      // Get the other player's ID
      actualWinnerId =
        roomPlayers.creator_id === roomPlayers.current_user_id
          ? roomPlayers.second_player_id
          : roomPlayers.creator_id;
    }

    console.log(
      `Processing round end: ${winnerId} -> User ID: ${actualWinnerId}`
    );

    // Only the winner should try to record the result
    if (winnerId === "current_player") {
      console.log("I won! Recording result in database...");
      const incrementSuccess = await this.incrementRound(actualWinnerId);
      if (incrementSuccess) {
        await this.showWinnerModalAndContinue();
      }
    } else {
      console.log("I lost. Waiting for winner to record result...");
      // Wait a moment for the winner to record, then show modal
      setTimeout(async () => {
        await this.showWinnerModalAndContinue();
      }, 1000); // Wait 1 second for winner to record result
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
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "increment_round",
          room_id: this.objectManager.currentRoomId,
          winner_id: winnerId,
        }),
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
      if (result.success) {
        console.log(`Round incremented to: ${result.new_round}`);
        return true;
      } else {
        console.error("Failed to increment round:", result.error);
        return false;
      }
    } catch (error) {
      console.error("Error incrementing round:", error);
      return false;
    }
  }

  async showWinnerModalAndContinue() {
    try {
      // Get winner info from database
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "get_winner_info",
          room_id: this.objectManager.currentRoomId,
        }),
      });

      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error:", response.status, errorText);
        return;
      }

      // Try to parse JSON
      let result;
      try {
        const responseText = await response.text();
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        return;
      }

      if (result.success) {
        // If there's no winner, don't show modal
        if (!result.winner_id) {
          console.log(
            "No winner set - battle still in progress or already cleared"
          );
          return;
        }

        // Update modal content
        const modal = document.getElementById("round-winner-modal");
        const roundNumber = document.getElementById("round-number");
        const winnerNickname = document.getElementById("winner-nickname");

        roundNumber.textContent = `Раунд ${result.current_round}`;
        winnerNickname.textContent =
          result.winner_nickname || "Невідомий гравець";

        // Show modal
        modal.style.display = "flex";

        // Hide modal after 3 seconds and reload page for fresh state
        setTimeout(async () => {
          modal.style.display = "none";

          // Clear winner to prevent re-showing on reload
          await this.clearWinner();

          // Reset ready status before reload
          await this.resetReadyStatus();

          // Allow reload without warning
          this.allowReload = true;
          // Reload page to reset everything to fresh state
          window.location.reload();
        }, 3000);
      }
    } catch (error) {
      console.error("Error showing winner modal:", error);
    }
  }

  async startNextRoundPreparation() {
    console.log("Starting next round preparation...");

    // Reset ready status FIRST
    await this.resetReadyStatus();

    // Reload player resources from database
    if (this.player) {
      await this.player.initializeResources();
      console.log("Player resources reloaded from database");

      // Add round income after loading resources
      await this.player.addRoundIncome();
      console.log("Round income added");
    }

    // Reset all units to starting positions
    await this.resetUnitsToStartingPositions();

    // Reload unit icons for interface
    await this.reloadUnitIcons();

    // Update interface AFTER everything is reloaded
    if (this.player) {
      this.interfaceManager.updatePlayerInterface(this.player);
      console.log("Interface fully updated with fresh data");
    }

    // Wait 1 second for everything to settle
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get round duration from server before starting timer
    await this.getRoundDuration();

    // Start new round timer
    await this.startRoundTimer();
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
    console.log("Refilling shots for all ranged units...");

    // Поновлюємо постріли для юнітів гравця
    for (const unit of this.objectManager.objects) {
      if (unit.isRanged && unit.maxShots !== null) {
        unit.refillShots();
      }
    }

    // Поновлюємо постріли для юнітів ворога
    for (const unit of this.objectManager.enemyObjects) {
      if (unit.isRanged && unit.maxShots !== null) {
        unit.refillShots();
      }
    }

    console.log("Shots refilled for all ranged units");
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

    // Hide loading screen if still visible
    this.hideLoadingScreen();

    // Mark current player as not in battle
    console.log("Setting current player as NOT in battle...");
    await this.setBattleState(false);

    // Show waiting message
    this.showWaitingForBattleMessage();

    // Start checking for battle completion
    this.battleCompletionCheckInterval = setInterval(async () => {
      const completionState = await this.checkBattleCompletion();
      console.log("Battle completion check:", completionState);

      if (completionState && completionState.battle_completed) {
        console.log(
          "Battle completed by other player! Winner:",
          completionState.winner_id
        );
        clearInterval(this.battleCompletionCheckInterval);
        this.battleCompletionCheckInterval = null;

        // Hide waiting message
        this.hideWaitingForBattleMessage();

        // Show winner and continue to next round
        await this.showWinnerModalAndContinue();
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
          <div class="battle-waiting-subtitle">Ви оновили сторінку під час бою</div>
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
}

window.gameManager = new GameManager();
