export class GridManager {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.pixelWidth = config.pixelWidth;
    this.pixelHeight = config.pixelHeight;
    this.rows = config.rows;
    this.cols = config.cols;
    this.cellWidth = this.pixelWidth / this.cols;
    this.cellHeight = this.pixelHeight / this.rows;

    this.grid = this.createEmptyGrid();
  }

  createEmptyGrid() {
    const grid = [];
    for (let y = 0; y < this.rows; y++) {
      const row = new Array(this.cols).fill(0);
      grid.push(row);
    }
    return grid;
  }

  updateSize(pixelWidth, pixelHeight) {
    this.pixelWidth = pixelWidth;
    this.pixelHeight = pixelHeight;
    this.cellWidth = this.pixelWidth / this.cols;
    this.cellHeight = this.pixelHeight / this.rows;
  }

  updateGridObjects(objectManager) {
    // Clear the grid first
    this.grid = this.createEmptyGrid();

    // Iterate over each object and mark its position in the grid
    for (const obj of objectManager.objects) {
      const gridX = Math.floor(obj.x / this.cellWidth);
      const gridY = Math.floor(obj.y / this.cellHeight);

      if (gridX >= 0 && gridX < this.cols && gridY >= 0 && gridY < this.rows) {
        this.grid[gridY][gridX] = 1; // Mark the cell as occupied
      }
    }
  }

  debugDrawGrid() {
    this.ctx.strokeStyle = "#888";
    this.ctx.lineWidth = 0.5;

    for (let x = 0; x <= this.cols; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * this.cellWidth, 0);
      this.ctx.lineTo(x * this.cellWidth, this.pixelHeight);
      this.ctx.stroke();
    }

    for (let y = 0; y <= this.rows; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * this.cellHeight);
      this.ctx.lineTo(this.pixelWidth, y * this.cellHeight);
      this.ctx.stroke();
    }
  }

  debugColorOccupiedCells() {
    this.ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; // Semi-transparent red

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[y][x] === 1) {
          this.ctx.fillRect(
            x * this.cellWidth,
            y * this.cellHeight,
            this.cellWidth,
            this.cellHeight
          );
        }
      }
    }
  }
}
