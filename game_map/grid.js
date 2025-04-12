class Grid {
  constructor(width, height, cellSize) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.gridColor = "#333333";
  }

  draw(ctx) {
    ctx.strokeStyle = this.gridColor;
    ctx.lineWidth = 1;

    // Draw vertical lines
    for (let x = 0; x <= this.width; x += this.cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y <= this.height; y += this.cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
  }

  getCellCoordinates(x, y) {
    return {
      x: Math.floor(x / this.cellSize) * this.cellSize,
      y: Math.floor(y / this.cellSize) * this.cellSize,
    };
  }

  isWithinBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
}
