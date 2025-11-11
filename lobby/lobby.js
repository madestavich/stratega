class LobbyManager {
  constructor() {
    this.roomId = null;
    this.isHost = false;
    this.currentUser = null;
    this.lobbyState = null;
    this.pollInterval = null;
    this.isReady = false;
    this.selectedRace = null;
    this.isEditingSettings = false; // Flag to prevent overwriting during editing

    // DOM elements
    this.elements = {
      roomId: document.getElementById("room-id"),
      roomType: document.getElementById("room-type"),
      hostUsername: document.getElementById("host-username"),
      hostRace: document.getElementById("host-race"),
      hostReady: document.getElementById("host-ready"),
      guestUsername: document.getElementById("guest-username"),
      guestRace: document.getElementById("guest-race"),
      guestReady: document.getElementById("guest-ready"),
      gameMode: document.getElementById("game-mode"),
      roundTime: document.getElementById("round-time"),
      startingMoney: document.getElementById("starting-money"),
      roundIncome: document.getElementById("round-income"),
      maxUnitLimit: document.getElementById("max-unit-limit"),
      unitLimitValue: document.getElementById("unit-limit-value"),
      settingsLockedMessage: document.getElementById("settings-locked-message"),
      raceSelectionDisabled: document.getElementById("race-selection-disabled"),
      raceGrid: document.getElementById("race-grid"),
      readyButton: document.getElementById("ready-button"),
      startButton: document.getElementById("start-button"),
      leaveButton: document.getElementById("leave-button"),
      loadingOverlay: document.getElementById("loading-overlay"),
    };
  }

  async initialize() {
    // Get room ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    this.roomId = urlParams.get("room_id");

    if (!this.roomId) {
      alert("ID кімнати не знайдено");
      window.location.href = "../index.html";
      return;
    }

    this.showLoading(true);

    try {
      // Load initial lobby state (this will determine user role)
      await this.loadLobbyState();

      console.log("Before setupEventListeners, isHost:", this.isHost);

      // Setup event listeners AFTER role is determined
      this.setupEventListeners();

      // Start polling
      this.startPolling();

      this.showLoading(false);
    } catch (error) {
      console.error("Error initializing lobby:", error);
      alert("Помилка завантаження лоббі: " + error.message);
      this.showLoading(false);
      window.location.href = "../index.html";
    }
  }

  async loadLobbyState() {
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "get_lobby_state",
          room_id: this.roomId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Не вдалося завантажити стан лоббі");
      }

      this.lobbyState = data;
      this.updateUI();

      // Check if game has started
      if (data.game_status === "in_progress") {
        window.location.href = `../game/game.html?room_id=${this.roomId}`;
      }
    } catch (error) {
      throw error;
    }
  }

  async updateUI() {
    if (!this.lobbyState) return;

    const { players, settings } = this.lobbyState;

    // Update room info
    this.elements.roomId.textContent = `ID: ${this.roomId}`;
    this.elements.roomType.textContent = `Тип: ${
      settings.room_type === "public" ? "Публічна" : "Приватна"
    }`;

    // Determine if current user is host - WAIT for this to complete
    if (players.host && players.host.id) {
      await this.checkUserRole(players);
    }

    // Update players
    this.updatePlayers(players);

    // Update settings
    this.updateSettings(settings);

    // Update race selection
    this.updateRaceSelection(settings.game_mode);
  }

  async checkUserRole(players) {
    try {
      const res = await fetch("../server/auth/check_login.php", {
        credentials: "include",
      });
      const data = await res.json();

      console.log("check_login.php response:", data);
      console.log("players.host:", players.host);

      if (data.logged_in && data.user) {
        this.currentUser = data.user;
        // Convert both to numbers for comparison
        const userId = parseInt(data.user.id);
        const hostId = parseInt(players.host.id);
        this.isHost = userId === hostId;

        console.log("User role comparison:", {
          userId: userId,
          hostId: hostId,
          userIdType: typeof userId,
          hostIdType: typeof hostId,
          areEqual: userId === hostId,
          isHost: this.isHost,
        });

        // Update UI based on role
        if (this.isHost) {
          this.elements.startButton.style.display = "inline-block";
          // Enable settings for host
          this.elements.settingsLockedMessage.style.display = "none";
          this.elements.gameMode.disabled = false;
          this.elements.roundTime.disabled = false;
          this.elements.startingMoney.disabled = false;
          this.elements.roundIncome.disabled = false;
          this.elements.maxUnitLimit.disabled = false;
        } else {
          this.enableSettingsLock();
        }

        // Update ready status based on player
        if (this.isHost) {
          this.isReady = players.host.ready;
          this.selectedRace = players.host.race;
        } else if (players.guest) {
          this.isReady = players.guest.ready;
          this.selectedRace = players.guest.race;
        }

        this.updateReadyButton();
        this.updateSelectedRace();
      }
    } catch (error) {
      console.error("Error checking user role:", error);
    }
  }

  updatePlayers(players) {
    // Host
    if (players.host) {
      this.elements.hostUsername.textContent = players.host.username;
      this.elements.hostRace.textContent = `Раса: ${
        players.host.race || "Не обрано"
      }`;
      this.elements.hostReady.textContent = players.host.ready ? "✅" : "⏳";

      if (players.host.ready) {
        document.querySelector(".host-card").classList.add("ready");
      } else {
        document.querySelector(".host-card").classList.remove("ready");
      }
    }

    // Guest
    if (players.guest) {
      this.elements.guestUsername.textContent = players.guest.username;
      this.elements.guestRace.textContent = `Раса: ${
        players.guest.race || "Не обрано"
      }`;
      this.elements.guestReady.textContent = players.guest.ready ? "✅" : "⏳";

      if (players.guest.ready) {
        document.querySelector(".guest-card").classList.add("ready");
      } else {
        document.querySelector(".guest-card").classList.remove("ready");
      }
    } else {
      this.elements.guestUsername.textContent = "Очікування гравця...";
      this.elements.guestRace.textContent = "Раса: -";
      this.elements.guestReady.textContent = "⏳";
      document.querySelector(".guest-card").classList.remove("ready");
    }

    // Update start button availability
    if (
      this.isHost &&
      players.host.ready &&
      players.guest &&
      players.guest.ready
    ) {
      this.elements.startButton.disabled = false;
    } else {
      this.elements.startButton.disabled = true;
    }
  }

  updateSettings(settings) {
    // Don't update if user is actively editing
    if (this.isEditingSettings) return;

    this.elements.gameMode.value = settings.game_mode || "all_races";
    this.elements.roundTime.value = settings.round_time || 45;
    this.elements.startingMoney.value = settings.starting_money || 1000;
    this.elements.roundIncome.value = settings.round_income || 200;
    this.elements.maxUnitLimit.value = settings.max_unit_limit || 40;
    this.elements.unitLimitValue.textContent = settings.max_unit_limit || 40;
  }

  updateRaceSelection(gameMode) {
    const isClassicMode = gameMode === "classic";

    if (isClassicMode) {
      this.elements.raceSelectionDisabled.style.display = "none";
      this.elements.raceGrid.style.display = "grid";

      // Enable/disable race cards based on ready status
      const raceCards = document.querySelectorAll(".race-card");
      raceCards.forEach((card) => {
        if (this.isReady) {
          card.classList.add("disabled");
        } else {
          card.classList.remove("disabled");
        }
      });
    } else {
      this.elements.raceSelectionDisabled.style.display = "block";
      this.elements.raceGrid.style.display = "none";
    }
  }

  updateSelectedRace() {
    const raceCards = document.querySelectorAll(".race-card");
    raceCards.forEach((card) => {
      if (card.dataset.race === this.selectedRace) {
        card.classList.add("selected");
      } else {
        card.classList.remove("selected");
      }
    });
  }

  updateReadyButton() {
    if (this.isReady) {
      this.elements.readyButton.textContent = "❌ Скасувати готовність";
      this.elements.readyButton.classList.add("active");
    } else {
      this.elements.readyButton.textContent = "✓ Готовий";
      this.elements.readyButton.classList.remove("active");
    }
  }

  enableSettingsLock() {
    this.elements.settingsLockedMessage.style.display = "block";
    this.elements.gameMode.disabled = true;
    this.elements.roundTime.disabled = true;
    this.elements.startingMoney.disabled = true;
    this.elements.roundIncome.disabled = true;
    this.elements.maxUnitLimit.disabled = true;
  }

  setupEventListeners() {
    console.log("Setting up event listeners, isHost:", this.isHost);

    // Slider update for everyone (visual feedback)
    this.elements.maxUnitLimit.addEventListener("input", (e) => {
      this.elements.unitLimitValue.textContent = e.target.value;
    });

    // Settings changes (only for host)
    if (this.isHost) {
      console.log("Adding host-only event listeners");

      // Track when user starts editing
      const settingsInputs = [
        this.elements.gameMode,
        this.elements.roundTime,
        this.elements.startingMoney,
        this.elements.roundIncome,
        this.elements.maxUnitLimit,
      ];

      settingsInputs.forEach((input) => {
        input.addEventListener("focus", () => {
          this.isEditingSettings = true;
        });

        input.addEventListener("blur", () => {
          setTimeout(() => {
            this.isEditingSettings = false;
          }, 100);
        });
      });

      this.elements.gameMode.addEventListener("change", () => {
        console.log("Game mode changed, calling saveSettings");
        this.saveSettings();
      });
      this.elements.roundTime.addEventListener("change", () => {
        console.log("Round time changed, calling saveSettings");
        this.saveSettings();
      });
      this.elements.startingMoney.addEventListener("change", () => {
        console.log("Starting money changed, calling saveSettings");
        this.saveSettings();
      });
      this.elements.roundIncome.addEventListener("change", () => {
        console.log("Round income changed, calling saveSettings");
        this.saveSettings();
      });
      this.elements.maxUnitLimit.addEventListener("change", () => {
        console.log("Max unit limit changed, calling saveSettings");
        this.saveSettings();
      });
    }

    // Race selection
    const raceCards = document.querySelectorAll(".race-card");
    raceCards.forEach((card) => {
      card.addEventListener("click", () => {
        if (
          !card.classList.contains("disabled") &&
          this.lobbyState.settings.game_mode === "classic"
        ) {
          this.selectRace(card.dataset.race);
        }
      });
    });

    // Ready button
    this.elements.readyButton.addEventListener("click", () => {
      this.toggleReady();
    });

    // Start button (only for host)
    this.elements.startButton.addEventListener("click", () => {
      this.startGame();
    });

    // Leave button
    this.elements.leaveButton.addEventListener("click", () => {
      this.leaveRoom();
    });
  }

  async saveSettings() {
    if (!this.isHost) return;

    try {
      const settings = {
        action: "update_room_settings",
        room_id: this.roomId,
        game_mode: this.elements.gameMode.value,
        round_time: parseInt(this.elements.roundTime.value),
        starting_money: parseInt(this.elements.startingMoney.value),
        round_income: parseInt(this.elements.roundIncome.value),
        max_unit_limit: parseInt(this.elements.maxUnitLimit.value),
      };

      console.log("Saving settings to DB:", settings);

      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      console.log("Save settings response:", data);

      if (!data.success) {
        throw new Error(data.error);
      }

      // Settings saved successfully, allow updates again
      this.isEditingSettings = false;
      console.log("Settings saved successfully to DB");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Помилка збереження налаштувань: " + error.message);
      this.isEditingSettings = false;
    }
  }

  async selectRace(race) {
    if (this.isReady) {
      alert("Скасуйте готовність перед зміною раси");
      return;
    }

    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "select_race",
          room_id: this.roomId,
          race: race,
        }),
      });

      const data = await response.json();

      if (data.success) {
        this.selectedRace = race;
        this.updateSelectedRace();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error selecting race:", error);
      alert("Помилка вибору раси: " + error.message);
    }
  }

  async toggleReady() {
    // Check race selection in classic mode
    if (
      this.lobbyState.settings.game_mode === "classic" &&
      !this.selectedRace &&
      !this.isReady
    ) {
      alert("Спочатку оберіть расу");
      return;
    }

    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "toggle_ready_lobby",
          room_id: this.roomId,
          ready: !this.isReady,
        }),
      });

      const data = await response.json();

      if (data.success) {
        this.isReady = data.ready;
        this.updateReadyButton();
        this.updateRaceSelection(this.lobbyState.settings.game_mode);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error toggling ready:", error);
      alert("Помилка зміни готовності: " + error.message);
    }
  }

  async startGame() {
    if (!this.isHost) return;

    this.showLoading(true);

    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "start_game_from_lobby",
          room_id: this.roomId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to game
        window.location.href = `../game/game.html?room_id=${this.roomId}`;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error starting game:", error);
      alert("Помилка запуску гри: " + error.message);
      this.showLoading(false);
    }
  }

  async leaveRoom() {
    if (!confirm("Ви впевнені, що хочете покинути кімнату?")) {
      return;
    }

    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "leave_room",
          room_id: this.roomId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        window.location.href = "../index.html";
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error leaving room:", error);
      alert("Помилка виходу з кімнати: " + error.message);
    }
  }

  startPolling() {
    // Poll every 2 seconds
    this.pollInterval = setInterval(async () => {
      try {
        await this.loadLobbyState();
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  showLoading(show) {
    this.elements.loadingOverlay.style.display = show ? "flex" : "none";
  }
}

// Initialize lobby when page loads
document.addEventListener("DOMContentLoaded", () => {
  const lobbyManager = new LobbyManager();
  lobbyManager.initialize();

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    lobbyManager.stopPolling();
  });
});
