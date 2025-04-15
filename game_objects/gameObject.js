import { Animator } from "./animator.js";
import { Renderer } from "./renderer.js";

export class GameObject {
  constructor(ctx, spriteConfig, unitConfig, gridCol, gridRow, gridManager) {
    this.ctx = ctx;
    this.spriteConfig = spriteConfig;
    this.unitConfig = unitConfig;
    this.gridCol = gridCol;
    this.gridRow = gridRow;
    this.gridManager = gridManager;
    this.x = undefined;
    this.y = undefined;
    this.z = undefined;

    // Extract size and expansion parameters from unitConfig
    this.gridWidth = unitConfig.gridWidth || 1;
    this.gridHeight = unitConfig.gridHeight || 1;
    this.expansionDirection = unitConfig.expansionDirection || "bottomRight";

    // Initialize x, y and z based on grid coordinates
    this.updatePositionFromGrid();
    // Mark occupied cells in the grid
    this.occupyGridCells();

    const defaultId = Object.keys(spriteConfig)[0];

    this.animator = new Animator(spriteConfig);
    this.animator.setSpritesheet(defaultId);

    const defaultAnim = Object.keys(spriteConfig[defaultId].animations)[0];
    this.animator.setAnimation(defaultAnim, true, defaultAnim);

    this.renderer = new Renderer(ctx, this.animator);
  }

  update() {
    if (!this.animator.hasFinished) {
      this.animator.nextFrame();
    }
    this.updatePositionFromGrid();
  }

  render() {
    // Retrieve the current frame's dimensions and center offsets
    const currentFrame = this.animator.activeFrame;
    const offsetX = currentFrame.frameCenter.x - currentFrame.x;
    const offsetY = currentFrame.frameCenter.y - currentFrame.y;

    // Adjust the drawing position by the calculated offsets
    this.renderer.draw(this.x - offsetX, this.y - offsetY);
  }

  updatePositionFromGrid() {
    const { cellWidth, cellHeight } = this.gridManager;

    // Calculate anchor position based on expansion direction
    let anchorCol = this.gridCol;
    let anchorRow = this.gridRow;

    switch (this.expansionDirection) {
      case "topLeft":
        // Base cell is at bottom-right
        anchorCol = this.gridCol - (this.gridWidth - 1);
        anchorRow = this.gridRow - (this.gridHeight - 1);
        break;
      case "topRight":
        // Base cell is at bottom-left
        anchorRow = this.gridRow - (this.gridHeight - 1);
        break;
      case "bottomLeft":
        // Base cell is at top-right
        anchorCol = this.gridCol - (this.gridWidth - 1);
        break;
      case "bottomRight":
      default:
        // Base cell is at top-left (default)
        break;
    }

    // Calculate center point of the entire object
    this.x = (anchorCol + this.gridWidth / 2) * cellWidth;
    this.y = (anchorRow + this.gridHeight / 2) * cellHeight;
    this.updateZCoordinate();
  }

  updateZCoordinate() {
    // Make z always equal to y
    this.z = this.y;
    return this.z;
  }

  occupyGridCells() {
    // Mark all cells that this object occupies as occupied
    if (!this.gridManager || !this.gridManager.grid) return;

    let startCol = this.gridCol;
    let startRow = this.gridRow;

    // Adjust start position based on expansion direction
    switch (this.expansionDirection) {
      case "topLeft":
        startCol = this.gridCol - (this.gridWidth - 1);
        startRow = this.gridRow - (this.gridHeight - 1);
        break;
      case "topRight":
        startRow = this.gridRow - (this.gridHeight - 1);
        break;
      case "bottomLeft":
        startCol = this.gridCol - (this.gridWidth - 1);
        break;
      case "bottomRight":
      default:
        // No adjustment needed
        break;
    }

    // Mark cells as occupied
    for (let row = startRow; row < startRow + this.gridHeight; row++) {
      for (let col = startCol; col < startCol + this.gridWidth; col++) {
        if (
          row >= 0 &&
          row < this.gridManager.rows &&
          col >= 0 &&
          col < this.gridManager.cols
        ) {
          this.gridManager.grid[row][col].occupied = true;
        }
      }
    }
  }

  canPlaceAt(gridCol, gridRow) {
    let startCol = gridCol;
    let startRow = gridRow;

    // Adjust start position based on expansion direction
    switch (this.expansionDirection) {
      case "topLeft":
        startCol = gridCol - (this.gridWidth - 1);
        startRow = gridRow - (this.gridHeight - 1);
        break;
      case "topRight":
        startRow = gridRow - (this.gridHeight - 1);
        break;
      case "bottomLeft":
        startCol = gridCol - (this.gridWidth - 1);
        break;
      case "bottomRight":
      default:
        // No adjustment needed
        break;
    }

    // Check if all needed cells are available
    for (let row = startRow; row < startRow + this.gridHeight; row++) {
      for (let col = startCol; col < startCol + this.gridWidth; col++) {
        if (
          row < 0 ||
          row >= this.gridManager.rows ||
          col < 0 ||
          col >= this.gridManager.cols ||
          this.gridManager.grid[row][col].occupied
        ) {
          return false;
        }
      }
    }

    return true;
  }
}
