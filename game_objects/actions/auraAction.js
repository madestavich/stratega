/**
 * AuraAction - дія для періодичного впливу на союзних юнітів у радіусі
 *
 * Параметри з конфігу юніта (auraConfig):
 * - auraRange: number - радіус дії аури (у клітинках)
 * - auraCooldown: number - час між спрацюваннями (мс) - детермінізм забезпечується фіксованим deltaTime
 * - healAmount: number - кількість HP для відновлення (0 якщо не хілить)
 * - ammoRestore: number - кількість стріл для відновлення (0 якщо не відновлює)
 * - affectSelf: boolean - чи впливає на самого себе
 * - effectName: string - назва візуального ефекту (опціонально)
 *
 * Детермінізм: використовує фіксований moveTimeStep (~28ms) з gameManager,
 * тому кулдаун завжди спрацьовує на тому ж тіку на всіх машинах.
 */

export class AuraAction {
  constructor(objectManager) {
    this.objectManager = objectManager;
  }

  /**
   * Отримати всі об'єкти (гравця та ворога), відсортовані за id
   */
  getAllObjects() {
    return [
      ...this.objectManager.objects,
      ...this.objectManager.enemyObjects,
    ].sort((a, b) => a.id - b.id);
  }

  /**
   * Перевірка чи можна виконати ауру
   */
  canExecute(gameObject) {
    // Не можемо якщо мертвий
    if (gameObject.isDead) {
      return false;
    }

    // Перевіряємо чи є конфіг аури
    if (!gameObject.auraConfig) {
      return false;
    }

    // Перевіряємо чи аура на кулдауні
    if (
      gameObject.auraCooldownRemaining &&
      gameObject.auraCooldownRemaining > 0
    ) {
      return false;
    }

    // Перевіряємо чи є союзники в радіусі які потребують підтримки
    const targets = this.getValidTargets(gameObject);
    return targets.length > 0;
  }

  /**
   * Отримати валідні цілі для аури
   */
  getValidTargets(gameObject) {
    const auraConfig = gameObject.auraConfig;
    const auraRange = auraConfig.auraRange || 3;
    const healAmount = auraConfig.healAmount || 0;
    const ammoRestore = auraConfig.ammoRestore || 0;
    const affectSelf =
      auraConfig.affectSelf !== undefined ? auraConfig.affectSelf : true;

    const allObjects = this.getAllObjects();
    const validTargets = [];

    for (const target of allObjects) {
      // Пропускаємо мертвих
      if (target.isDead) {
        continue;
      }

      // Перевіряємо команду - аура діє тільки на союзників
      if (target.team !== gameObject.team) {
        continue;
      }

      // Перевіряємо чи це сам юніт
      if (target.id === gameObject.id) {
        if (!affectSelf) {
          continue;
        }
      }

      // Обчислюємо відстань
      const distance = this.calculateDistance(gameObject, target);
      if (distance > auraRange) {
        continue;
      }

      // Перевіряємо чи ціль потребує підтримки
      let needsSupport = false;

      // Хілінг потрібен якщо HP не максимальне
      if (healAmount > 0 && target.health < target.maxHealth) {
        needsSupport = true;
      }

      // Відновлення амуніції потрібно якщо це ranged юніт з недостатньою кількістю стріл
      if (ammoRestore > 0 && target.isRanged && target.maxShots) {
        if (target.remainingShots < target.maxShots) {
          needsSupport = true;
        }
      }

      if (needsSupport) {
        validTargets.push(target);
      }
    }

    return validTargets;
  }

