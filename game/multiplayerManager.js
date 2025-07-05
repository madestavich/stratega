/**
 * Клас для управління мультиплеєрними функціями гри
 */
export class MultiplayerManager {
  constructor(gameManager) {
    this.gameManager = gameManager;
    this.roomId = null;
    this.roomData = null;
    this.currentPlayerId = null;
    this.isHost = false;
    this.gamePhase = "preparing"; // 'preparing' або 'running'

    // Ініціалізуємо дані з URL параметрів
    this.initFromUrlParams();
  }

  /**
   * Ініціалізує дані з URL параметрів
   */
  initFromUrlParams() {
    // Отримуємо параметр з хеша
    const hashParams = window.location.hash.substring(1).split("&");
    let roomId = null;

    for (const param of hashParams) {
      const [key, value] = param.split("=");
      if (key === "room") {
        roomId = value;
        break;
      }
    }

    this.roomId = roomId;

    if (this.roomId) {
      this.loadRoomData();
    } else {
      console.error("Room ID not found in URL hash");
      // alert("Room ID not found. Redirecting to home page.");
      // window.location.href = "../index.html";
    }
  }

  /**
   * Завантажує дані про кімнату з сервера
   */
  async loadRoomData() {
    try {
      const response = await fetch(
        `../server/room.php?action=get&room_id=${this.roomId}`
      );
      const data = await response.json();

      if (data.status === "success") {
        this.roomData = data.room;
        this.initializeGameRoom();
      } else {
        console.error("Error loading room data:", data.message);
        alert(`Error loading room data: ${data.message}`);
      }
    } catch (error) {
      console.error("Error fetching room data:", error);
      alert("Failed to load room data. Please try again.");
    }
  }

  /**
   * Ініціалізує ігрову кімнату на основі отриманих даних
   */
  initializeGameRoom() {
    if (!this.roomData) return;

    // Отримуємо ID поточного користувача з localStorage
    this.currentPlayerId = localStorage.getItem("user_id");

    if (!this.currentPlayerId) {
      console.error("User ID not found in localStorage");
      window.location.href = "../index.html";
      return;
    }

    // Визначаємо, чи є поточний користувач хостом кімнати
    this.isHost = this.currentPlayerId == this.roomData.creator_id;

    // Визначаємо сторону гравця (ліва або права)
    const playerSide = this.determinePlayerSide();

    // Парсимо game_state з JSON
    let gameState = {};
    try {
      if (this.roomData.game_state) {
        gameState = JSON.parse(this.roomData.game_state);
      } else {
        // Створюємо початковий стан гри, якщо його немає
        gameState = {
          phase: "preparing",
          players: [
            { id: this.roomData.creator_id, money: 1000, objects: [] },
            { id: this.roomData.second_player_id, money: 1000, objects: [] },
          ],
          currentRound: 0,
        };
      }
    } catch (e) {
      console.error("Error parsing game state:", e);
      gameState = {
        phase: "preparing",
        players: [
          { id: this.roomData.creator_id, money: 1000, objects: [] },
          { id: this.roomData.second_player_id, money: 1000, objects: [] },
        ],
        currentRound: 0,
      };
    }

    // Оновлюємо фазу гри
    this.gamePhase = gameState.phase || "preparing";

    // Знаходимо дані поточного гравця
    const playerData = gameState.players.find(
      (p) => p.id == this.currentPlayerId
    );

    if (!playerData) {
      console.error("Player data not found in game state");
      return;
    }

    // Ініціалізуємо гравця в GameManager
    this.gameManager.player = new Player({
      nickname: this.isHost
        ? this.roomData.creator_name
        : this.roomData.second_player_name,
      race: playerData.race || "neutral",
      team: this.isHost ? 1 : 2,
      coins: playerData.money || 1000,
      side: playerSide,
    });

    // Оновлюємо інтерфейс гравця
    this.gameManager.interfaceManager.updatePlayerInterface(
      this.gameManager.player
    );

    console.log(`Game room initialized. Room ID: ${this.roomId}`);
    console.log(
      `You are playing as: ${this.gameManager.player.nickname} (${playerSide} side)`
    );
    console.log(`Game phase: ${this.gamePhase}`);

    // Завантажуємо юніти, якщо вони є в game_state
    this.loadUnitsFromGameState(gameState);

    // Оновлюємо інтерфейс відповідно до фази гри
    this.updateInterfaceForGamePhase();
  }

  /**
   * Визначає сторону гравця (ліва або права)
   * @returns {string} 'left' або 'right'
   */
  determinePlayerSide() {
    // Хост завжди зліва, другий гравець завжди справа
    return this.isHost ? "left" : "right";
  }

  /**
   * Завантажує юніти з game_state
   * @param {Object} gameState - Стан гри з сервера
   */
  loadUnitsFromGameState(gameState) {
    // Очищаємо існуючі об'єкти
    this.gameManager.objectManager.clearAll();

    // Якщо в gameState є об'єкти, завантажуємо їх
    if (gameState && gameState.players) {
      gameState.players.forEach((player) => {
        if (player.objects && Array.isArray(player.objects)) {
          player.objects.forEach((unitData) => {
            // Створюємо юніт з даних
            this.gameManager.objectManager.createUnit({
              type: unitData.type,
              gridRow: unitData.gridRow,
              gridCol: unitData.gridCol,
              team: player.id == this.roomData.creator_id ? 1 : 2,
              race: player.race || "neutral",
              playerId: player.id,
              health: unitData.health,
              isDead: unitData.isDead || false,
            });
          });
        }
      });

      // Оновлюємо сітку після додавання всіх юнітів
      this.gameManager.gridManager.updateGridObjects(
        this.gameManager.objectManager
      );
    }
  }

