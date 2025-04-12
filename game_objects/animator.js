export class Animator {
  constructor(config) {
    this.config = config;
    this.activeSpritesheet = null;
    this.activeAnimation = null;
    this.activeFrame = null;
    this.isLooping = false;
    this.frameIndex = 0;
    this.hasFinished = false;
    this.defaultAnimation = null; // Додаємо параметр для дефолтної анімації
  }

  setSpritesheet(spritesheet) {
    this.activeSpritesheet = this.config[spritesheet];
  }

  // Встановлення анімації і параметра loop
  setAnimation(animation, isLooping = false, defaultAnimation = null) {
    this.activeAnimation = this.activeSpritesheet.animations[animation];
    this.isLooping = isLooping;
    this.frameIndex = 0;
    this.setFrame();
    this.hasFinished = false;
    this.defaultAnimation = defaultAnimation; // Записуємо дефолтну анімацію
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
    } else {
      this.hasFinished = true;
      if (this.defaultAnimation) {
        // Якщо є дефолтна анімація, то встановлюємо її
        this.setAnimation(this.defaultAnimation, false); // Без loop для дефолтної анімації
      }
    }
    this.setFrame();
  }
}
