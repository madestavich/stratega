export class Renderer {
  constructor(ctx, animator) {
    this.ctx = ctx;
    this.animator = animator;
  }

  draw(x, y, direction = null) {
    const f = this.animator.activeFrame;

    // Зберігаємо поточний стан контексту
    this.ctx.save();

    // Визначаємо напрямок відображення (може бути moveDirection або lookDirection)
    const flipHorizontal = direction && direction.dx < 0;

    // Переміщуємо точку відліку до центру кадру
    const centerOffsetX = f.frameCenter.x - f.x;
    const centerOffsetY = f.frameCenter.y - f.y;

    // Переміщуємо контекст до позиції об'єкта
    this.ctx.translate(x + centerOffsetX, y + centerOffsetY);

    // Застосовуємо дзеркальне відображення, якщо потрібно
    if (flipHorizontal) {
      this.ctx.scale(-1, 1);
    }

    // Малюємо зображення, центроване відносно точки відліку
    this.ctx.drawImage(
      this.animator.activeSpritesheet.sourceImage.link,
      f.x,
      f.y,
      f.width,
      f.height,
      -centerOffsetX,
      -centerOffsetY,
      f.width,
      f.height
    );

    // Відновлюємо попередній стан контексту
    this.ctx.restore();
  }
}
