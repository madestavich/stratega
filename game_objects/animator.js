export class Animator {
  constructor(config) {
    this.config = config;
    this.activeSpritesheet = null;
    this.activeAnimation = null;
    this.activeFrame = null;
    this.isLooping = true;
    this.frameIndex = 0;
    this.hasFinished = false;
    this.defaultAnimation = "idle"; // Додаємо параметр для дефолтної анімації
  }

  setSpritesheet(spritesheet) {
    this.activeSpritesheet = this.config[spritesheet];
  }

  // Встановлення анімації і параметра loop
  setAnimation(
    animation,
    isLooping = true,
    defaultAnimation = this.defaultAnimation
  ) {
    // Якщо та сама анімація вже грає - не перезапускаємо її
    if (this.activeAnimation && this.activeAnimation.name === animation) {
      return;
    }

    this.hasFinished = false; // Явно скидаємо hasFinished на початку
    this.activeAnimation = this.activeSpritesheet.animations[animation];
    this.isLooping = isLooping;
    this.frameIndex = 0;
    this.setFrame();
    this.defaultAnimation = defaultAnimation;
  }

  // Встановлення кадру
  setFrame(frame = this.frameIndex) {
    this.activeFrame = this.activeAnimation.frames[frame];
  }

  // Перехід до наступного кадру
  nextFrame() {
    if (this.frameIndex < this.activeAnimation.frames.length - 1) {
      this.frameIndex++;
    } else if (this.isLooping) {
      this.frameIndex = 0;
      this.hasFinished = false;
    } else {
      this.hasFinished = true;
    }

    this.setFrame();
  }
}
