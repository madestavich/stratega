export class Renderer {
  constructor(ctx, animator) {
    this.ctx = ctx;
    this.animator = animator;
  }

  draw(x, y, moveDirection = null) {
    const f = this.animator.activeFrame;

    // Зберігаємо поточний стан контексту
    this.ctx.save();

    // Якщо рух вліво (dx < 0), застосовуємо дзеркальне відображення
    if (moveDirection && moveDirection.dx < 0) {
      // Переміщуємо точку відліку для правильного дзеркального відображення
      this.ctx.translate(x + f.width, y);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(
        this.animator.activeSpritesheet.sourceImage.link,
        f.x,
        f.y,
        f.width,
        f.height,
        0, // x тепер 0, оскільки ми перемістили точку відліку
        0, // y тепер 0, оскільки ми перемістили точку відліку
        f.width,
        f.height
      );
    } else {
      // Звичайне відображення без дзеркального ефекту
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

    // Відновлюємо попередній стан контексту
    this.ctx.restore();
  }
}
