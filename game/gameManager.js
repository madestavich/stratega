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
    this.fixedTimeStep = 1000 / 15;
    this.accumulator = 0;
    this.debugMode = false;
    this.debugInterval = null;
    this.isRunning = true;
    this.player = null;
    
    // Round management
    this.roundTimer = null;
    this.roundTimeLeft = 0;
    this.roundDuration = 45; // Default 45 seconds
    this.isRoundActive = false;
    this.checkStatusInterval = null;
    this.isPaused = true; // Game starts paused during unit placement

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

    this.start();
  }

  logGameObjects() {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `%c ${timestamp} `,
      "background: #000; color:rgb(212, 194, 27); font-size: 14px;"
    );
    console.log(this.objectManager.objects);
  }

  toggleDebugMode() {
    this.debugMode = !this.debugMode;

    if (this.debugMode) {
      console.log(
        "%c Debug mode enabled. Objects will be logged every second.",
        "background: #222; color:rgb(47, 201, 9); font-size: 14px;"
      );
      console.log("Scroll down to see detailed object information.");

      // Оновлюємо сітку одразу при включенні режиму дебагу
      this.gridManager.updateGridObjects(this.objectManager);

      this.debugInterval = setInterval(() => this.logGameObjects(), 2000);
      this.logGameObjects();
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
    // Create player (for example purposes)
    this.player = new Player({
      nickname: "Player1",
      race: "neutral", // Use one of the races from races.json
      team: 1,
      coins: 100,
    });

    await this.objectManager.initializeGame();

    this.interfaceManager.updatePlayerInterface(this.player);

    // Start round management
    await this.startRoundTimer();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    try {
      // Оновлюємо всі об'єкти
      this.objectManager.updateAll(dt);

      // Оновлюємо дії для всіх об'єктів через ActionManager
      this.actionManager.update(dt);

      // Оновлюємо стан сітки після руху
      this.gridManager.updateGridObjects(this.objectManager);
    } catch (error) {
      console.error("Error in update:", error);
      // Логування стану гри для відлагодження
      console.log("Game state:", {
        objects: this.objectManager.objects.map((obj) => ({
          gridCol: obj.gridCol,
          gridRow: obj.gridRow,
          gridWidth: obj.gridWidth,
          gridHeight: obj.gridHeight,
          expansionDirection: obj.expansionDirection,
        })),
      });
      // Зупиняємо цикл оновлення, щоб уникнути спаму помилками
      this.isRunning = false;
      console.warn(
        "Game loop stopped due to error. Check console for details."
      );
    }
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
      }
    }
    // Draw the hover indicator
    this.inputManager.drawHoverIndicator(ctx);
    this.objectManager.renderAll();
  }

  loop(timestamp) {
    if (!this.isRunning) return; // Не продовжуємо цикл, якщо гра зупинена
    if (this.lastTime === 0) this.lastTime = timestamp;
    this.deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;
    this.accumulator += this.deltaTime;

    while (this.accumulator >= this.fixedTimeStep) {
      // Оновлюємо анімації для всіх об'єктів незалежно від режиму
      const allObjects = [...this.objectManager.objects, ...this.objectManager.enemyObjects];
      for (const obj of allObjects) {
        if (obj.animator && !obj.animator.hasFinished) {
          obj.animator.nextFrame();
        }
      }

      // Оновлюємо логіку гри тільки якщо не на паузі
      if (!this.isPaused) {
        // Сортуємо об'єкти для детермінованого порядку обробки
        const sortedObjects = allObjects.sort((a, b) => {
          if (a.gridRow !== b.gridRow) return a.gridRow - b.gridRow;
          return a.gridCol - b.gridCol;
        });

        // Оновлюємо ВСІ об'єкти (свої і ворожі) для однакового результату
        for (const obj of sortedObjects) {
          // Викликаємо тільки оновлення позиції та інших параметрів, без анімації
          if (!obj.isDead) {
            obj.updateZCoordinate();
          }
        }

        // Оновлюємо дії для ВСІХ об'єктів (детермінованно)
        this.actionManager.update(this.fixedTimeStep);

        // Оновлюємо стан сітки після руху
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
      console.warn('Cannot start round timer without room ID');
      return;
    }

    this.isRoundActive = true;
    
    // Get round duration first, then start timer
    await this.getRoundDuration();
    
    // Start countdown
    this.roundTimer = setInterval(() => {
      this.roundTimeLeft--;
      
      // Update UI with remaining time
      this.updateTimerDisplay();
      
      if (this.roundTimeLeft <= 0) {
        this.handleTimeUp();
      }
    }, 1000);

    // Check round status every 2 seconds
    this.checkStatusInterval = setInterval(() => {
      this.checkRoundStatus();
    }, 2000);

    console.log(`Round timer started: ${this.roundDuration} seconds`);
  }

  async getRoundDuration() {
    try {
      const response = await fetch('../server/room.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'check_round_status',
          room_id: this.objectManager.currentRoomId
        })
      });

      const result = await response.json();
      
      if (result.success) {
        this.roundDuration = result.round_time || 45;
        this.roundTimeLeft = this.roundDuration;
        console.log(`Round duration set to: ${this.roundDuration} seconds`);
      }
    } catch (error) {
      console.error('Error getting round duration:', error);
      this.roundTimeLeft = this.roundDuration; // Use default
    }
  }

  async checkRoundStatus() {
    if (!this.isRoundActive) return;

    try {
      const response = await fetch('../server/room.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'check_round_status',
          room_id: this.objectManager.currentRoomId
        })
      });

      const result = await response.json();
      
      if (result.success && result.should_start_game) {
        console.log('Both players ready! Starting game logic...');
        this.startGame();
      }
    } catch (error) {
      console.error('Error checking round status:', error);
    }
  }

  handleTimeUp() {
    console.log('Time is up! Auto-setting player as ready...');
    
    // Stop timer first
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
    
    // Auto-set current player as ready
    this.setPlayerReady();
  }

  async setPlayerReady() {
    try {
      const response = await fetch('../server/room.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'set_ready',
          room_id: this.objectManager.currentRoomId
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Player marked as ready');
      }
    } catch (error) {
      console.error('Error setting player ready:', error);
    }
  }

  updateTimerDisplay() {
    // Find timer element and update it
    const timerElement = document.getElementById('round-timer');
    if (timerElement) {
      const minutes = Math.floor(this.roundTimeLeft / 60);
      const seconds = this.roundTimeLeft % 60;
      timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      // Add warning style when time is low
      if (this.roundTimeLeft <= 10) {
        timerElement.classList.add('warning');
      } else {
        timerElement.classList.remove('warning');
      }
    }
  }

  // Start game logic when both players are ready
  async startGame() {
    console.log('=== STARTING GAME LOGIC ===');
    
    // Stop all timers
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
    
    if (this.checkStatusInterval) {
      clearInterval(this.checkStatusInterval);
      this.checkStatusInterval = null;
    }
    
    this.isRoundActive = false;
    
    // CRITICAL: Load all units from database to ensure synchronization
    console.log('Loading latest units from database...');
    await this.objectManager.loadObjects();
    
    // Save current player units and sync with enemy (ensures both players have same data)
    await this.objectManager.synchronizeAfterTurn();
    console.log('Units synchronized. Starting game...');
    
    // Unpause the game - existing logic in update() will handle the rest
    this.isPaused = false;
    
    // Start checking for round end conditions (all units of one player dead)
    this.battleCheckInterval = setInterval(() => {
      this.checkBattleEnd();
    }, 500); // Check every 0.5 seconds
  }

  checkBattleEnd() {
    const playerUnits = this.objectManager.objects.filter(obj => !obj.isDead);
    const enemyUnits = this.objectManager.enemyObjects.filter(obj => !obj.isDead);
    
    // Check if one team has no units left
    if (playerUnits.length === 0 || enemyUnits.length === 0) {
      console.log(`Battle ended! Player units: ${playerUnits.length}, Enemy units: ${enemyUnits.length}`);
      
      // Stop battle checking
      if (this.battleCheckInterval) {
        clearInterval(this.battleCheckInterval);
        this.battleCheckInterval = null;
      }
      
      // Determine winner
      let winnerId = null;
      if (playerUnits.length > 0 && enemyUnits.length === 0) {
        winnerId = 'player'; // Current player wins
      } else if (enemyUnits.length > 0 && playerUnits.length === 0) {
        winnerId = 'enemy'; // Enemy player wins
      }
      
      // End the round with winner info
      this.endRound(winnerId);
    }
  }

  async endRound(winnerId = null) {
    console.log('Round ended! Processing winner and resetting positions...');
    
    // Pause the game
    this.isPaused = true;
    
    // Increment round and show winner modal
    await this.processRoundEnd(winnerId);
    
    // Reset all units to starting positions
    await this.resetUnitsToStartingPositions();
    
    // Reset ready status for new round
    await this.resetReadyStatus();
    
    // Start new round timer
    await this.startRoundTimer();
  }

  async processRoundEnd(winnerId) {
    // Get current user info and room info
    const currentUserId = await this.getCurrentUserId();
    let actualWinnerId = null;
    
    if (winnerId === 'player') {
      actualWinnerId = currentUserId;
    } else if (winnerId === 'enemy') {
      // Get enemy user ID - we'll need to get this from room info
      const roomInfo = await this.getRoomInfo();
      if (roomInfo) {
        actualWinnerId = roomInfo.creator_id === currentUserId ? roomInfo.second_player_id : roomInfo.creator_id;
      }
    }
    
    // Increment round in database
    await this.incrementRound(actualWinnerId);
    
    // Show winner modal
    await this.showWinnerModal();
  }

  async getCurrentUserId() {
    try {
      const response = await fetch('../server/auth/check_login.php', {
        method: 'GET',
        credentials: 'include'
      });
      const result = await response.json();
      return result.user?.id || null;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  }

  async getRoomInfo() {
    try {
      const response = await fetch('../server/room.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'get_current_room'
        })
      });
      const result = await response.json();
      return result.success ? result : null;
    } catch (error) {
      console.error('Error getting room info:', error);
      return null;
    }
  }

  async incrementRound(winnerId) {
    try {
      const response = await fetch('../server/room.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'increment_round',
          room_id: this.objectManager.currentRoomId,
          winner_id: winnerId
        })
      });
      const result = await response.json();
      if (result.success) {
        console.log(`Round incremented to: ${result.new_round}`);
      }
    } catch (error) {
      console.error('Error incrementing round:', error);
    }
  }

  async showWinnerModal() {
    try {
      // Get winner info from database
      const response = await fetch('../server/room.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'get_winner_info',
          room_id: this.objectManager.currentRoomId
        })
      });
      const result = await response.json();
      
      if (result.success) {
        // Update modal content
        const modal = document.getElementById('round-winner-modal');
        const roundNumber = document.getElementById('round-number');
        const winnerNickname = document.getElementById('winner-nickname');
        
        roundNumber.textContent = `Раунд ${result.current_round}`;
        winnerNickname.textContent = result.winner_nickname || 'Невідомий гравець';
        
        // Show modal
        modal.style.display = 'flex';
        
        // Hide modal after 3 seconds
        setTimeout(() => {
          modal.style.display = 'none';
        }, 3000);
      }
    } catch (error) {
      console.error('Error showing winner modal:', error);
    }
  }

  async resetUnitsToStartingPositions() {
    // Reset ALL player units (alive and dead) - move them back to their original starting positions
    for (const unit of this.objectManager.objects) {
      // Store current position before resetting
      const currentPos = `[${unit.gridCol}, ${unit.gridRow}]`;
      
      // Reset to original starting position
      unit.gridCol = unit.startingGridCol;
      unit.gridRow = unit.startingGridRow;
      
      // Reset health and other stats to full (resurrect if dead)
      unit.isDead = false;
      unit.currentHealth = unit.maxHealth;
      unit.moveTarget = null;
      unit.attackTarget = null;
      
      console.log(`Player unit moved from ${currentPos} back to starting position [${unit.gridCol}, ${unit.gridRow}]`);
    }
    
    // Reset ALL enemy units (alive and dead) - move them back to their original starting positions
    for (const unit of this.objectManager.enemyObjects) {
      // Store current position before resetting
      const currentPos = `[${unit.gridCol}, ${unit.gridRow}]`;
      
      // Reset to original starting position
      unit.gridCol = unit.startingGridCol;
      unit.gridRow = unit.startingGridRow;
      
      // Reset health and other stats to full (resurrect if dead)
      unit.isDead = false;
      unit.currentHealth = unit.maxHealth;
      unit.moveTarget = null;
      unit.attackTarget = null;
      
      console.log(`Enemy unit moved from ${currentPos} back to starting position [${unit.gridCol}, ${unit.gridRow}]`);
    }
    
    // Update grid after position reset and resurrection
    this.objectManager.updateGridWithAllObjects();
    console.log('All units moved back to their original starting positions and resurrected with full health');
    
    // Save the reset state to database
    await this.objectManager.saveObjects();
  }

  async pauseForNextRound() {
    console.log('Pausing for next round...');
    
    // Pause the game
    this.isPaused = true;
    
    // Reset ready status for new round
    await this.resetReadyStatus();
    
    // Start new round timer
    await this.startRoundTimer();
  }

  async resetReadyStatus() {
    try {
      const response = await fetch('../server/room.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reset_ready_status',
          room_id: this.objectManager.currentRoomId
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Ready status reset for new round');
        
        // Reset UI button
        const readyButton = document.getElementById('ready-button');
        if (readyButton) {
          readyButton.disabled = false;
          readyButton.textContent = 'ГОТОВИЙ';
          readyButton.style.backgroundColor = '';
        }
      }
    } catch (error) {
      console.error('Error resetting ready status:', error);
    }
  }
}

new GameManager();
