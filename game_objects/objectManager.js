import { GameObject } from "../import.js";

export class ObjectManager {
  constructor(ctx, gridManager, configLoader, spriteLoader) {
    this.ctx = ctx;
    this.gridManager = gridManager;
    this.configLoader = configLoader;
    this.spriteLoader = spriteLoader;
    this.objects = [];
    this.enemyObjects = [];
    this.particles = [];
    this.currentRoomId = null;
    this.isCreator = null; // Додаємо прапорець, чи це creator
  }

  async createObject(objectType, objectConfig, team, gridCol, gridRow) {
    // Перевіряємо, чи спрайт вже завантажений
    if (!this.configLoader.getConfig(objectType)) {
      // Якщо ні, завантажуємо його
      await this.spriteLoader.loadSprites(objectType);
    }

    // Отримуємо конфігурацію спрайту
    const spriteConfig = this.configLoader.getConfig(objectType);

    if (!spriteConfig) {
      console.error(`Sprite config for "${objectType}" not found`);
      return null;
    }

    objectConfig.team = team;
    console.log(objectConfig.team);

    const obj = new GameObject(
      this.ctx,
      spriteConfig,
      objectConfig,
      gridCol,
      gridRow,
      this.gridManager
    );

    // Store starting position for reset between rounds
    obj.startingGridCol = gridCol;
    obj.startingGridRow = gridRow;

    // Store the unit type info for later serialization
    obj.unitType = objectType;
    obj.unitInfo = this.findUnitInfoByType(objectType);

    this.objects.push(obj);

    // Auto-save to database after creating object
    if (this.currentRoomId) {
      this.saveObjects().catch((err) =>
        console.error("Failed to auto-save object:", err)
      );
    }

    return obj;
  }

  async createObjectFromRace(race, unitTier, unitType, gridCol, gridRow) {
    try {
      // Завантажуємо конфігурацію рас, якщо потрібно
      const response = await fetch("/game_configs/races.json");
      const racesConfig = await response.json();

      if (!racesConfig[race]) {
        console.error(`Race "${race}" not found in races config`);
        return null;
      }

      if (
        !racesConfig[race].units[unitTier] ||
        !racesConfig[race].units[unitTier][unitType]
      ) {
        console.error(
          `Unit "${unitType}" of tier "${unitTier}" not found in race "${race}"`
        );
        return null;
      }

      // Отримуємо конфігурацію об'єкта з races.json
      const objectConfig = racesConfig[race].units[unitTier][unitType];

      // Завантажуємо спрайт, якщо потрібно
      await this.spriteLoader.loadSprites(unitType);

      // Отримуємо конфігурацію спрайту
      const spriteConfig = this.configLoader.getConfig(unitType);

      if (!spriteConfig) {
        console.error(`Sprite config for "${unitType}" not found`);
        return null;
      }

      // Створюємо об'єкт
      const obj = new GameObject(
        this.ctx,
        spriteConfig,
        objectConfig,
        gridCol,
        gridRow,
        this.gridManager
      );
      this.objects.push(obj);
      return obj;
    } catch (error) {
      console.error("Error creating object from race:", error);
      return null;
    }
  }

  async createMultiple(objectType, objectConfig, count, positions) {
    const createdObjects = [];
    for (let i = 0; i < count; i++) {
      const { col, row } = positions[i];
      const obj = await this.createObject(objectType, objectConfig, col, row);
      if (obj) createdObjects.push(obj);
    }
    return createdObjects;
  }

  // Інші методи залишаються без змін
  removeObject(object) {
    const index = this.objects.indexOf(object);
    if (index !== -1) {
      this.objects.splice(index, 1);
      // Update the grid to reflect that cells are no longer occupied by this object
      this.gridManager.updateGridObjects(this);

      // Auto-save to database after removing object
      if (this.currentRoomId) {
        this.saveObjects().catch((err) =>
          console.error("Failed to auto-save after removal:", err)
        );
      }
    }
  }

