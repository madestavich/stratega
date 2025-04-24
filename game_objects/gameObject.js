import { Animator } from "../import.js";
import { Renderer } from "../import.js";

export class GameObject {
  constructor(ctx, spriteConfig, objectConfig, gridCol, gridRow, gridManager) {
    this.ctx = ctx;
    this.spriteConfig = spriteConfig;
    this.objectConfig = objectConfig;
    this.gridCol = gridCol;
    this.gridRow = gridRow;
    this.gridManager = gridManager;
    this.x = undefined;
    this.y = undefined;
    this.z = undefined;
    this.objectType = objectConfig.objectType || "default"; // Тип об'єкта
    this.actionPriorities = objectConfig.actionPriorities || []; // Масив типів дій у порядку пріоритету
    this.canAct = true; // Чи може об'єкт виконувати дії
    this.isMoving = false; // Чи об'єкт рухається
    this.moveDirection = null; // Напрямок руху
    this.moveTarget = null; // Ціль для руху
    this.moveSpeed = objectConfig.moveSpeed || 1; // Швидкість руху

    // Extract size and expansion parameters from objectConfig
    this.gridWidth = objectConfig.gridWidth || 1;
    this.gridHeight = objectConfig.gridHeight || 1;
    this.expansionDirection = objectConfig.expansionDirection || "bottomRight";

    // Initialize x, y and z based on grid coordinates
    this.updatePositionFromGrid();

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

    // Only update from grid when not moving
    if (!this.isMoving) {
      this.updatePositionFromGrid();
    } else {
      this.updateZCoordinate();
    }
  }

  render() {
    // Retrieve the current frame's dimensions and center offsets
    const currentFrame = this.animator.activeFrame;
    const offsetX = currentFrame.frameCenter.x - currentFrame.x;
    const offsetY = currentFrame.frameCenter.y - currentFrame.y;

    // Adjust the drawing position by the calculated offsets
    this.renderer.draw(this.x - offsetX, this.y - offsetY);
  }

  // Only method needed for direct position control
  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.updateZCoordinate();
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
}
