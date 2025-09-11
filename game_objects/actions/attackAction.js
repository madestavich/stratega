import { MoveAction } from "../../import.js";
import { Particle } from "../../import.js"; // Add this import

export class AttackAction {
  constructor(objectManager) {
    this.objectManager = objectManager;
    this.moveAction = new MoveAction();
  }

  // Get all objects (player and enemy) in one array
  getAllObjects() {
    return [...this.objectManager.objects, ...this.objectManager.enemyObjects];
  }

  canExecute(gameObject) {
    if (gameObject.isDead) {
      return false;
    }
    // Check if unit is already attacking
    if (gameObject.isAttacking) {
      // If it's the last frame of attack animation, we'll handle damage in execute
      const animator = gameObject.animator;
      const isLastFrame =
        animator.frameIndex === animator.activeAnimation.frames.length - 1;

      return isLastFrame; // Can execute to finish the attack
    }

    // Check if attack is on cooldown
    if (gameObject.attackCooldown && gameObject.attackCooldown > 0) {
      return false;
    }

    // Check if current target is dead and reset if needed
    if (gameObject.attackTarget && gameObject.attackTarget.isDead) {
      gameObject.attackTarget = null;
      this.moveAction.cancelMovement(gameObject);
    }

    // Update move target if enemy has moved
    if (
      gameObject.attackTarget &&
      gameObject.moveTarget &&
      (gameObject.moveTarget.col !== gameObject.attackTarget.gridCol ||
        gameObject.moveTarget.row !== gameObject.attackTarget.gridRow)
    ) {
      this.moveAction.cancelMovement(gameObject);
      gameObject.moveTarget = {
        col: gameObject.attackTarget.gridCol,
        row: gameObject.attackTarget.gridRow,
      };
    }

    // Find nearest enemy
    const nearestEnemy = this.findNearestEnemy(gameObject);

    if (!nearestEnemy) {
      // No enemies found at all
      gameObject.attackTarget = null;
      gameObject.moveTarget = null;
      return false;
    }

    // Check if we need to switch to a different target
    if (gameObject.attackTarget && gameObject.attackTarget !== nearestEnemy) {
      // Target changed, cancel current movement
      this.moveAction.cancelMovement(gameObject);
      gameObject.attackTarget = nearestEnemy;
      gameObject.moveTarget = null; // Will be set below
    }

    // Calculate distance to nearest enemy
    const distanceToNearest = this.getMinDistanceBetweenObjects(
      gameObject,
      nearestEnemy
    );

    // Check if enemy is in melee range first
    if (this.isEnemyInRange(gameObject, nearestEnemy)) {
      // Enemy in melee range - set as attack target
      gameObject.attackTarget = nearestEnemy;
      gameObject.isRangedAttack = false;
      return true;
    }

    // Check if unit is ranged and no enemies are within minRangeDistance
    if (gameObject.isRanged) {
      // Find enemy in range attack distance
      const rangedTarget = this.findRangedTarget(gameObject);

      // Check if there are any enemies too close for ranged attack
      const tooCloseEnemies = this.findEnemiesCloserThan(
        gameObject,
        gameObject.minRangeDistance
      );

      if (rangedTarget && !tooCloseEnemies) {
        // Enemy in ranged attack distance and no enemies too close - set as attack target
        gameObject.attackTarget = rangedTarget;
        gameObject.isRangedAttack = true;
        return true;
      }
    }

    // If we got here, no valid attack is possible right now
    // Set nearest enemy as move target
    gameObject.attackTarget = nearestEnemy;
    gameObject.moveTarget = {
      col: nearestEnemy.gridCol,
      row: nearestEnemy.gridRow,
    };
    return false;
  }

