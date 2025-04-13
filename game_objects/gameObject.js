import { Animator } from "./animator.js";
import { Renderer } from "./renderer.js";

export class GameObject {
  constructor(ctx, config, x, y, gridManager) {
    this.ctx = ctx;
    this.config = config;
    this.x = x;
    this.y = y;
    this.gridManager = gridManager;

    const defaultId = Object.keys(config)[0];

    this.animator = new Animator(config);
    this.animator.setSpritesheet(defaultId);

    const defaultAnim = Object.keys(config[defaultId].animations)[0];
    this.animator.setAnimation(defaultAnim, true, defaultAnim);

    this.renderer = new Renderer(ctx, this.animator);

    // Initialize cellX and cellY
    this.cellX = undefined;
    this.cellY = undefined;
  }

  update() {
    if (!this.animator.hasFinished) {
      this.animator.nextFrame();
    }
    this.updateCellPosition();
  }

  render() {
    // Retrieve the current frame's dimensions and center offsets
    const currentFrame = this.animator.activeFrame;
    const offsetX = currentFrame.frameCenter.x - currentFrame.x;
    const offsetY = currentFrame.frameCenter.y - currentFrame.y;

    // Adjust the drawing position by the calculated offsets
    this.renderer.draw(this.cellX - offsetX, this.cellY - offsetY);
  }

  updateCellPosition() {
    const { cellWidth, cellHeight } = this.gridManager;
    this.cellX = Math.floor(this.x / cellWidth) * cellWidth + cellWidth / 2;
    this.cellY = Math.floor(this.y / cellHeight) * cellHeight + cellHeight / 2;
  }
}
