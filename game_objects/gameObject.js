import { Animator } from "../import.js";
import { Renderer } from "../import.js";

export class GameObject {
  constructor(ctx, spriteConfig, objectConfig, gridCol, gridRow, gridManager) {
    this.ctx = ctx;
    this.spriteConfig = spriteConfig;
    this.gridCol = gridCol;
    this.gridRow = gridRow;
    this.gridManager = gridManager;
    this.x = undefined;
    this.y = undefined;
    this.z = undefined;
    this.objectType = objectConfig.objectType || "default"; // Тип об'єкта
    this.actionPriorities = objectConfig.actionPriorities || [];
    this.canAct = true; // Чи може об'єкт виконувати дії
    this.isMoving = false; // Чи об'єкт рухається
    this.moveDirection = null; // Напрямок руху
    this.moveTarget = null; // Ціль для руху
    // Встановлюємо коректний напрямок погляду одразу при створенні
    let initialLookDirection = null;
    // team 1 завжди вправо, team 2 завжди вліво
    if (objectConfig.team === 1) {
      initialLookDirection = { dx: 1, dy: 0 };
    } else if (objectConfig.team === 2) {
      initialLookDirection = { dx: -1, dy: 0 };
    }
    this.lookDirection = initialLookDirection; // Напрямок огляду
    this.moveSpeed = objectConfig.moveSpeed || 1; // Швидкість руху
    this.availableActions = objectConfig.availableActions || []; // Доступні дії
    this.team = objectConfig.team; // Команда об'єкта
    this.isAttacking = false; // Чи об'єкт атакує
    this.attackTarget = null; // Ціль для атаки
    this.attackRange = objectConfig.attackRange || 1; // Діапазон атаки
    this.attackDamage = objectConfig.attackDamage || 1; // Шкода атаки
    this.attackSpeed = objectConfig.attackSpeed || 1; // Швидкість атаки
    this.attackCooldown = 0; // Затримка між атаками
    this.health = objectConfig.health || 100; // Здоров'я об'єкта
    this.maxHealth = objectConfig.health || 100; // Максимальне здоров'я об'єкта
    this.isDead = false; // Чи об'єкт мертвий
    this.vampirism = objectConfig.vampirism || false; // Чи є вампіризм
    this.vampirismPercent = objectConfig.vampirismPercent || 0; // Відсоток вампіризму
    this.isRanged = objectConfig.isRanged || false;
    this.isRangedAttack = false; // Чи об'єкт атакує здалеку
    this.minRangeDistance = objectConfig.minRangeDistance || null;
    this.maxRangeDistance = objectConfig.maxRangeDistance || null;
    this.maxShots = objectConfig.maxShots || null; // Максимальна кількість пострілів
    this.remainingShots = this.maxShots; // Поточна кількість пострілів
    this.bulletConfig = objectConfig.bulletConfig || null; // Конфігурація кулі

    if (this.isRanged) {
      const lastFrame =
        spriteConfig[objectConfig.objectType].animations.range_attack.frames[
          spriteConfig[objectConfig.objectType].animations.range_attack.frames
            .length - 1
        ];

      this.bulletPoint = lastFrame.bulletPoint || { x: 0, y: 0 };
    }

    // Extract size and expansion parameters from objectConfig
    this.gridWidth = objectConfig.gridWidth || 1;
    this.gridHeight = objectConfig.gridHeight || 1;
    this.expansionDirection = objectConfig.expansionDirection || "bottomRight";

    const defaultSpritesheetId = Object.keys(spriteConfig)[0];

    this.animator = new Animator(spriteConfig);
    this.animator.setSpritesheet(defaultSpritesheetId);

    const defaultAnim = Object.keys(
      spriteConfig[defaultSpritesheetId].animations
    )[0];
    this.animator.setAnimation(defaultAnim);

    this.renderer = new Renderer(ctx, this.animator);

    this.updatePositionFromGrid();
  }

  update() {
    if (!this.animator.hasFinished) {
      this.animator.nextFrame();
    }
    this.updateZCoordinate();
  }