  execute(gameObject) {
    // If attacking and on last frame
    if (gameObject.isAttacking) {
      const animator = gameObject.animator;
      const isLastFrame =
        animator.frameIndex === animator.activeAnimation.frames.length - 1;

      if (isLastFrame) {
        // Always update lookDirection before attack
        if (gameObject.attackTarget) {
          this.setLookDirection(gameObject, gameObject.attackTarget);
        }
        // For ranged attack, spawn a projectile
        if (gameObject.isRangedAttack && gameObject.attackTarget) {
          this.spawnProjectile(gameObject, gameObject.attackTarget);
        } else {
          // For melee attack, deal damage directly
          this.dealDamage(gameObject, gameObject.attackTarget);
        }

        // Reset attack state
        gameObject.isAttacking = false;
        gameObject.isRangedAttack = false;
        // Set attack cooldown
        gameObject.attackCooldown = gameObject.attackSpeed * 1000;
        // Set animation back to idle after attack
        gameObject.animator.setAnimation("idle", true);

        return true;
      }
    }

    // Start a new attack
    if (
      !gameObject.isAttacking &&
      gameObject.attackTarget &&
      !gameObject.attackTarget.isDead
    ) {
      // Set look direction before starting attack animation
      this.setLookDirection(gameObject, gameObject.attackTarget);

      gameObject.isAttacking = true;

      // Вибір правильної анімації в залежності від типу атаки
      if (
        gameObject.isRangedAttack &&
        gameObject.animator.activeSpritesheet.animations.range_attack
      ) {
        gameObject.animator.setAnimation("range_attack", false);
      } else {
        gameObject.animator.setAnimation("attack", false);
      }
      return true;
    }

    return false;
  }

  // Update method called by ActionManager
  update(gameObject, deltaTime) {
    if (gameObject.isDead) {
      return false;
    }
    // Зменшуємо час перезарядки атаки, якщо він є
    if (gameObject.attackCooldown && gameObject.attackCooldown > 0) {
      gameObject.attackCooldown -= deltaTime;
    }

    // Оновлюємо ціль атаки, якщо об'єкт не атакує в даний момент
    if (!gameObject.isAttacking && !gameObject.isDead) {
      this.updateAttackTarget(gameObject);
    }
  }

  // Method to spawn a projectile
  spawnProjectile(gameObject, target) {
    // Get the current frame
    const currentFrame = gameObject.animator.activeFrame;

    // Calculate the bullet starting position
    let bulletX, bulletY;

    if (currentFrame.bulletPoint) {
      let bulletPointX = currentFrame.bulletPoint.x;
      const isFlipped = gameObject.isSpriteFlippedHorizontally();

      // Якщо спрайт відзеркалений, рахуємо офсет з урахуванням ширини кадру
      if (isFlipped) {
        bulletPointX =
          currentFrame.bulletPoint.x -
          currentFrame.width +
          (currentFrame.x + currentFrame.width - bulletPointX);
      }

      const bulletOffsetX = bulletPointX - currentFrame.frameCenter.x;
      const bulletOffsetY =
        currentFrame.bulletPoint.y - currentFrame.frameCenter.y;

      // Calculate the final world position
      bulletX = gameObject.x + bulletOffsetX;
      bulletY = gameObject.y + bulletOffsetY;
    } else {
      // Fallback to object center if no bullet point defined
      bulletX = gameObject.x;
      bulletY = gameObject.y;
    }

    // Calculate moveVector towards target
    const dx = target.x - bulletX;
    const dy = target.y - bulletY;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const moveVector = { dx: dx / distance, dy: dy / distance };

    // Ensure bulletConfig has moveSpeed and damage
    const bulletConfig = Object.assign({}, gameObject.bulletConfig);
    bulletConfig.moveVector = moveVector;
    bulletConfig.damage =
      gameObject.bulletConfig && gameObject.bulletConfig.bulletDamage
        ? gameObject.bulletConfig.bulletDamage
        : gameObject.attackDamage || 10;

    // Create a particle
    const particle = new Particle(
      gameObject.ctx,
      gameObject.spriteConfig,
      bulletConfig,
      bulletX,
      bulletY,
      target,
      gameObject.gridManager
    );

    // Adjust the target Y position to aim at the center of the target
    // Get target's current frame to determine its height
    const targetFrame = target.animator.activeFrame;
    const targetHeight = targetFrame.height;
    particle.targetY = target.y - targetHeight / 2;

    // Recalculate trajectory with the new target Y
    particle.totalDistance = Math.sqrt(
      Math.pow(particle.targetX - particle.startX, 2) +
        Math.pow(particle.targetY - particle.startY, 2)
    );

    // Add the particle to the object manager
    if (this.objectManager.particles) {
      this.objectManager.particles.push(particle);
    } else {
      // If particles array doesn't exist, create it
      this.objectManager.particles = [particle];
    }
  }

