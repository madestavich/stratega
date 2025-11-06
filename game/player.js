export class Player {
  constructor(config) {
    this.nickname = config.nickname;
    this.race = config.race;
    this.team = config.team;
    this.coins = config.coins || 100;

    // Resource management
    this.money = 0;
    this.unitLimit = 0; // Current number of units
    this.maxUnitLimit = 0; // Maximum allowed units

    // Reference to gameManager for DB operations
    this.gameManager = config.gameManager || null;
    this.roomId = config.roomId || null;
  }

  // Initialize player resources from database
  async initializeResources() {
    if (!this.gameManager || !this.roomId) {
      console.warn(
        "Cannot initialize resources: gameManager or roomId not set"
      );
      return;
    }

    try {
      // Load money
      const moneyResponse = await fetch(
        "../server/room.php?action=get_player_money",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: this.roomId }),
        }
      );
      const moneyData = await moneyResponse.json();
      if (moneyData.success) {
        this.money = moneyData.money || 0;
      }

      // Load unit limit
      const limitResponse = await fetch(
        "../server/room.php?action=get_player_unit_limit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: this.roomId }),
        }
      );
      const limitData = await limitResponse.json();
      if (limitData.success) {
        this.unitLimit = limitData.unit_limit || 0;
      }

      // Load max unit limit
      const maxLimitResponse = await fetch(
        "../server/room.php?action=get_max_unit_limit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: this.roomId }),
        }
      );
      const maxLimitData = await maxLimitResponse.json();
      if (maxLimitData.success) {
        this.maxUnitLimit = maxLimitData.max_unit_limit || 0;
      }

      console.log(
        `Player resources initialized: Money=${this.money}, Units=${this.unitLimit}/${this.maxUnitLimit}`
      );
    } catch (error) {
      console.error("Error initializing player resources:", error);
    }
  }

  // Check if player can afford a unit
  canAffordUnit(unitConfig) {
    const cost = unitConfig.cost || 0;
    return this.money >= cost;
  }

  // Check if player has available unit slot
  hasUnitSlot() {
    return this.unitLimit < this.maxUnitLimit;
  }

  // Check if player can purchase unit (both money and slot available)
  canPurchaseUnit(unitConfig) {
    return this.canAffordUnit(unitConfig) && this.hasUnitSlot();
  }

  // Get reason why unit cannot be purchased (for UI feedback)
  getPurchaseBlockReason(unitConfig) {
    if (!this.canAffordUnit(unitConfig)) {
      const cost = unitConfig.cost || 0;
      return `Недостатньо грошей. Потрібно: ${cost}, Доступно: ${this.money}`;
    }
    if (!this.hasUnitSlot()) {
      return `Досягнуто ліміт юнітів (${this.unitLimit}/${this.maxUnitLimit})`;
    }
    return null;
  }

  // Purchase unit (deduct money, increment unit count, save to DB)
  async purchaseUnit(unitConfig) {
    if (!this.canPurchaseUnit(unitConfig)) {
      const reason = this.getPurchaseBlockReason(unitConfig);
      console.warn(`Cannot purchase unit: ${reason}`);
      return false;
    }

    const cost = unitConfig.cost || 0;

    // Deduct money and increment unit count
    this.money -= cost;
    this.unitLimit += 1;

    // Save to database
    try {
      await this.saveMoneyToDatabase();
      await this.saveUnitLimitToDatabase();

      console.log(
        `Unit purchased! Cost: ${cost}, Remaining money: ${this.money}, Units: ${this.unitLimit}/${this.maxUnitLimit}`
      );

      // Update UI if interface manager is available
      if (this.gameManager && this.gameManager.interfaceManager) {
        this.gameManager.interfaceManager.updatePlayerResources(this);
      }

      return true;
    } catch (error) {
      // Rollback on error
      this.money += cost;
      this.unitLimit -= 1;
      console.error("Error saving purchase to database:", error);
      return false;
    }
  }

  // Add money to player
  async addMoney(amount) {
    this.money += amount;
    await this.saveMoneyToDatabase();

    // Update UI
    if (this.gameManager && this.gameManager.interfaceManager) {
      this.gameManager.interfaceManager.updatePlayerResources(this);
    }
  }

  // Set max unit limit (usually done by room creator)
  async setMaxUnitLimit(limit) {
    this.maxUnitLimit = limit;

    try {
      const response = await fetch(
        "../server/room.php?action=save_max_unit_limit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: this.roomId,
            max_unit_limit: limit,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        console.log(`Max unit limit set to ${limit}`);
      }
    } catch (error) {
      console.error("Error setting max unit limit:", error);
    }
  }

  // Save money to database
  async saveMoneyToDatabase() {
    if (!this.roomId) {
      console.warn("Cannot save money: roomId not set");
      return;
    }

    try {
      const response = await fetch(
        "../server/room.php?action=save_player_money",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: this.roomId,
            money: this.money,
          }),
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save money");
      }
    } catch (error) {
      console.error("Error saving money to database:", error);
      throw error;
    }
  }

  // Save unit limit to database
  async saveUnitLimitToDatabase() {
    if (!this.roomId) {
      console.warn("Cannot save unit limit: roomId not set");
      return;
    }

    try {
      const response = await fetch(
        "../server/room.php?action=save_player_unit_limit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: this.roomId,
            unit_limit: this.unitLimit,
          }),
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save unit limit");
      }
    } catch (error) {
      console.error("Error saving unit limit to database:", error);
      throw error;
    }
  }

  // Sync all resources with database
  async syncWithDatabase() {
    await this.initializeResources();
  }
}