  updateAll(dt) {
    // Update ALL objects (player and enemy) for consistent game state
    // Sort objects for deterministic update order
    const allObjects = [...this.objects, ...this.enemyObjects];
    const sortedObjects = allObjects.sort((a, b) => {
      if (a.gridRow !== b.gridRow) return a.gridRow - b.gridRow;
      return a.gridCol - b.gridCol;
    });

    for (const obj of sortedObjects) obj.update();

    // Update particles and check collisions with ALL objects
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.update(dt);
      particle.checkCollision(allObjects);
      if (particle.hasReachedTarget) {
        this.particles.splice(i, 1);
      }
    }
  }

  renderAll() {
    // Сортуємо об'єкти за Z-координатою перед відображенням
    const sortedObjects = [...this.objects, ...this.enemyObjects].sort(
      (a, b) => a.z - b.z
    );
    for (const obj of sortedObjects) obj.render();
    for (const particle of this.particles) particle.draw();
  }

  // Set current room ID for synchronization
  setRoomId(roomId) {
    this.currentRoomId = roomId;
  }

  // Get current room ID from server based on user session
  async getCurrentRoomId() {
    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "get_current_room",
        }),
      });

      const result = await response.json();

      if (result.success) {
        return {
          roomId: result.room_id,
          isCreator: result.is_creator,
        };
      } else {
        console.error("Failed to get current room:", result.message);
        return null;
      }
    } catch (error) {
      console.error("Error getting current room:", error);
      return null;
    }
  }

  // Initialize game - automatically detect room and load existing units
  async initializeGame(roomId = null) {
    // If no roomId provided, try to get it from server
    if (!roomId) {
      const roomInfo = await this.getCurrentRoomId();
      if (roomInfo) {
        roomId = roomInfo.roomId;
        this.isCreator = roomInfo.isCreator; // Зберігаємо статус creator/guest
        console.log(
          `Auto-detected room ID: ${roomId} (${
            roomInfo.isCreator ? "creator" : "guest"
          })`
        );
      } else {
        console.error("Could not determine current room ID");
        return false;
      }
    }

    this.setRoomId(roomId);

    // Load existing units from previous rounds
    const loadSuccess = await this.loadObjects();

    if (loadSuccess) {
      console.log(
        `Game initialized with ${this.objects.length} player units and ${this.enemyObjects.length} enemy units`
      );

      // Встановлюємо правильний напрямок погляду для всіх завантажених юнітів
      for (const unit of this.objects) {
      }
      for (const unit of this.enemyObjects) {
        unit.setLookDirectionByTeam();
      }

      // Update grid with loaded objects
      this.updateGridWithAllObjects();

      return true;
    } else {
      console.log(
        "Game initialized with empty state (new game or load failed)"
      );
      this.objects = [];
      this.enemyObjects = [];
      return false;
    }
  }

  // Serialize objects to simple format for database
  serializeObjectsForDB() {
    return this.objects.map((obj) => {
      // Use stored unit info if available, otherwise try to find it
      const unitInfo = obj.unitInfo || this.findUnitTypeAndTier(obj);

      return {
        gridCol: obj.gridCol,
        gridRow: obj.gridRow,
        startingGridCol: obj.startingGridCol,
        startingGridRow: obj.startingGridRow,
        unitType: obj.unitType || unitInfo.unitType,
        unitTier: unitInfo.unitTier,
        race: unitInfo.race || "neutral",
      };
    });
  }

  // Find unit type and tier from races config (fallback method)
  findUnitTypeAndTier(gameObject) {
    const racesConfig = this.configLoader.racesConfig;
    if (!racesConfig)
      return { unitType: "unknown", unitTier: "tier_one", race: "neutral" };

    // Search through all races and tiers
    for (const race in racesConfig) {
      if (racesConfig[race].units) {
        for (const tier in racesConfig[race].units) {
          for (const unitType in racesConfig[race].units[tier]) {
            const unitConfig = racesConfig[race].units[tier][unitType];

            // Try multiple matching methods
            if (this.isMatchingUnit(gameObject, unitType, unitConfig)) {
              return { unitType, unitTier: tier, race };
            }
          }
        }
      }
    }

    return { unitType: "unknown", unitTier: "tier_one", race: "neutral" };
  }

  // Check if gameObject matches this unit type
  isMatchingUnit(gameObject, unitType, unitConfig) {
    // Method 1: Check sprite imagePath
    if (
      gameObject.spriteConfig &&
      gameObject.spriteConfig.imagePath &&
      gameObject.spriteConfig.imagePath.includes(unitType)
    ) {
      return true;
    }

    // Method 2: Check objectType property
    if (gameObject.config && gameObject.config.objectType === unitType) {
      return true;
    }

    // Method 3: Check grid dimensions and other properties
    if (gameObject.config && unitConfig) {
      const configMatch =
        gameObject.config.gridWidth === unitConfig.gridWidth &&
        gameObject.config.gridHeight === unitConfig.gridHeight &&
        gameObject.config.health === unitConfig.health;

      if (configMatch) {
        return true;
      }
    }

    return false;
  }

  // Find unit info by type name from races config
  findUnitInfoByType(unitType) {
    const racesConfig = this.configLoader.racesConfig;
    if (!racesConfig)
      return { unitType, unitTier: "tier_one", race: "neutral" };

    // Search through all races and tiers
    for (const race in racesConfig) {
      if (racesConfig[race].units) {
        for (const tier in racesConfig[race].units) {
          if (racesConfig[race].units[tier][unitType]) {
            return { unitType, unitTier: tier, race };
          }
        }
      }
    }

    return { unitType, unitTier: "tier_one", race: "neutral" };
  }

  // Save objects to server
  async saveObjects() {
    if (!this.currentRoomId) {
      console.error("No room ID set for object synchronization");
      return false;
    }

    try {
      const serializedObjects = this.serializeObjectsForDB();

      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "save_objects",
          room_id: this.currentRoomId,
          objects: serializedObjects,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log("Objects saved successfully");
        return true;
      } else {
        console.error("Failed to save objects:", result.error);
        return false;
      }
    } catch (error) {
      console.error("Error saving objects:", error);
      return false;
    }
  }

  // Load objects from server
  async loadObjects() {
    if (!this.currentRoomId) {
      console.error("No room ID set for object synchronization");
      return false;
    }

    try {
      const response = await fetch("../server/room.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "load_objects",
          room_id: this.currentRoomId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Clear current objects
        this.objects = [];
        this.enemyObjects = [];

        // Recreate player objects from serialized data
        for (const objData of result.player_objects || []) {
          await this.createObjectFromSerializedData(objData, this.objects);
        }

        // Recreate enemy objects from serialized data
        for (const objData of result.enemy_objects || []) {
          await this.createObjectFromSerializedData(objData, this.enemyObjects);
        }

        console.log(
          `Loaded ${this.objects.length} player objects and ${this.enemyObjects.length} enemy objects`
        );

        console.log(
          `Objects loaded successfully: ${this.objects.length} player, ${this.enemyObjects.length} enemy`
        );
        return true;
      } else {
        console.error("Failed to load objects:", result.error);
        return false;
      }
    } catch (error) {
      console.error("Error loading objects:", error);
      return false;
    }
  }

  // Create object from serialized data using races config
  async createObjectFromSerializedData(objData, targetArray) {
    try {
      const racesConfig = this.configLoader.racesConfig;
      if (!racesConfig || !racesConfig[objData.race]) {
        console.error(`Race "${objData.race}" not found in config`);
        return null;
      }

      const raceConfig = racesConfig[objData.race];
      if (
        !raceConfig.units[objData.unitTier] ||
        !raceConfig.units[objData.unitTier][objData.unitType]
      ) {
        console.error(
          `Unit "${objData.unitType}" of tier "${objData.unitTier}" not found in race "${objData.race}"`
        );
        return null;
      }

      // Get unit configuration
      const unitConfig = raceConfig.units[objData.unitTier][objData.unitType];

      // Load sprite if needed
      await this.spriteLoader.loadSprites(objData.unitType);

      // Get sprite configuration
      const spriteConfig = this.configLoader.getConfig(objData.unitType);
      if (!spriteConfig) {
        console.error(`Sprite config for "${objData.unitType}" not found`);
        return null;
      }

      // Визначаємо команду згідно з роллю
      let team;
      if (this.isCreator === true) {
        team = targetArray === this.objects ? 1 : 2;
      } else {
        team = targetArray === this.objects ? 2 : 1;
      }

      // Просто: this.objects завжди команда 1, this.enemyObjects завжди команда 2
      // const team = targetArray === this.objects ? 1 : 2;

      // Create GameObject
      const obj = new GameObject(
        this.ctx,
        spriteConfig,
        unitConfig,
        objData.gridCol,
        objData.gridRow,
        this.gridManager
      );

      // Set team (1 for player objects, 2 for enemy objects)
      obj.team = team;

      // Store starting position (use current position if no starting position stored)
      obj.startingGridCol = objData.startingGridCol || objData.gridCol;
      obj.startingGridRow = objData.startingGridRow || objData.gridRow;

      // Store unit type info for future serialization
      obj.unitType = objData.unitType;
      obj.unitInfo = {
        unitType: objData.unitType,
        unitTier: objData.unitTier,
        race: objData.race,
      };

      // Health comes from unit config, no need to restore from DB
      // obj.health and obj.maxHealth are already set from unitConfig

      targetArray.push(obj);
      return obj;
    } catch (error) {
      console.error("Error creating object from serialized data:", error);
      return null;
    }
  }

  // Synchronize objects after turn (save current state, then load full state for both players)
  async synchronizeAfterTurn() {
    console.log(`Saving ${this.objects.length} player units...`);

    const saveSuccess = await this.saveObjects();
    if (saveSuccess) {
      // Load complete state from database to ensure perfect synchronization
      const loadSuccess = await this.loadObjects();
      if (loadSuccess) {
        console.log(
          `Full synchronization complete. Player units: ${this.objects.length}, Enemy units: ${this.enemyObjects.length}`
        );

        // Update grid with all objects
        this.updateGridWithAllObjects();

        return true;
      }
    }
    return false;
  }

  // Full synchronization (used for testing or manual sync)
  async fullSynchronizeObjects() {
    const saveSuccess = await this.saveObjects();
    if (saveSuccess) {
      return await this.loadObjects();
    }
    return false;
  }

  // Update grid with both player and enemy objects
  updateGridWithAllObjects() {
    // Create temporary object manager with all objects
    const tempObjectManager = {
      objects: [...this.objects, ...this.enemyObjects],
    };

    this.gridManager.updateGridObjects(tempObjectManager);
  }
}
