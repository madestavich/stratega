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
    }
  }

  updateAll(dt) {
    for (const obj of this.objects) obj.update();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.update(dt);
      particle.checkCollision(this.objects);
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
      
      if (result.success) {
        return {
          roomId: result.room_id,
          isCreator: result.is_creator
        };
      } else {
        console.error('Failed to get current room:', result.message);
        return null;
      }
    } catch (error) {
      console.error('Error getting current room:', error);
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
        console.log(`Auto-detected room ID: ${roomId} (${roomInfo.isCreator ? 'creator' : 'player 2'})`);
      } else {
        console.error('Could not determine current room ID');
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

      // Update grid with loaded objects
      this.gridManager.updateGridObjects(this);

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

  // Save objects to server
  async saveObjects() {
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
        credentials: 'include',
        body: JSON.stringify({
          action: "save_objects",
          room_id: this.currentRoomId,
          objects: this.objects,
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
        credentials: 'include',
        body: JSON.stringify({
          action: "load_objects",
          room_id: this.currentRoomId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Simply assign the loaded objects
        this.objects = result.player_objects || [];
        this.enemyObjects = result.enemy_objects || [];

        console.log("Objects loaded successfully");
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

  // Synchronize objects after turn (save current state, then load enemy updates)
  async synchronizeAfterTurn() {
    console.log(`Saving ${this.objects.length} player units...`);

    const saveSuccess = await this.saveObjects();
    if (saveSuccess) {
      // Only reload enemy objects, keep our own units
      const oldPlayerObjects = [...this.objects];

      const loadSuccess = await this.loadObjects();
      if (loadSuccess) {
        // Restore our player objects (they shouldn't change)
        this.objects = oldPlayerObjects;

        console.log(
          `Synchronization complete. Player units: ${this.objects.length}, Enemy units: ${this.enemyObjects.length}`
        );

        // Update grid with all objects
        this.gridManager.updateGridObjects(this);

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
}
