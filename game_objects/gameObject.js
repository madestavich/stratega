import { Animator } from "./animator.js";
import { Renderer } from "./renderer.js";

export class GameObject {
  constructor(ctx, config, gridCol, gridRow, gridManager) {
    this.ctx = ctx;
    this.config = config;
    this.gridCol = gridCol;
    this.gridRow = gridRow;
    this.gridManager = gridManager;
    this.x = undefined;
    this.y = undefined;

    // Initialize x and y based on grid coordinates
    this.updatePositionFromGrid();

    const defaultId = Object.keys(config)[0];

    this.animator = new Animator(config);
    this.animator.setSpritesheet(defaultId);

    const defaultAnim = Object.keys(config[defaultId].animations)[0];
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
    // Calculate pixel coordinates from grid coordinates
    this.x = this.gridCol * cellWidth + cellWidth / 2;
    this.y = this.gridRow * cellHeight + cellHeight / 2;
  }
}