  /**
   * Обчислити відстань між двома об'єктами (у клітинках)
   */
  calculateDistance(obj1, obj2) {
    const dx = obj2.gridCol - obj1.gridCol;
    const dy = obj2.gridRow - obj1.gridRow;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Виконати ауру
   */
  execute(gameObject, deltaTime) {
    if (!this.canExecute(gameObject)) {
      return;
    }

    const auraConfig = gameObject.auraConfig;
    const healAmount = auraConfig.healAmount || 0;
    const ammoRestore = auraConfig.ammoRestore || 0;
    const effectName = auraConfig.effectName || null;
    const auraCooldown = auraConfig.auraCooldown || 2000; // За замовчуванням 2 секунди

    const targets = this.getValidTargets(gameObject);

    for (const target of targets) {
      // Хілінг
      if (healAmount > 0 && target.health < target.maxHealth) {
        const healedAmount = Math.min(
          healAmount,
          target.maxHealth - target.health
        );
        target.health += healedAmount;

        // Логування хілу
        if (typeof battleLogger !== "undefined") {
          console.log(
            `[Aura] ${gameObject.name} healed ${target.name} for ${healedAmount} HP`
          );
        }

        // Візуальний ефект хілу
        if (effectName && this.objectManager.effectManager) {
          this.objectManager.effectManager.createEffectOnUnit(
            target,
            effectName,
            {
              loop: false,
              autoRemove: true,
            }
          );
        }
      }

      // Відновлення амуніції
      if (ammoRestore > 0 && target.isRanged && target.maxShots) {
        if (target.remainingShots < target.maxShots) {
          const restoredAmount = Math.min(
            ammoRestore,
            target.maxShots - target.remainingShots
          );
          target.remainingShots += restoredAmount;

          console.log(
            `[Aura] ${gameObject.name} restored ${restoredAmount} ammo to ${target.name}`
          );
        }
      }
    }

    // Встановлюємо кулдаун
    gameObject.auraCooldownRemaining = auraCooldown;
  }

  /**
   * Оновлення стану (кулдаун)
   */
  update(gameObject, deltaTime) {
    // Зменшуємо кулдаун аури
    if (
      gameObject.auraCooldownRemaining &&
      gameObject.auraCooldownRemaining > 0
    ) {
      gameObject.auraCooldownRemaining -= deltaTime;
      if (gameObject.auraCooldownRemaining < 0) {
        gameObject.auraCooldownRemaining = 0;
      }
    }
  }

  /**
   * Debug відображення радіусу аури
   */
  debugDrawAuraRange(gameObject) {
    if (!gameObject.auraConfig || gameObject.isDead) {
      return;
    }

    const gridManager = gameObject.gridManager;
    if (!gridManager || !gridManager.ctx) {
      return;
    }

    const ctx = gridManager.ctx;
    const auraRange = gameObject.auraConfig.auraRange || 3;
    const healAmount = gameObject.auraConfig.healAmount || 0;
    const ammoRestore = gameObject.auraConfig.ammoRestore || 0;

    // Визначаємо колір залежно від типу аури
    let fillColor, strokeColor;
    if (healAmount > 0 && ammoRestore > 0) {
      // Обидва ефекти - фіолетовий
      fillColor = "rgba(180, 100, 255, 0.15)";
      strokeColor = "rgba(180, 100, 255, 0.6)";
    } else if (healAmount > 0) {
      // Тільки хіл - зелений
      fillColor = "rgba(100, 255, 100, 0.15)";
      strokeColor = "rgba(100, 255, 100, 0.6)";
    } else if (ammoRestore > 0) {
      // Тільки амуніція - синій
      fillColor = "rgba(100, 150, 255, 0.15)";
      strokeColor = "rgba(100, 150, 255, 0.6)";
    } else {
      return; // Немає ефектів
    }

    // Центр юніта в пікселях
    const centerX =
      (gameObject.gridCol + gameObject.gridWidth / 2) * gridManager.cellWidth;
    const centerY =
      (gameObject.gridRow + gameObject.gridHeight / 2) * gridManager.cellHeight;

    // Радіус в пікселях (середнє між шириною і висотою клітинки)
    const pixelRadius =
      auraRange * ((gridManager.cellWidth + gridManager.cellHeight) / 2);

    ctx.save();

    // Малюємо заповнене коло
    ctx.beginPath();
    ctx.arc(centerX, centerY, pixelRadius, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Малюємо контур
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Пунктирна лінія
    ctx.stroke();

    // Малюємо іконку в центрі
    ctx.setLineDash([]);
    ctx.font = "12px Arial";
    ctx.fillStyle = strokeColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let icon = "";
    if (healAmount > 0) icon += "💚";
    if (ammoRestore > 0) icon += "🏹";
    ctx.fillText(
      icon,
      centerX,
      centerY - (gameObject.gridHeight * gridManager.cellHeight) / 2 - 10
    );

    ctx.restore();
  }
}
