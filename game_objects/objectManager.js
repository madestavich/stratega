import { GameObject } from "../import.js";

export class ObjectManager {
  constructor(ctx, gridManager, configLoader, spriteLoader) {
    this.ctx = ctx;
    this.gridManager = gridManager;
    this.configLoader = configLoader;
    this.spriteLoader = spriteLoader;
    this.objects = [];
    this.particles = [];
  }

  async createObject(objectType, objectConfig, gridCol, gridRow) {
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

  async fillArea(objectType, objectConfig, startCol, startRow, endCol, endRow) {
    // Ensure start coordinates are less than end coordinates
    if (startCol > endCol) [startCol, endCol] = [endCol, startCol];
    if (startRow > endRow) [startRow, endRow] = [endRow, startRow];

    const gridWidth = objectConfig.gridWidth || 1;
    const gridHeight = objectConfig.gridHeight || 1;

    const createdObjects = [];

    // Завантажуємо спрайт, якщо потрібно
    await this.spriteLoader.loadSprites(objectType);

    // Отримуємо конфігурацію спрайту
    const spriteConfig = this.configLoader.getConfig(objectType);

    if (!spriteConfig) {
      console.error(`Sprite config for "${objectType}" not found`);
      return [];
    }

    // Fill the area from top to bottom, left to right
    for (let row = startRow; row <= endRow; row += gridHeight) {
      for (let col = startCol; col <= endCol; col += gridWidth) {
        // Check if the object would fit within the specified area
        if (col + gridWidth - 1 <= endCol && row + gridHeight - 1 <= endRow) {
          // Check if the cells are not already occupied
          let canPlace = true;
          for (let r = 0; r < gridHeight; r++) {
            for (let c = 0; c < gridWidth; c++) {
              const checkRow = row + r;
              const checkCol = col + c;

              // Skip if out of bounds
              if (
                checkCol < 0 ||
                checkCol >= this.gridManager.cols ||
                checkRow < 0 ||
                checkRow >= this.gridManager.rows ||
                this.gridManager.grid[checkRow][checkCol].occupied
              ) {
                canPlace = false;
                break;
              }
            }
            if (!canPlace) break;
          }

          if (canPlace) {
            const obj = new GameObject(
              this.ctx,
              spriteConfig,
              objectConfig,
              col,
              row,
              this.gridManager
            );
            this.objects.push(obj);
            createdObjects.push(obj);
          }
        }
      }
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
    const sortedObjects = [...this.objects].sort((a, b) => a.z - b.z);
    for (const obj of sortedObjects) obj.render();
    for (const particle of this.particles) particle.draw();
  }
}
