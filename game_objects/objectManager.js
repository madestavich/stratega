import { GameObject } from "../import.js";

export class ObjectManager {
  constructor(ctx, gridManager) {
    this.ctx = ctx;
    this.gridManager = gridManager;
    this.objects = [];
  }

  createObject(spriteConfig, objectConfig, gridCol, gridRow) {
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

  createMultiple(spriteConfig, objectConfig, count, positions) {
    for (let i = 0; i < count; i++) {
      const { col, row } = positions[i];
      this.createObject(spriteConfig, objectConfig, col, row);
    }
  }

  removeObject(object) {
    const index = this.objects.indexOf(object);
    if (index !== -1) {
      this.objects.splice(index, 1);
      // Update the grid to reflect that cells are no longer occupied by this object
      this.gridManager.updateGridObjects(this);
    }
  }

  updateAll() {
    for (const obj of this.objects) obj.update();
  }

  renderAll() {
    // Сортуємо об'єкти за Z-координатою перед відображенням
    const sortedObjects = [...this.objects].sort((a, b) => a.z - b.z);
    for (const obj of sortedObjects) obj.render();
  }
}
