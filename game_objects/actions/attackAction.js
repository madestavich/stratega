import { MoveAction } from "../../import.js";
import { Particle } from "../../import.js"; // Add this import

export class AttackAction {
  constructor(objectManager) {
    this.objectManager = objectManager;
    this.moveAction = new MoveAction();
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

    // Find nearest enemy
    const nearestEnemy = this.findNearestEnemy(gameObject);

    if (!nearestEnemy) {
      // No enemies found at all
      gameObject.attackTarget = null;
      gameObject.moveTarget = null;
      return false;
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
      gameObject.isAttacking = true;
      this.setLookDirection(gameObject, gameObject.attackTarget);

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

  // Method to spawn a projectile
  spawnProjectile(gameObject, target) {
    // Get the current frame
    const currentFrame = gameObject.animator.activeFrame;

    // Calculate the bullet starting position
    let bulletX, bulletY;

    if (currentFrame.bulletPoint) {
      // Calculate the bullet point offset from the frame center
      const bulletOffsetX =
        currentFrame.bulletPoint.x - currentFrame.frameCenter.x;
      const bulletOffsetY =
        currentFrame.bulletPoint.y - currentFrame.frameCenter.y;

      // Apply the direction (flip if needed)
      const directionMultiplier = gameObject.lookDirection.dx < 0 ? -1 : 1;

      // Calculate the final world position
      bulletX = gameObject.x + bulletOffsetX * directionMultiplier;
      bulletY = gameObject.y + bulletOffsetY;
    } else {
      // Fallback to object center if no bullet point defined
      bulletX = gameObject.x;
      bulletY = gameObject.y;
    }

    // Create a particle
    const particle = new Particle(
      gameObject.ctx,
      gameObject.spriteConfig,
      gameObject.bulletConfig,
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
    for (const obj of this.objectManager.objects) {
      // Skip if dead, same team, or no team
      if (obj.isDead || !obj.team || obj.team === gameObject.team) {
        continue;
      }

      // Calculate minimum distance between any cells of both objects
      const distance = this.getMinDistanceBetweenObjects(gameObject, obj);

      // If any enemy is closer than maxDistance, return true
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

    // Find all enemies within range
    for (const obj of this.objectManager.objects) {
      // Skip if dead, same team, or no team
      if (obj.isDead || !obj.team || obj.team === gameObject.team) {
        continue;
      }

      // Calculate minimum distance between any cells of both objects
      const distance = this.getMinDistanceBetweenObjects(gameObject, obj);

      // Check if enemy is within ranged attack distance
      if (
        distance >= gameObject.minRangeDistance &&
        distance <= gameObject.maxRangeDistance
      ) {
        // Calculate direction vector
        const dx = obj.gridCol - gameObject.gridCol;
        const dy = obj.gridRow - gameObject.gridRow;

        // Calculate score based on distance and direction
        // Lower score means higher priority
        let score = distance * 10; // Base score is distance

        // Check if target is in straight line (horizontally or vertically)
        if (dx === 0 || dy === 0) {
          // Straight line gets priority (subtract 50 from score)
          score -= 50;
        } else if (Math.abs(dx) === Math.abs(dy)) {
          // Diagonal line gets secondary priority (subtract 25 from score)
          score -= 25;
        }

        // Find the target with the best (lowest) score
        if (score < bestScore) {
          bestScore = score;
          bestTarget = obj;
        }
      }
    }

    return bestTarget;
  }

  // Update method to be called from ActionManager's update
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

  findNearestEnemy(gameObject) {
    let nearestEnemy = null;
    let minDistance = Infinity;

    // Find all enemies (units from other teams)
    for (const obj of this.objectManager.objects) {
      // Skip if dead, same team, or no team
      if (obj.isDead || !obj.team || obj.team === gameObject.team) {
        continue;
      }

      // Calculate minimum distance between any cells of both objects
      const distance = this.getMinDistanceBetweenObjects(gameObject, obj);

      // Update nearest enemy
      if (distance < minDistance) {
        minDistance = distance;
        nearestEnemy = obj;
      }
    }

    return nearestEnemy;
  }

  getMinDistanceBetweenObjects(object1, object2) {
    let minDistance = Infinity;

    // Get all cells occupied by object1
    for (let col1 = 0; col1 < object1.gridWidth; col1++) {
      for (let row1 = 0; row1 < object1.gridHeight; row1++) {
        let cell1Col, cell1Row;

        // Calculate actual cell position based on expansion direction
        switch (object1.expansionDirection) {
          case "bottomRight":
            cell1Col = object1.gridCol + col1;
            cell1Row = object1.gridRow + row1;
            break;
          case "topRight":
            cell1Col = object1.gridCol + col1;
            cell1Row = object1.gridRow - row1;
            break;
          case "bottomLeft":
            cell1Col = object1.gridCol - col1;
            cell1Row = object1.gridRow + row1;
            break;
          case "topLeft":
            cell1Col = object1.gridCol - col1;
            cell1Row = object1.gridRow - row1;
            break;
          default:
            cell1Col = object1.gridCol + col1;
            cell1Row = object1.gridRow + row1;
        }

        // Get all cells occupied by object2
        for (let col2 = 0; col2 < object2.gridWidth; col2++) {
          for (let row2 = 0; row2 < object2.gridHeight; row2++) {
            let cell2Col, cell2Row;

            // Calculate actual cell position based on expansion direction
            switch (object2.expansionDirection) {
              case "bottomRight":
                cell2Col = object2.gridCol + col2;
                cell2Row = object2.gridRow + row2;
                break;
              case "topRight":
                cell2Col = object2.gridCol + col2;
                cell2Row = object2.gridRow - row2;
                break;
              case "bottomLeft":
                cell2Col = object2.gridCol - col2;
                cell2Row = object2.gridRow + row2;
                break;
              case "topLeft":
                cell2Col = object2.gridCol - col2;
                cell2Row = object2.gridRow - row2;
                break;
              default:
                cell2Col = object2.gridCol + col2;
                cell2Row = object2.gridRow + row2;
            }

            // Calculate distance between these two cells
            const distance = this.calculateDistance(
              cell1Col,
              cell1Row,
              cell2Col,
              cell2Row
            );

            if (distance < minDistance) {
              minDistance = distance;
            }
          }
        }
      }
    }

    return minDistance;
  }

  isEnemyInRange(attacker, target) {
    const attackRange = attacker.attackRange || 1;
    const distance = this.getMinDistanceBetweenObjects(attacker, target);
    return distance <= attackRange;
  }

  calculateDistance(col1, row1, col2, row2) {
    // Use Chebyshev distance for grid-based movement with diagonals
    return Math.max(Math.abs(col1 - col2), Math.abs(row1 - row2));
  }

  setLookDirection(gameObject, target) {
    // Calculate direction vector
    const dx = target.gridCol - gameObject.gridCol;
    const dy = target.gridRow - gameObject.gridRow;

    // Normalize to -1, 0, or 1 while preserving direction
    const dirX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
    const dirY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

    // Set look direction including diagonals
    gameObject.lookDirection = { x: dirX, y: dirY };
  }

  dealDamage(attacker, target) {
    // Skip if no target or target is already dead
    if (!target || target.isDead || target.health === undefined) {
      return;
    }

    // Apply damage
    const damage = attacker.attackDamage || 10;
    target.health -= damage;

    // Check if target is defeated
    if (target.health <= 0 && !target.isDead) {
      // Set the isDead flag
      target.isDead = true;
      target.canAct = false;
      attacker.isAttacking = false;

      // Play death animation if available
      if (
        target.animator &&
        target.animator.activeSpritesheet.animations.death
      ) {
        target.animator.setAnimation("death", false);
      }
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
    gameObject.moveTarget = {
      col: gameObject.attackTarget.gridCol,
      row: gameObject.attackTarget.gridRow,
    };

    // Якщо об'єкт не рухається, спробуємо почати рух
    if (!gameObject.isMoving && this.moveAction) {
      const canMove = this.moveAction.setMoveTarget(
        gameObject,
        gameObject.attackTarget.gridCol,
        gameObject.attackTarget.gridRow,
        [0] // allowedObstacleTypes
      );

      // Якщо не можемо рухатися, просто стоїмо на місці
      if (!canMove) {
        // Встановлюємо анімацію "idle"
        if (
          gameObject.animator &&
          gameObject.animator.activeAnimation.name !== "idle"
        ) {
          gameObject.animator.setAnimation("idle");
        }
      }
    }

    return false;
  }
}
