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
    const sortedObjects = [...this.objects].sort((a, b) => a.z - b.z);
    for (const obj of sortedObjects) obj.render();
    for (const particle of this.particles) particle.draw();
  }
}