  // New helper method to find enemies closer than a specified distance
  findEnemiesCloserThan(gameObject, maxDistance) {
    for (const obj of this.getAllObjects()) {
      // Skip if dead, no team, or same team
      if (obj.isDead || !obj.team || obj.team === gameObject.team) {
        continue;
      }
      const distance = this.getMinDistanceBetweenObjects(gameObject, obj);
      if (distance < maxDistance) {
        return true;
      }
    }
    return false;
  }

  // Find a target for ranged attack
  findRangedTarget(gameObject) {
    let bestTarget = null;
    let bestScore = Infinity; // Lower score is better
    for (const obj of this.getAllObjects()) {
      // Skip if dead, no team, or same team
      if (obj.isDead || !obj.team || obj.team === gameObject.team) {
        continue;
      }
      const distance = this.getMinDistanceBetweenObjects(gameObject, obj);
      if (
        distance >= gameObject.minRangeDistance &&
        distance <= gameObject.maxRangeDistance
      ) {
        const dx = obj.gridCol - gameObject.gridCol;
        const dy = obj.gridRow - gameObject.gridRow;
        let score = distance * 10;
        if (dx === 0 || dy === 0) {
          score -= 50;
        } else if (Math.abs(dx) === Math.abs(dy)) {
          score -= 25;
        }
        if (score < bestScore) {
          bestScore = score;
          bestTarget = obj;
        }
      }
    }
    return bestTarget;
  }

  update(gameObject, deltaTime) {
    if (gameObject.isDead) {
      return false;
    }
    // Зменшуємо час перезарядки атаки, якщо він є
    if (gameObject.attackCooldown && gameObject.attackCooldown > 0) {
      gameObject.attackCooldown -= deltaTime;
    }

    // Оновлюємо ціль атаки, якщо об'єкт не атакує в даний момент
    if (!gameObject.isAttacking && !gameObject.isDead) {
      this.updateAttackTarget(gameObject);
    }
  }

