import { GameObject } from "./gameObject.js";

export class ObjectManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.objects = [];
  }

  createObject(config, x, y) {
    const obj = new GameObject(this.ctx, config, x, y);
    this.objects.push(obj);
    return obj;
  }

  createMultiple(config, count, positions) {
    for (let i = 0; i < count; i++) {
      const { x, y } = positions[i] || { x: 0, y: 0 };
      this.createObject(config, x, y);
    }
  }

  updateAll() {
    for (const obj of this.objects) obj.update();
  }

  renderAll() {
    for (const obj of this.objects) obj.render();
  }
}
