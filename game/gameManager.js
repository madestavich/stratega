import { ConfigLoader } from "../import.js";
import { ObjectManager } from "../import.js";
import { GridManager } from "../import.js";
import { ActionManager } from "../import.js";
import { InputManager } from "../import.js";
import { SpriteLoader } from "../import.js";
import { Player } from "../import.js";
import { InterfaceManager } from "../import.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 1200;
canvas.height = 800;

class GameManager {
  constructor() {
    this.lastTime = 0;
    this.deltaTime = 0;
    this.fixedTimeStep = 1000 / 14;
    this.accumulator = 0;
    this.debugMode = false;
    this.debugInterval = null;
    this.isRunning = true;
    this.player = null;

    // Debug bulletPoint mode
    this.debugBulletPoint = true; // Включаємо debug режим для bulletPoint
    this.pauseOnBulletSpawn = true; // Пауза при спавні снарядів

    // Round management
    this.roundTimer = null;
    this.roundTimeLeft = 0;
    this.roundDuration = 30; // Default 30 seconds - буде оновлено з сервера
    this.isRoundActive = false;
    this.checkStatusInterval = null;
    this.isPaused = true; // Game starts paused during unit placement
    this.isRoomCreator; // Will be set during initialization

    //! ініціалізація об'єктів і інших менеджерів

    this.configLoader = new ConfigLoader();
    this.spriteLoader = new SpriteLoader(this.configLoader);
    this.gridManager = new GridManager(ctx, {
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      rows: 80,
      cols: 60,
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
      if (e.key === "b" || e.key === "B") {
        this.toggleBulletPointDebug();
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

  async start() {
    await this.configLoader.loadRacesConfig();
    await this.objectManager.initializeGame();

    // Determine if current player is room creator
    const roomInfo = await this.objectManager.getCurrentRoomId();
    if (roomInfo) {
      this.isRoomCreator = roomInfo.isCreator;
      console.log(
        `Player is ${this.isRoomCreator ? "host (creator)" : "guest (player 2)"}
      `
      );

      // Після визначення ролі гравця оновлюємо напрямок погляду для всіх юнітів
      for (const unit of this.objectManager.objects) {
        unit.setLookDirectionByTeam();
      }
      for (const unit of this.objectManager.enemyObjects) {
        unit.setLookDirectionByTeam();
      }
    } else {
      console.log("DEBUG: roomInfo is null/undefined");
    }

    // Create player with correct team based on room role
    const playerTeam = this.isRoomCreator ? 1 : 2;
    this.player = new Player({
      nickname: "Player1",
      race: "necropolis", // Use one of the races from races.json
      team: playerTeam,
      coins: 100,
    });

    console.log(`Player created with team: ${playerTeam}`);

    this.interfaceManager.updatePlayerInterface(this.player);

    // Get round duration from server first
    await this.getRoundDuration();

    // Start round management
    await this.startRoundTimer();

    requestAnimationFrame((t) => this.loop(t));
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

    // НЕ зупиняємо checkStatusInterval - потрібна синхронізація з сервером

    this.isRoundActive = false;
    this.roundTimeLeft = 0;
    this.updateTimerDisplay(); // Скидаємо таймер візуально

    // Pause the game
    this.isPaused = true;

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
        // Update modal content
        const modal = document.getElementById("round-winner-modal");
        const roundNumber = document.getElementById("round-number");
        const winnerNickname = document.getElementById("winner-nickname");

        roundNumber.textContent = `Раунд ${result.current_round}`;
        winnerNickname.textContent =
          result.winner_nickname || "Невідомий гравець";

        // Show modal
        modal.style.display = "flex";

        // Hide modal after 3 seconds and continue to next phase
        setTimeout(async () => {
          modal.style.display = "none";
          await this.startNextRoundPreparation();
        }, 3000);
      }
    } catch (error) {
      console.error("Error showing winner modal:", error);
    }
  }

  async startNextRoundPreparation() {
    console.log("Starting next round preparation...");

    // Reset all units to starting positions
    await this.resetUnitsToStartingPositions();

    // Оновлюємо напрямок погляду для всіх юнітів на початку нового раунду
    for (const unit of this.objectManager.objects) {
      unit.setLookDirectionByTeam();
    }
    for (const unit of this.objectManager.enemyObjects) {
      unit.setLookDirectionByTeam();
    }

    // Reset ready status for new round
    await this.resetReadyStatus();

    // Wait 1 second for ready status reset to propagate to database
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get round duration from server before starting timer
    await this.getRoundDuration();

    // Start new round timer
    await this.startRoundTimer();
  }

  async resetUnitsToStartingPositions() {
    // Reset ALL player units (alive and dead) - move them back to their original starting positions
    for (const unit of this.objectManager.objects) {
      // Reset to original starting position
      unit.gridCol = unit.startingGridCol;
      unit.gridRow = unit.startingGridRow;

      // Reset health and other stats to full (resurrect if dead)
      unit.isDead = false;
      unit.currentHealth = unit.maxHealth;

      // Скидаємо всі напрямки і цілі
      unit.moveDirection = null;
      unit.moveTarget = null;
      unit.attackTarget = null;

      // Force update visual position from grid coordinates
      unit.updatePositionFromGrid();

      // Reset animation to idle
      if (unit.animator) {
        unit.animator.setAnimation("idle", true);
      }

      // Встановлюємо правильний напрямок погляду відповідно до команди
      unit.setLookDirectionByTeam();
    }

    // Reset ALL enemy units (alive and dead) - move them back to their original starting positions
    for (const unit of this.objectManager.enemyObjects) {
      // Reset to original starting position
      unit.gridCol = unit.startingGridCol;
      unit.gridRow = unit.startingGridRow;

      // Reset health and other stats to full (resurrect if dead)
      unit.isDead = false;
      unit.currentHealth = unit.maxHealth;

      // Скидаємо всі напрямки і цілі
      unit.moveDirection = null;
      unit.moveTarget = null;
      unit.attackTarget = null;

      // Force update visual position from grid coordinates
      unit.updatePositionFromGrid();

      // Reset animation to idle
      if (unit.animator) {
        unit.animator.setAnimation("idle", true);
      }

      // Встановлюємо правильний напрямок погляду відповідно до команди
      unit.setLookDirectionByTeam();
    }

    // Update grid after position reset and resurrection
    this.objectManager.updateGridWithAllObjects();
    console.log(
      "All units moved back to their original starting positions and resurrected with full health"
    );

    // Force clear canvas and re-render everything
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Force multiple renders to ensure positions update
    this.render();
    setTimeout(() => {
      this.render();
    }, 100);
    setTimeout(() => {
      this.render();

      // Ще раз оновлюємо напрямок погляду після всіх рендерів
      for (const unit of this.objectManager.objects) {
        unit.setLookDirectionByTeam();
      }
      for (const unit of this.objectManager.enemyObjects) {
        unit.setLookDirectionByTeam();
      }
    }, 200);

    // Save the reset state to database
    await this.objectManager.saveObjects();
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

  // Debug methods
  toggleBulletPointDebug() {
    this.debugBulletPoint = !this.debugBulletPoint;
    this.pauseOnBulletSpawn = !this.pauseOnBulletSpawn;

    console.log(
      `🔴 BulletPoint Debug: ${this.debugBulletPoint ? "ON" : "OFF"}`
    );
    console.log(
      `⏸️ Pause on bullet spawn: ${this.pauseOnBulletSpawn ? "ON" : "OFF"}`
    );
  }

  debugPauseBulletSpawn() {
    if (this.pauseOnBulletSpawn) {
      console.log("🔴 DEBUG: Pausing game for bullet spawn debug");
      this.isPaused = true;

      // Додаємо клавішу для продовження
      const resumeHandler = (event) => {
        if (event.code === "Space") {
          console.log("🟢 DEBUG: Resuming game (Space pressed)");
          this.isPaused = false;
          document.removeEventListener("keydown", resumeHandler);
          event.preventDefault();
        }
      };

      document.addEventListener("keydown", resumeHandler);
      console.log("💡 Press SPACE to resume game");
    }
  }
}

window.gameManager = new GameManager();