  updateAttackTarget(gameObject) {
    // Перевіряємо, чи є ціль атаки
    if (!gameObject.attackTarget || gameObject.attackTarget.isDead) {
      // Якщо цілі немає або вона мертва, знаходимо нову
      const nearestEnemy = this.findNearestEnemy(gameObject);

      if (!nearestEnemy) {
        // Якщо ворогів немає, скидаємо цілі
        this.moveAction.cancelMovement(gameObject);
        return false;
      }

      // Встановлюємо нову ціль
      gameObject.attackTarget = nearestEnemy;
    }

    // Перевіряємо, чи ціль в діапазоні ближньої атаки
    if (this.isEnemyInRange(gameObject, gameObject.attackTarget)) {
      // Якщо ціль в діапазоні атаки, зупиняємо рух
      if (gameObject.isMoving && this.moveAction) {
        this.moveAction.cancelMovement(gameObject);
      }
      gameObject.isRangedAttack = false;
      return true;
    }

    // Перевіряємо, чи ціль в діапазоні дальньої атаки
    if (gameObject.isRanged) {
      const distance = this.getMinDistanceBetweenObjects(
        gameObject,
        gameObject.attackTarget
      );

      // Check if there are any enemies too close for ranged attack
      const tooCloseEnemies = this.findEnemiesCloserThan(
        gameObject,
        gameObject.minRangeDistance
      );

      if (
        !tooCloseEnemies &&
        distance >= gameObject.minRangeDistance &&
        distance <= gameObject.maxRangeDistance
      ) {
        // Zupynyayemo rukh
        if (gameObject.isMoving) {
          this.moveAction.cancelMovement(gameObject, false);
        }
        gameObject.isRangedAttack = true;
        gameObject.moveTarget = null;
        return true;
      }
    }

    // Якщо ціль не в діапазоні атаки, оновлюємо moveTarget
    if (
      !gameObject.moveTarget ||
      gameObject.moveTarget.col !== gameObject.attackTarget.gridCol ||
      gameObject.moveTarget.row !== gameObject.attackTarget.gridRow
    ) {
      gameObject.moveTarget = {
        col: gameObject.attackTarget.gridCol,
        row: gameObject.attackTarget.gridRow,
      };
    }

    // Якщо об'єкт не рухається, спробуємо почати рух
    if (!gameObject.isMoving && this.moveAction && gameObject.moveTarget) {
      const canMove = this.moveAction.setMoveTarget(
        gameObject,
        gameObject.moveTarget.col,
        gameObject.moveTarget.row,
        [0] // allowedObstacleTypes
      );

      // Якщо не можемо рухатися до поточної цілі
      if (!canMove) {
        // Спробуємо знайти іншу ціль, до якої можна дістатися
        const alternativeTarget = this.findAlternativeTarget(gameObject);
        if (alternativeTarget) {
          gameObject.attackTarget = alternativeTarget;
          gameObject.moveTarget = {
            col: alternativeTarget.gridCol,
            row: alternativeTarget.gridRow,
          };

          // Спробуємо рухатися до альтернативної цілі
          const canMoveToAlternative = this.moveAction.setMoveTarget(
            gameObject,
            alternativeTarget.gridCol,
            alternativeTarget.gridRow,
            [0]
          );

          // Якщо все ще не можемо рухатися, скидаємо moveTarget і спробуємо через кілька кадрів
          if (!canMoveToAlternative) {
            gameObject.moveTarget = null;
            // Встановлюємо затримку перед наступною спробою
            gameObject.retryMoveDelay = 500; // 500ms затримка
          }
        } else {
          // Якщо альтернативна ціль не знайдена, скидаємо moveTarget і встановлюємо затримку
          gameObject.moveTarget = null;
          gameObject.retryMoveDelay = 1000; // 1 секунда затримка
        }

        // Встановлюємо анімацію "idle"
        if (
          gameObject.animator &&
          gameObject.animator.activeAnimation.name !== "idle"
        ) {
          gameObject.animator.setAnimation("idle");
        }
      }
    }

    // Обробляємо затримку перед повторною спробою руху
    if (gameObject.retryMoveDelay && gameObject.retryMoveDelay > 0) {
      gameObject.retryMoveDelay -= 16; // Приблизно 60 FPS
      if (gameObject.retryMoveDelay <= 0) {
        gameObject.retryMoveDelay = 0;
        // Скидаємо moveTarget, щоб спробувати знову
        gameObject.moveTarget = null;
      }
    }

    return false;
  }

  // Додайте цей новий метод
  findAlternativeTarget(gameObject) {
    const enemies = this.getAllObjects().filter(
      (obj) => !obj.isDead && obj.team && obj.team !== gameObject.team
    );

    // Сортуємо ворогів за відстанню
    enemies.sort((a, b) => {
      const distA = this.getMinDistanceBetweenObjects(gameObject, a);
      const distB = this.getMinDistanceBetweenObjects(gameObject, b);
      return distA - distB;
    });

    // Перевіряємо кожного ворога, чи можемо до нього дістатися
    for (const enemy of enemies) {
      // Спробуємо знайти шлях до цього ворога
      if (this.pathfinder || this.moveAction.ensurePathfinder(gameObject)) {
        const pathfinder = this.pathfinder || this.moveAction.pathfinder;
        const path = pathfinder.findPath(
          gameObject.gridCol,
          gameObject.gridRow,
          enemy.gridCol,
          enemy.gridRow,
          gameObject.gridWidth,
          gameObject.gridHeight,
          gameObject.expansionDirection,
          gameObject,
          [0]
        );

        if (path && path.length > 0) {
          return enemy;
        }
      }
    }

    return null;
  }
}