  render() {
    // Retrieve the current frame's dimensions and center offsets
    const currentFrame = this.animator.activeFrame;
    const offsetX = currentFrame.frameCenter.x - currentFrame.x;
    const offsetY = currentFrame.frameCenter.y - currentFrame.y;

    // Adjust the drawing position by the calculated offsets
    if (this.moveDirection) {
      this.renderer.draw(
        this.x - offsetX,
        this.y - offsetY,
        this.moveDirection
      );
      if (window.gameManager && window.gameManager.debugMode) {
        // Глобальна точка bulletPoint для debug
        let bulletPointGlobal = null;
        if (currentFrame.bulletPoint) {
          let bulletPointX = currentFrame.bulletPoint.x;
          if (this.isSpriteFlippedHorizontally()) {
            bulletPointX =
              currentFrame.frameCenter.x -
              (currentFrame.bulletPoint.x - currentFrame.frameCenter.x);
          }
          const bulletOffsetX = bulletPointX - currentFrame.frameCenter.x;
          const bulletOffsetY =
            currentFrame.bulletPoint.y - currentFrame.frameCenter.y;
          bulletPointGlobal = {
            x: this.x + bulletOffsetX,
            y: this.y + bulletOffsetY,
          };
        }
        this.renderer.drawDebugFrame(
          this.x - offsetX,
          this.y - offsetY,
          this.moveDirection,
          bulletPointGlobal,
          this.lookDirection
        );
        // Відображення кількості пострілів для ренджед юнітів
        if (this.isRanged && this.maxShots !== null) {
          this.ctx.save();
          this.ctx.fillStyle = this.remainingShots > 0 ? "yellow" : "red";
          this.ctx.strokeStyle = "black";
          this.ctx.lineWidth = 2;
          this.ctx.font = "bold 16px Arial";
          this.ctx.textAlign = "center";
          const text = `${this.remainingShots}/${this.maxShots}`;
          const textX = this.x;
          const textY = this.y - offsetY - currentFrame.height / 2 - 10;
          this.ctx.strokeText(text, textX, textY);
          this.ctx.fillText(text, textX, textY);
          this.ctx.restore();
        }
        // Відображення здоров'я
        this.ctx.save();
        this.ctx.fillStyle =
          this.health > this.maxHealth * 0.5
            ? "lime"
            : this.health > this.maxHealth * 0.25
            ? "orange"
            : "red";
        this.ctx.strokeStyle = "black";
        this.ctx.lineWidth = 2;
        this.ctx.font = "bold 14px Arial";
        this.ctx.textAlign = "center";
        const healthText = `${Math.ceil(this.health)}/${this.maxHealth}`;
        const healthX = this.x;
        const healthY =
          this.y -
          offsetY -
          currentFrame.height / 2 -
          (this.isRanged && this.maxShots !== null ? 28 : 10);
        this.ctx.strokeText(healthText, healthX, healthY);
        this.ctx.fillText(healthText, healthX, healthY);
        this.ctx.restore();
      }
    } else {
      this.renderer.draw(
        this.x - offsetX,
        this.y - offsetY,
        this.lookDirection
      );
      if (window.gameManager && window.gameManager.debugMode) {
        let bulletPointGlobal = null;
        if (currentFrame.bulletPoint) {
          let bulletPointX = currentFrame.bulletPoint.x;
          if (this.isSpriteFlippedHorizontally()) {
            bulletPointX =
              currentFrame.frameCenter.x -
              (currentFrame.bulletPoint.x - currentFrame.frameCenter.x);
          }
          const bulletOffsetX = bulletPointX - currentFrame.frameCenter.x;
          const bulletOffsetY =
            currentFrame.bulletPoint.y - currentFrame.frameCenter.y;
          bulletPointGlobal = {
            x: this.x + bulletOffsetX,
            y: this.y + bulletOffsetY,
          };
        }
        this.renderer.drawDebugFrame(
          this.x - offsetX,
          this.y - offsetY,
          this.lookDirection,
          bulletPointGlobal,
          this.lookDirection
        );
        // Відображення кількості пострілів для ренджед юнітів
        if (this.isRanged && this.maxShots !== null) {
          this.ctx.save();
          this.ctx.fillStyle = this.remainingShots > 0 ? "yellow" : "red";
          this.ctx.strokeStyle = "black";
          this.ctx.lineWidth = 2;
          this.ctx.font = "bold 16px Arial";
          this.ctx.textAlign = "center";
          const text = `${this.remainingShots}/${this.maxShots}`;
          const textX = this.x;
          const textY = this.y - offsetY - currentFrame.height / 2 - 10;
          this.ctx.strokeText(text, textX, textY);
          this.ctx.fillText(text, textX, textY);
          this.ctx.restore();
        }
        // Відображення здоров'я
        this.ctx.save();
        this.ctx.fillStyle =
          this.health > this.maxHealth * 0.5
            ? "lime"
            : this.health > this.maxHealth * 0.25
            ? "orange"
            : "red";
        this.ctx.strokeStyle = "black";
        this.ctx.lineWidth = 2;
        this.ctx.font = "bold 14px Arial";
        this.ctx.textAlign = "center";
        const healthText = `${Math.ceil(this.health)}/${this.maxHealth}`;
        const healthX = this.x;
        const healthY =
          this.y -
          offsetY -
          currentFrame.height / 2 -
          (this.isRanged && this.maxShots !== null ? 28 : 10);
        this.ctx.strokeText(healthText, healthX, healthY);
        this.ctx.fillText(healthText, healthX, healthY);
        this.ctx.restore();
      }
    }
  }

