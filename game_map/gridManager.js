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
}
