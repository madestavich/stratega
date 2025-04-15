import { GameObject } from "./gameObject.js";

export class ObjectManager {
  constructor(ctx, gridManager) {
    this.ctx = ctx;
    this.gridManager = gridManager;
    this.objects = [];
  }

  createObject(spriteConfig, unitConfig, gridCol, gridRow) {
    const obj = new GameObject(
      this.ctx,
      spriteConfig,
      unitConfig,
      gridCol,
      gridRow,
      this.gridManager
    );
    this.objects.push(obj);
    return obj;
  }

  createMultiple(spriteConfig, unitConfig, count, positions) {
    for (let i = 0; i < count; i++) {
      const { col, row } = positions[i];
      this.createObject(spriteConfig, unitConfig, col, row);
    }
  }

  updateAll() {
    for (const obj of this.objects) obj.update();
  }

  renderAll() {
    for (const obj of this.objects) obj.render();
  }
}
