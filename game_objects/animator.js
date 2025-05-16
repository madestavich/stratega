export class Animator {
  constructor(config) {
    this.config = config;
    this.activeSpritesheet = null;
    this.activeAnimation = null;
    this.activeFrame = null;
    this.isLooping = false;
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
      this.hasFinished = false;
    } else {
      // Встановлюємо hasFinished = true, але не змінюємо анімацію тут
      this.hasFinished = true;
      // Не встановлюємо defaultAnimation тут, це має робити клієнтський код
    }
    this.setFrame();
  }

  // Додати новий метод для явного переходу до дефолтної анімації
  switchToDefaultAnimation() {
    if (this.defaultAnimation && this.hasFinished) {
      this.setAnimation(this.defaultAnimation);
    }
  }
}
