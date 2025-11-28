import { Pathfinder } from "../../import.js";

// Стани телепортації
const TeleportState = {
  IDLE: "idle",
  START_ANIMATION: "start_animation",
  TELEPORTING: "teleporting",
  END_ANIMATION: "end_animation",
};

export class TeleportAction {
  constructor(objectManager) {
    this.objectManager = objectManager;
    this.pathfinder = null;
  }

  // Ініціалізація pathfinder якщо потрібно
  ensurePathfinder(gameObject) {
    if (!this.pathfinder && gameObject.gridManager) {
      this.pathfinder = new Pathfinder(gameObject.gridManager);
    }
    return this.pathfinder != null;
  }

  // Перевірка чи можна виконати телепортацію
  canExecute(gameObject, targetCol, targetRow, allowedObstacleTypes = [0]) {
    try {
      // Перевірка базових умов
      if (gameObject.isDead) {
        return false;
      }

      // Якщо вже телепортуємося - продовжуємо
      if (
        gameObject.teleportState &&
        gameObject.teleportState !== TeleportState.IDLE
      ) {
        return true;
      }

      // Переконуємось що є pathfinder
      if (!this.ensurePathfinder(gameObject)) {
        return false;
      }

      // Визначаємо фінальну ціль
      let finalTargetCol = targetCol;
      let finalTargetRow = targetRow;

      // Безпечна перевірка координат
      if (finalTargetCol === undefined || finalTargetRow === undefined) {
        if (gameObject.moveTarget) {
          finalTargetCol = gameObject.moveTarget.col;
          finalTargetRow = gameObject.moveTarget.row;
        } else {
          return false;
        }
      }

      // Перевіряємо чи вже на місці
      if (
        gameObject.gridCol === finalTargetCol &&
        gameObject.gridRow === finalTargetRow
      ) {
        return false;
      }

      // Перевіряємо чи цільова позиція доступна
      const canOccupy = this.pathfinder.canOccupyExcludingSelf(
        finalTargetCol,
        finalTargetRow,
        gameObject.gridWidth,
        gameObject.gridHeight,
        gameObject.expansionDirection,
        gameObject,
        allowedObstacleTypes
      );

      if (!canOccupy) {
        // Шукаємо найближчу вільну клітинку біля цілі
        const nearestFree = this.findNearestFreeCell(
          gameObject,
          finalTargetCol,
          finalTargetRow,
          allowedObstacleTypes
        );
        if (nearestFree) {
          finalTargetCol = nearestFree.col;
          finalTargetRow = nearestFree.row;
        } else {
          // Немає вільних клітинок біля цілі
          return false;
        }
      }

      // Зберігаємо ціль телепортації
      gameObject.teleportTarget = { col: finalTargetCol, row: finalTargetRow };
      gameObject.moveTarget = { col: finalTargetCol, row: finalTargetRow };

      return true;
    } catch (error) {
      console.error("TeleportAction canExecute error:", error);
      return false;
    }
  }