  /**
   * Оновлює інтерфейс відповідно до фази гри
   */
  updateInterfaceForGamePhase() {
    const startButton = document.querySelector(".start-button");

    if (this.gamePhase === "preparing") {
      // Режим розстановки юнітів
      startButton.textContent = "START GAME";
      startButton.disabled = false;

      // Показуємо меню вибору юнітів
      document.getElementById("unitMenu").style.display = "flex";

      // Дозволяємо розміщувати юніти тільки на своїй стороні
      this.gameManager.inputManager.setPlacementRestrictions(
        this.isHost ? "left" : "right"
      );

      // Додаємо обробник для кнопки START
      startButton.onclick = () => this.startGame();
    } else if (this.gamePhase === "running") {
      // Режим гри
      startButton.textContent = "GAME IN PROGRESS";
      startButton.disabled = true;

      // Приховуємо меню вибору юнітів
      document.getElementById("unitMenu").style.display = "none";

      // Перевіряємо, чи є переможець
      this.checkForWinner();
    }
  }

  /**
   * Починає гру (переходить з фази підготовки до фази гри)
   */
  async startGame() {
    if (!this.isHost) {
      alert("Only the host can start the game");
      return;
    }

    // Перевіряємо, чи обидва гравці розмістили юніти
    const gameState = this.getCurrentGameState();
    const player1HasUnits =
      gameState.players[0].objects && gameState.players[0].objects.length > 0;
    const player2HasUnits =
      gameState.players[1].objects && gameState.players[1].objects.length > 0;

    if (!player1HasUnits || !player2HasUnits) {
      alert("Both players must place units before starting the game");
      return;
    }

    // Оновлюємо фазу гри
    this.gamePhase = "running";
    gameState.phase = "running";

    // Оновлюємо стан гри на сервері
    await this.updateGameState(gameState);

    // Оновлюємо інтерфейс
    this.updateInterfaceForGamePhase();
  }

  /**
   * Перевіряє, чи є переможець у грі
   */
  checkForWinner() {
    const player1Units = this.gameManager.objectManager.objects.filter(
      (obj) => obj.team === 1 && !obj.isDead
    );

    const player2Units = this.gameManager.objectManager.objects.filter(
      (obj) => obj.team === 2 && !obj.isDead
    );

    if (player1Units.length === 0) {
      // Переміг гравець 2
      this.endGame(2);
    } else if (player2Units.length === 0) {
      // Переміг гравець 1
      this.endGame(1);
    }
  }

  /**
   * Завершує гру з визначеним переможцем
   * @param {number} winnerTeam - Команда-переможець (1 або 2)
   */
  async endGame(winnerTeam) {
    const winnerId =
      winnerTeam === 1
        ? this.roomData.creator_id
        : this.roomData.second_player_id;
    const winnerName =
      winnerTeam === 1
        ? this.roomData.creator_name
        : this.roomData.second_player_name;

    alert(`Game over! ${winnerName} wins!`);

    // Оновлюємо стан гри
    const gameState = this.getCurrentGameState();
    gameState.phase = "ended";
    gameState.winner = {
      id: winnerId,
      name: winnerName,
      team: winnerTeam,
    };

    // Оновлюємо стан гри на сервері
    await this.updateGameState(gameState);

    // Перенаправляємо на головну сторінку через 5 секунд
    setTimeout(() => {
      window.location.href = "../index.html";
    }, 5000);
  }

  /**
   * Отримує поточний стан гри
   * @returns {Object} Поточний стан гри
   */
  getCurrentGameState() {
    let gameState = {};

    try {
      if (this.roomData.game_state) {
        gameState = JSON.parse(this.roomData.game_state);
      } else {
        gameState = {
          phase: this.gamePhase,
          players: [
            { id: this.roomData.creator_id, money: 1000, objects: [] },
            { id: this.roomData.second_player_id, money: 1000, objects: [] },
          ],
          currentRound: 0,
        };
      }
    } catch (e) {
      console.error("Error parsing game state:", e);
      gameState = {
        phase: this.gamePhase,
        players: [
          { id: this.roomData.creator_id, money: 1000, objects: [] },
          { id: this.roomData.second_player_id, money: 1000, objects: [] },
        ],
        currentRound: 0,
      };
    }

    // Оновлюємо об'єкти гравців
    gameState.players.forEach((player) => {
      const playerObjects = this.gameManager.objectManager.objects.filter(
        (obj) => obj.playerId == player.id
      );

      player.objects = playerObjects.map((obj) => ({
        type: obj.type,
        gridRow: obj.gridRow,
        gridCol: obj.gridCol,
        health: obj.health,
        isDead: obj.isDead,
      }));
    });

    return gameState;
  }

  /**
   * Оновлює стан гри на сервері
   * @param {Object} gameState - Новий стан гри
   */
  async updateGameState(gameState) {
    try {
      const formData = new FormData();
      formData.append("action", "update");
      formData.append("room_id", this.roomId);
      formData.append("game_state", JSON.stringify(gameState));

      const response = await fetch("../server/room.php", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.status !== "success") {
        console.error("Error updating game state:", data.message);
      } else {
        // Оновлюємо локальні дані кімнати
        this.roomData.game_state = JSON.stringify(gameState);
      }
    } catch (error) {
      console.error("Error sending game state update:", error);
    }
  }

  /**
   * Періодично оновлює дані кімнати з сервера
   * @param {number} interval - Інтервал оновлення в мілісекундах
   */
  startPolling(interval = 3000) {
    this.pollingInterval = setInterval(() => {
      this.loadRoomData();
    }, interval);
  }

  /**
   * Зупиняє періодичне оновлення даних кімнати
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }
}
