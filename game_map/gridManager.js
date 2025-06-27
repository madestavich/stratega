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
    for (const gameObject of objectManager.objects) {
      // Пропускаємо мертві об'єкти при оновленні сітки
      if (gameObject.isDead) continue;

      this.occupyGridCells(gameObject);
    }
  }

  occupyGridCells(gameObject) {
    // Mark all cells that this object occupies as occupied
    if (!this.grid) return;

    const { gridCol, gridRow, gridWidth, gridHeight, expansionDirection } =
      gameObject;

    let startCol = gridCol;
    let startRow = gridRow;

    // Adjust start position based on expansion direction
    switch (expansionDirection) {
      case "topLeft":
        startCol = gridCol - (gridWidth - 1);
        startRow = gridRow - (gridHeight - 1);
        break;
      case "topRight":
        startRow = gridRow - (gridHeight - 1);
        break;
      case "bottomLeft":
        startCol = gridCol - (gridWidth - 1);
        break;
      case "bottomRight":
      default:
        // No adjustment needed
        break;
    }

    // Mark cells as occupied
    for (let row = startRow; row < startRow + gridHeight; row++) {
      for (let col = startCol; col < startCol + gridWidth; col++) {
        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
          this.grid[row][col].occupied = true;
        }
      }
    }
  }

  canPlaceAt(gameObject, gridCol, gridRow) {
    const { gridWidth, gridHeight, expansionDirection } = gameObject;

    let startCol = gridCol;
    let startRow = gridRow;

    // Adjust start position based on expansion direction
    switch (expansionDirection) {
      case "topLeft":
        startCol = gridCol - (gridWidth - 1);
        startRow = gridRow - (gridHeight - 1);
        break;
      case "topRight":
        startRow = gridRow - (gridHeight - 1);
        break;
      case "bottomLeft":
        startCol = gridCol - (gridWidth - 1);
        break;
      case "bottomRight":
      default:
        // No adjustment needed
        break;
    }

    // Check if all needed cells are available
    for (let row = startRow; row < startRow + gridHeight; row++) {
      for (let col = startCol; col < startCol + gridWidth; col++) {
        if (
          row < 0 ||
          row >= this.rows ||
          col < 0 ||
          col >= this.cols ||
          this.grid[row][col].occupied
        ) {
          return false;
        }
      }
    }

    return true;
  }

  updateObjectGridPosition(gameObject) {
    const { cellWidth, cellHeight } = this;

    // Calculate the grid position based on pixel coordinates
    let baseCol, baseRow;

    // Calculate the base col and row (top-left corner of the object)
    baseCol = Math.round(gameObject.x / cellWidth - gameObject.gridWidth / 2);
    baseRow = Math.round(gameObject.y / cellHeight - gameObject.gridHeight / 2);

    // Adjust based on expansion direction
    switch (gameObject.expansionDirection) {
      case "topLeft":
        // For topLeft, the object expands to the left and up from the base point
        baseCol =
          Math.round(gameObject.x / cellWidth + gameObject.gridWidth / 2) -
          gameObject.gridWidth;
        baseRow =
          Math.round(gameObject.y / cellHeight + gameObject.gridHeight / 2) -
          gameObject.gridHeight;
        break;
      case "topRight":
        // For topRight, the object expands up from the base point
        baseRow =
          Math.round(gameObject.y / cellHeight + gameObject.gridHeight / 2) -
          gameObject.gridHeight;
        break;
      case "bottomLeft":
        // For bottomLeft, the object expands to the left from the base point
        baseCol =
          Math.round(gameObject.x / cellWidth + gameObject.gridWidth / 2) -
          gameObject.gridWidth;
        break;
      case "bottomRight":
      default:
        // This is already handled by the default calculation
        break;
    }

    // Calculate the grid position for the reference cell based on expansion direction
    switch (gameObject.expansionDirection) {
      case "topLeft":
        gameObject.gridCol = baseCol + (gameObject.gridWidth - 1);
        gameObject.gridRow = baseRow + (gameObject.gridHeight - 1);
        break;
      case "topRight":
        gameObject.gridCol = baseCol;
        gameObject.gridRow = baseRow + (gameObject.gridHeight - 1);
        break;
      case "bottomLeft":
        gameObject.gridCol = baseCol + (gameObject.gridWidth - 1);
        gameObject.gridRow = baseRow;
        break;
      case "bottomRight":
      default:
        gameObject.gridCol = baseCol;
        gameObject.gridRow = baseRow;
        break;
    }

    // Make sure the object is within grid boundaries
    gameObject.gridCol = Math.max(
      0,
      Math.min(this.cols - 1, gameObject.gridCol)
    );
    gameObject.gridRow = Math.max(
      0,
      Math.min(this.rows - 1, gameObject.gridRow)
    );

    // Re-occupy the grid cells with the new position
    this.occupyGridCells(gameObject);

    return { col: gameObject.gridCol, row: gameObject.gridRow };
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

  // Improved getGridCellFromPixel method with better debugging
  getGridCellFromPixel(pixelX, pixelY) {
    // Check if the coordinates are within the canvas bounds
    if (
      pixelX < 0 ||
      pixelX >= this.pixelWidth ||
      pixelY < 0 ||
      pixelY >= this.pixelHeight
    ) {
      return null;
    }

    // Convert pixel coordinates to grid coordinates
    const col = Math.floor(pixelX / this.cellWidth);
    const row = Math.floor(pixelY / this.cellHeight);

    // Ensure the coordinates are within the grid bounds
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      return { col, row };
    }

    return null;
  }

  // Check if a unit can be placed at the specified position
  canPlaceUnitAt(
    col,
    row,
    gridWidth,
    gridHeight,
    expansionDirection = "bottomRight"
  ) {
    // Create a temporary game object with the necessary properties
    const tempObject = {
      gridCol: col,
      gridRow: row,
      gridWidth: gridWidth,
      gridHeight: gridHeight,
      expansionDirection: expansionDirection,
    };

    // Use the existing canPlaceAt method which already handles unit dimensions and expansion direction
    return this.canPlaceAt(tempObject, col, row);
  }
}