  // Пошук найближчої вільної клітинки навколо цілі
  findNearestFreeCell(gameObject, targetCol, targetRow, allowedObstacleTypes) {
    // Пошук в розширюючихся кільцях навколо цілі
    for (let radius = 1; radius <= 5; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Перевіряємо тільки клітинки на периметрі
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
            const checkCol = targetCol + dx;
            const checkRow = targetRow + dy;

            if (
              this.pathfinder.canOccupyExcludingSelf(
                checkCol,
                checkRow,
                gameObject.gridWidth,
                gameObject.gridHeight,
                gameObject.expansionDirection,
                gameObject,
                allowedObstacleTypes
              )
            ) {
              return { col: checkCol, row: checkRow };
            }
          }
        }
      }
    }

    return null;
  }

  // Очищення клітинок які займає об'єкт
  clearObjectFromGrid(gameObject) {
    const gridManager = gameObject.gridManager;
    if (!gridManager || !gridManager.grid) return;

    const { gridCol, gridRow, gridWidth, gridHeight, expansionDirection } =
      gameObject;

    let startCol = gridCol;
    let startRow = gridRow;

    // Визначаємо початкову позицію на основі напрямку розширення
    switch (expansionDirection) {
      case "topLeft":
        startCol = gridCol - (gridWidth - 1);
        startRow = gridRow - (gridHeight - 1);
        break;
      case "topRight":
        startRow = gridRow - (gridHeight - 1);
        break;
      case "bottomLeft":
        startCol = gridCol - (gridWidth - 1);
        break;
      case "bottomRight":
      default:
        break;
    }

    // Очищаємо клітинки
    for (let row = startRow; row < startRow + gridHeight; row++) {
      for (let col = startCol; col < startCol + gridWidth; col++) {
        if (
          row >= 0 &&
          row < gridManager.rows &&
          col >= 0 &&
          col < gridManager.cols
        ) {
          gridManager.grid[row][col].occupied = false;
        }
      }
    }
  }

  // Виконання телепортації
  execute(gameObject, deltaTime) {
    // Ініціалізуємо стан телепортації якщо потрібно
    if (!gameObject.teleportState) {
      gameObject.teleportState = TeleportState.IDLE;
    }

    const animator = gameObject.animator;

    switch (gameObject.teleportState) {
      case TeleportState.IDLE:
        // Починаємо телепортацію - запускаємо анімацію старту
        this.startTeleportAnimation(gameObject);
        break;

      case TeleportState.START_ANIMATION:
        // Чекаємо завершення анімації старту
        if (this.isAnimationFinished(animator)) {
          this.performTeleport(gameObject);
        }
        break;

      case TeleportState.TELEPORTING:
        // Запускаємо анімацію завершення
        this.startEndAnimation(gameObject);
        break;

      case TeleportState.END_ANIMATION:
        // Чекаємо завершення анімації
        if (this.isAnimationFinished(animator)) {
          this.finishTeleport(gameObject);
        }
        break;
    }
  }

  // Запуск анімації початку телепортації
  startTeleportAnimation(gameObject) {
    gameObject.teleportState = TeleportState.START_ANIMATION;
    gameObject.isMoving = true;
    gameObject.isTeleporting = true;

    // Перевіряємо чи є анімація teleport_start
    const hasStartAnim =
      gameObject.animator.spriteConfig[gameObject.animator.activeSpritesheet]
        ?.animations?.teleport_start;

    if (hasStartAnim) {
      gameObject.animator.setAnimation("teleport_start");
    } else {
      // Якщо немає спеціальної анімації - використовуємо death як ефект зникнення
      // або пропускаємо анімацію
      gameObject.animator.setAnimation("death");
    }
  }

  // Виконання миттєвого переміщення
  performTeleport(gameObject) {
    if (!gameObject.teleportTarget) {
      this.cancelTeleport(gameObject);
      return;
    }

    const { col, row } = gameObject.teleportTarget;
    const { cellWidth, cellHeight } = gameObject.gridManager;

    // Звільняємо стару позицію в гріді
    this.clearObjectFromGrid(gameObject);

    // Оновлюємо позицію в гріді
    gameObject.gridCol = col;
    gameObject.gridRow = row;

    // Розраховуємо anchor позицію на основі expansion direction
    let anchorCol = col;
    let anchorRow = row;

    switch (gameObject.expansionDirection) {
      case "topLeft":
        anchorCol = col - (gameObject.gridWidth - 1);
        anchorRow = row - (gameObject.gridHeight - 1);
        break;
      case "topRight":
        anchorRow = row - (gameObject.gridHeight - 1);
        break;
      case "bottomLeft":
        anchorCol = col - (gameObject.gridWidth - 1);
        break;
      case "bottomRight":
      default:
        break;
    }

    // Розраховуємо нову піксельну позицію
    const targetX = (anchorCol + gameObject.gridWidth / 2) * cellWidth;
    const targetY = (anchorRow + gameObject.gridHeight / 2) * cellHeight;

    // Миттєво переміщуємо об'єкт
    gameObject.setPosition(targetX, targetY);

    // Оновлюємо позицію в гріді
    gameObject.gridManager.updateObjectGridPosition(gameObject);

    // Переходимо до стану телепортації
    gameObject.teleportState = TeleportState.TELEPORTING;
  }

  // Запуск анімації завершення телепортації
  startEndAnimation(gameObject) {
    gameObject.teleportState = TeleportState.END_ANIMATION;

    // Перевіряємо чи є анімація teleport_end
    const hasEndAnim =
      gameObject.animator.spriteConfig[gameObject.animator.activeSpritesheet]
        ?.animations?.teleport_end;

    if (hasEndAnim) {
      gameObject.animator.setAnimation("teleport_end");
    } else {
      // Якщо немає спеціальної анімації - використовуємо idle
      // Можна також програти death у зворотньому порядку через reverse
      gameObject.animator.setAnimation("idle");
    }
  }

  // Завершення телепортації
  finishTeleport(gameObject) {
    gameObject.teleportState = TeleportState.IDLE;
    gameObject.isMoving = false;
    gameObject.isTeleporting = false;
    gameObject.teleportTarget = null;
    gameObject.moveTarget = null;

    // Оновлюємо lookDirection на основі команди
    if (gameObject.setLookDirectionByTeam) {
      gameObject.setLookDirectionByTeam();
    }

    // Встановлюємо idle анімацію
    if (gameObject.animator.activeAnimation.name !== "idle") {
      gameObject.animator.setAnimation("idle");
    }
  }

  // Скасування телепортації
  cancelTeleport(gameObject) {
    gameObject.teleportState = TeleportState.IDLE;
    gameObject.isMoving = false;
    gameObject.isTeleporting = false;
    gameObject.teleportTarget = null;

    if (
      gameObject.animator &&
      gameObject.animator.activeAnimation.name !== "idle"
    ) {
      gameObject.animator.setAnimation("idle");
    }
  }

  // Перевірка чи анімація завершена
  isAnimationFinished(animator) {
    return animator.frameIndex === animator.activeAnimation.frames.length - 1;
  }

  // Встановлення нової цілі телепортації
  setTeleportTarget(
    gameObject,
    targetCol,
    targetRow,
    allowedObstacleTypes = [0]
  ) {
    // Скидаємо поточний стан
    gameObject.teleportState = TeleportState.IDLE;
    gameObject.teleportTarget = null;

    return this.canExecute(
      gameObject,
      targetCol,
      targetRow,
      allowedObstacleTypes
    );
  }

  // Перевірка чи об'єкт досяг цілі
  hasReachedTarget(gameObject) {
    return (
      gameObject.teleportState === TeleportState.IDLE &&
      !gameObject.isTeleporting &&
      gameObject.teleportTarget === null
    );
  }

  // Debug метод для відображення лінії від об'єкта до цілі телепортації
  debugDrawPath(gameObject, forceColor = null) {
    if (!gameObject || !gameObject.teleportTarget) return;

    const ctx = gameObject.gridManager.ctx;
    const { cellWidth, cellHeight } = gameObject.gridManager;

    ctx.save();

    // Визначаємо колір на основі команди або примусовий колір
    let lineColor = forceColor || "rgba(148, 0, 211, 0.7)"; // Фіолетовий для телепортації

    // Малюємо пунктирну лінію від об'єкта до цілі
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Пунктирна лінія

    ctx.moveTo(gameObject.x, gameObject.y);

    const targetCenterX = (gameObject.teleportTarget.col + 0.5) * cellWidth;
    const targetCenterY = (gameObject.teleportTarget.row + 0.5) * cellHeight;
    ctx.lineTo(targetCenterX, targetCenterY);

    ctx.stroke();

    // Малюємо зірку на місці телепортації
    ctx.fillStyle = lineColor;
    this.drawStar(ctx, targetCenterX, targetCenterY, 5, 10, 5);

    ctx.restore();
  }

  // Допоміжний метод для малювання зірки
  drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }

    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }
}
