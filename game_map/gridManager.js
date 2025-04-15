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
    this.createCellCoordinatesGrid();
  }

  createEmptyGrid() {
    const grid = [];
    for (let y = 0; y < this.rows; y++) {
      const row = [];
      for (let x = 0; x < this.cols; x++) {
        row.push({
          occupied: false,
          coordinates: null,
        });
      }
      grid.push(row);
    }
    return grid;
  }

  // Modified method to fill coordinates in the existing grid cells
  createCellCoordinatesGrid() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        // Calculate center-bottom point of each cell
        const centerX = x * this.cellWidth + this.cellWidth / 2;
        const bottomY = (y + 1) * this.cellHeight;

        // Set coordinates to the existing cell object
        this.grid[y][x].coordinates = { x: centerX, y: bottomY };
      }
    }
  }

  updateGridObjects(objectManager) {
    // Clear the occupancy status of all cells
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.grid[y][x].occupied = false;
      }
    }

    // Iterate over each object and mark its position in the grid
    for (const obj of objectManager.objects) {
      // Use the object's grid row and column indices
      const gridX = obj.gridCol;
      const gridY = obj.gridRow;

      if (gridX >= 0 && gridX < this.cols && gridY >= 0 && gridY < this.rows) {
        this.grid[gridY][gridX].occupied = true;
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
        if (this.grid[y][x].occupied) {
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
