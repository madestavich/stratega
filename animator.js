export class Animator {
  constructor(config) {
    this.spritesheets = {};
    this.loadSpritesheets(config.spritesheets);
  }

  loadSpritesheets(spritesheetsConfig) {
    for (const [key, sheet] of Object.entries(spritesheetsConfig)) {
      const image = new Image();
      image.src = sheet.sourceImage.link;
      this.spritesheets[key] = {
        image,
        width: sheet.sourceImage.width,
        height: sheet.sourceImage.height,
        animations: sheet.animations,
      };
    }
  }
}

export class SpriteAnimator {
  constructor(animator, spritesheetKey, animationKey, frameTime = 100) {
    this.animator = animator;
    this.spritesheetKey = spritesheetKey;
    this.animationKey = animationKey;
    this.frameTime = frameTime;
    this.currentTime = 0;
    this.currentFrameIndex = 0;
  }

  update(deltaTime) {
    this.currentTime += deltaTime;
    const frames = this.getFrames();
    if (this.currentTime >= this.frameTime) {
      this.currentFrameIndex = (this.currentFrameIndex + 1) % frames.length;
      this.currentTime = 0;
    }
  }

  getFrames() {
    return (
      this.animator.spritesheets[this.spritesheetKey]?.animations[
        this.animationKey
      ]?.frames || []
    );
  }

  draw(ctx, x, y) {
    const sheet = this.animator.spritesheets[this.spritesheetKey];
    const frames = this.getFrames();
    if (!sheet || frames.length === 0) return;

    const frame = frames[this.currentFrameIndex];
    ctx.drawImage(
      sheet.image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      x - frame.frameCenter.x,
      y - frame.frameCenter.y,
      frame.width,
      frame.height
    );
  }

  setAnimation(newAnimationKey) {
    if (this.animationKey !== newAnimationKey) {
      this.animationKey = newAnimationKey;
      this.currentFrameIndex = 0;
      this.currentTime = 0;
    }
  }
}
