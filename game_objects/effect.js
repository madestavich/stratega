import { Animator } from "../import.js";
import { Renderer } from "../import.js";

export class Effect {
  constructor(ctx, spriteConfig, effectConfig) {
    this.ctx = ctx;
    this.spriteConfig = spriteConfig;

    // Прив'язка до юніта (опціонально)
    this.targetUnit = effectConfig.targetUnit || null;
    this.attachmentPoint = effectConfig.attachmentPoint || "center"; // 'center', 'bottom', 'top'

    // Позиція (використовується якщо немає targetUnit)
    this.x = effectConfig.x || 0;
    this.y = effectConfig.y || 0;
    this.z = effectConfig.z || 0;

    // Z-layer стратегія
    this.zMode = effectConfig.zMode || "over"; // 'under', 'over', 'top'
    this.zOffset = effectConfig.zOffset || 0; // Додатковий офсет для fine-tuning

    // Lifecycle
    this.triggerPhase = effectConfig.triggerPhase || "start"; // 'start', 'progress', 'end'
    this.duration = effectConfig.duration || null; // null = грає поки не закінчиться анімація
    this.autoRemove =
      effectConfig.autoRemove !== undefined ? effectConfig.autoRemove : true;
    this.loop = effectConfig.loop !== undefined ? effectConfig.loop : false;

    // Час життя
    this.timeAlive = 0;
    this.isFinished = false;

    // Offset від точки прив'язки (для fine-tuning позиції)
    this.offsetX = effectConfig.offsetX || 0;
    this.offsetY = effectConfig.offsetY || 0;

    // Анімація для ефекту (можна вказати конкретну, інакше перша)
    this.animationName = effectConfig.animationName || null;

    // Ініціалізація аніматора
    this.animator = new Animator(this.spriteConfig);

    // Встановлюємо спрайтшит (перший доступний ключ)
    const defaultSpritesheetId = Object.keys(spriteConfig)[0];
    this.animator.setSpritesheet(defaultSpritesheetId);

    // Встановлюємо анімацію
    const animToUse =
      this.animationName ||
      Object.keys(spriteConfig[defaultSpritesheetId].animations)[0];
    this.animator.setAnimation(animToUse, this.loop);

    // Ініціалізація рендерера
    this.renderer = new Renderer(ctx, this.animator);

    // Оновлюємо позицію
    this.updatePosition();
  }

  update(deltaTime) {
    // Оновлюємо час життя
    this.timeAlive += deltaTime;

    // Перевіряємо чи закінчився час життя
    if (this.duration !== null && this.timeAlive >= this.duration) {
      this.isFinished = true;
      return;
    }

    // Оновлюємо анімацію
    if (!this.animator.hasFinished) {
      this.animator.nextFrame();
    } else if (!this.loop && this.autoRemove) {
      // Анімація закінчилась і не loop - помічаємо як finished
      this.isFinished = true;
      return;
    }

    // Оновлюємо позицію (якщо прив'язаний до юніта)
    this.updatePosition();
  }

  updatePosition() {
    // Якщо ефект прив'язаний до юніта
    if (this.targetUnit) {
      const currentFrame = this.targetUnit.animator.activeFrame;

      // Базова позиція по X
      this.x = this.targetUnit.x + this.offsetX;

      // Обчислюємо offsetY в залежності від типу
      let calculatedOffsetY = this.offsetY;

      // Якщо offsetY - це строка (top/center/bottom), розраховуємо числове значення
      if (typeof this.offsetY === "string") {
        switch (this.offsetY) {
          case "top":
            // Верх кадру юніта = frameCenter (низ) мінус висота кадру
            calculatedOffsetY = -currentFrame.height;
            break;
          case "bottom":
            // Низ кадру юніта = frameCenter (це вже низ)
            calculatedOffsetY = 0;
            break;
          case "center":
          default:
            // Центр кадру юніта = frameCenter (низ) мінус половина висоти
            calculatedOffsetY = -(currentFrame.height / 2);
            break;
        }
      }

      // Обчислюємо позицію відносно поточного кадру юніта
      switch (this.attachmentPoint) {
        case "center":
          this.y = this.targetUnit.y + calculatedOffsetY;
          break;

        case "bottom":
          // Низ спрайта = y юніта + половина висоти кадру
          this.y =
            this.targetUnit.y +
            currentFrame.height / 2 -
            (currentFrame.frameCenter.y - currentFrame.y) +
            calculatedOffsetY;
          break;

        case "top":
          // Верх спрайта = y юніта - половина висоти кадру
          this.y =
            this.targetUnit.y -
            currentFrame.height / 2 +
            (currentFrame.frameCenter.y - currentFrame.y) +
            calculatedOffsetY;
          break;
      }

      // Оновлюємо Z відносно юніта
      this.updateZFromTarget();
    }
  }

  updateZFromTarget() {
    if (!this.targetUnit) {
      return;
    }

    switch (this.zMode) {
      case "under":
        // Під юнітом
        this.z = this.targetUnit.z - 1 + this.zOffset;
        break;

      case "over":
        // Над юнітом
        this.z = this.targetUnit.z + 1 + this.zOffset;
        break;

      case "top":
        // Топ-рівень сцени (дуже велике число)
        this.z = 999999 + this.zOffset;
        break;
    }
  }

  render() {
    // Отримуємо поточний кадр
    const currentFrame = this.animator.activeFrame;

    // Обчислюємо офсети для центрування
    const offsetX = currentFrame.frameCenter.x - currentFrame.x;
    const offsetY = currentFrame.frameCenter.y - currentFrame.y;

    // Встановлюємо прозорість 50%
    this.ctx.save();
    this.ctx.globalAlpha = 0.5;

    // Рендеримо ефект (без direction, тому що ефекти зазвичай не флипаються)
    this.renderer.draw(this.x - offsetX, this.y - offsetY, null);

    this.ctx.restore();

    // Debug відображення (якщо увімкнено)
    if (
      window.gameManager &&
      window.gameManager.debugManager &&
      window.gameManager.debugManager.isLayerEnabled("unitFrames")
    ) {
      this.renderDebug(offsetX, offsetY);
    }
  }

  renderDebug(offsetX, offsetY) {
    const currentFrame = this.animator.activeFrame;

    this.ctx.save();

    // Рамка ефекту (фіолетова)
    this.ctx.strokeStyle = "rgba(255, 0, 255, 0.7)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      this.x - offsetX,
      this.y - offsetY,
      currentFrame.width,
      currentFrame.height
    );

    // Центр ефекту (жовта точка)
    this.ctx.fillStyle = "rgba(255, 255, 0, 0.8)";
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, 5, 0, 2 * Math.PI);
    this.ctx.fill();

    // Лінія до target юніта (якщо є)
    if (this.targetUnit) {
      this.ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([5, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(this.x, this.y);
      this.ctx.lineTo(this.targetUnit.x, this.targetUnit.y);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // Текст з інформацією
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    this.ctx.font = "10px monospace";
    this.ctx.fillText(
      `z:${Math.round(this.z)} ${this.zMode}`,
      this.x - offsetX + 5,
      this.y - offsetY + 15
    );

    this.ctx.restore();
  }
}
