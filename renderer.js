export class Renderer {
  constructor(ctx, animator) {
    this.ctx = ctx;
    this.animator = animator;
  }

  draw(x, y) {
    const f = this.animator.activeFrame;
    this.ctx.drawImage(
      this.animator.activeSpritesheet.sourceImage.link,
      f.x,
      f.y,
      f.width,
      f.height,
      x,
      y,
      f.width,
      f.height
    );
  }
}
