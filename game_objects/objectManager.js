import { GameObject } from "../import.js";

export class ObjectManager {
  constructor(ctx, gridManager) {
    this.ctx = ctx;
    this.gridManager = gridManager;
    this.objects = [];
    this.particles = [];
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

  fillArea(spriteConfig, objectConfig, startCol, startRow, endCol, endRow) {
    // Ensure start coordinates are less than end coordinates
    if (startCol > endCol) [startCol, endCol] = [endCol, startCol];
    if (startRow > endRow) [startRow, endRow] = [endRow, startRow];

    const gridWidth = objectConfig.gridWidth || 1;
    const gridHeight = objectConfig.gridHeight || 1;

    const createdObjects = [];

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
            const obj = this.createObject(spriteConfig, objectConfig, col, row);
            createdObjects.push(obj);
          }
        }
      }
    }

    return createdObjects;
  }

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
