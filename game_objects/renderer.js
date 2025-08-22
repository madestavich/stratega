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

  drawDebugFrame(
    x,
    y,
    direction = null,
    bulletPointGlobal = null,
    lookDirection = null
  ) {
    const f = this.animator.activeFrame;
    this.ctx.save();
    const flipHorizontal = direction && direction.dx < 0;
    const centerOffsetX = f.frameCenter.x - f.x;
    const centerOffsetY = f.frameCenter.y - f.y;
    this.ctx.translate(x + centerOffsetX, y + centerOffsetY);
    if (flipHorizontal) {
      this.ctx.scale(-1, 1);
    }
    // Рамка кадру (зелена)
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(0,255,0,0.7)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(-centerOffsetX, -centerOffsetY, f.width, f.height);
    this.ctx.restore();
    // Центр кадру (синя)
    this.ctx.save();
    this.ctx.fillStyle = "rgba(0,0,255,0.8)";
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 6, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.restore();
    // BulletPoint (червона, локальна)
    if (f.bulletPoint) {
      let bpX = f.bulletPoint.x - f.frameCenter.x;
      let bpY = f.bulletPoint.y - f.frameCenter.y;
      if (flipHorizontal) bpX *= -1;
      this.ctx.save();
      this.ctx.fillStyle = "rgba(255,0,0,0.8)";
      this.ctx.beginPath();
      this.ctx.arc(bpX, bpY, 6, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.restore();
    }
    // BulletPoint (глобальна, якщо передано)
    if (bulletPointGlobal) {
      this.ctx.save();
      this.ctx.fillStyle = "rgba(255,0,0,0.4)";
      this.ctx.beginPath();
      this.ctx.arc(
        bulletPointGlobal.x - x,
        bulletPointGlobal.y - y,
        8,
        0,
        2 * Math.PI
      );
      this.ctx.fill();
      this.ctx.restore();
    }
    // Візуалізація напрямку погляду
    if (lookDirection && (lookDirection.dx !== 0 || lookDirection.dy !== 0)) {
      const lineEndX = 40 * lookDirection.dx;
      const lineEndY = 40 * lookDirection.dy;
      console.log(
        `DEBUG renderer drawDebugFrame: lookDirection=${JSON.stringify(
          lookDirection
        )}, drawing line from (0,0) to (${lineEndX},${lineEndY})`
      );
      this.ctx.save();
      this.ctx.strokeStyle = "rgba(255,165,0,0.9)";
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(lineEndX, lineEndY);
      this.ctx.stroke();
      this.ctx.restore();
    }
    this.ctx.restore();
  }
}