  // Only method needed for direct position control
  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.updateZCoordinate();
  }

  updatePositionFromGrid() {
    const { cellWidth, cellHeight } = this.gridManager;

    // Calculate anchor position based on expansion direction
    let anchorCol = this.gridCol;
    let anchorRow = this.gridRow;

    switch (this.expansionDirection) {
      case "topLeft":
        // Base cell is at bottom-right
        anchorCol = this.gridCol - (this.gridWidth - 1);
        anchorRow = this.gridRow - (this.gridHeight - 1);
        break;
      case "topRight":
        // Base cell is at bottom-left
        anchorRow = this.gridRow - (this.gridHeight - 1);
        break;
      case "bottomLeft":
        // Base cell is at top-right
        anchorCol = this.gridCol - (this.gridWidth - 1);
        break;
      case "bottomRight":
      default:
        // Base cell is at top-left (default)
        break;
    }

    // Calculate center point of the entire object
    this.x = (anchorCol + this.gridWidth / 2) * cellWidth;
    this.y = (anchorRow + this.gridHeight / 2) * cellHeight;
    this.updateZCoordinate();
  }

  updateZCoordinate() {
    // Make z always equal to y
    if (this.isDead) {
      this.z = this.y - this.y / 70;
    } else {
      this.z = this.y;
    }

    return this.z;
  }

  // Перевіряє чи спрайт інвертований горизонтально (така сама логіка як в renderer.js)
  isSpriteFlippedHorizontally() {
    const direction = this.moveDirection || this.lookDirection;
    return direction && direction.dx < 0;
  }

  // Встановлює напрямок погляду на основі команди та того, хто дивиться
  setLookDirectionByTeam() {
    // Скидаємо moveDirection щоб використовувався lookDirection
    this.moveDirection = null;
    // team 1 завжди вправо, team 2 завжди вліво
    if (this.team === 1) {
      this.lookDirection = { dx: 1, dy: 0 };
    } else if (this.team === 2) {
      this.lookDirection = { dx: -1, dy: 0 };
    }
  }

  // Перевіряє чи юніт може стріляти здалеку (є стріли)
  canShootRanged() {
    return (
      this.isRanged && this.remainingShots !== null && this.remainingShots > 0
    );
  }

  // Витрачає один постріл
  useShot() {
    if (this.remainingShots !== null && this.remainingShots > 0) {
      this.remainingShots--;
    }
  }

  // Поновлює постріли (для початку раунду або особливих здібностей)
  refillShots(amount = null) {
    if (this.maxShots === null) return; // Якщо юніт не має обмежень на постріли

    if (amount === null) {
      // Повне поновлення
      this.remainingShots = this.maxShots;
    } else {
      // Часткове поновлення
      this.remainingShots = Math.min(
        this.remainingShots + amount,
        this.maxShots
      );
    }
  }
}
