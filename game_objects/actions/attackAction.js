import { MoveAction } from "../../import.js";
import { Particle } from "../../import.js"; // Add this import
import { ConfigLoader } from "../../import.js";

export class AttackAction {
  constructor(objectManager) {
    this.objectManager = objectManager;
    this.moveAction = new MoveAction();
    this.configLoader = new ConfigLoader();
    this.configLoader.load({
      mage: "/game_configs/units/config7.json",
    });
  }

  canExecute(gameObject) {
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

    // Check if unit is ranged
    if (gameObject.isRanged) {
      // Find enemy in range attack distance
      const rangedTarget = this.findRangedTarget(gameObject);

      if (rangedTarget) {
        // Enemy in ranged attack distance - set as attack target
        gameObject.attackTarget = rangedTarget;
        gameObject.isRangedAttack = true;
        return true;
      }
    }

    // If not ranged or no ranged targets found, check for melee attack
    // Check if enemy is in attack range
    if (this.isEnemyInRange(gameObject, nearestEnemy)) {
      // Enemy in range - set as attack target
      gameObject.attackTarget = nearestEnemy;
      gameObject.isRangedAttack = false;
      return true;
    } else {
      // Enemy not in range - set as move target
      gameObject.attackTarget = nearestEnemy;
      gameObject.moveTarget = {
        col: nearestEnemy.gridCol,
        row: nearestEnemy.gridRow,
      };
      return false;
    }
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
    // Create arrow projectile configuration
    const arrowConfig = {
      type: "arrow",
      moveSpeed: 15,
      trajectoryType: "arc",
      damage: gameObject.attackDamage || 10,
    };

    // Create a new particle at the center of the game object
    const particle = new Particle(
      gameObject.ctx,
      this.configLoader.getConfig("mage"),
      arrowConfig,
      gameObject.x,
      gameObject.y,
      target,
      gameObject.gridManager
    );

    // Add the particle to the object manager
    if (this.objectManager.particles) {
      this.objectManager.particles.push(particle);
    } else {
      // If particles array doesn't exist, create it
      this.objectManager.particles = [particle];
    }
  }

  // Find a target for ranged attack
  findRangedTarget(gameObject) {
    const minRangeDistance = 2; // Minimum range distance
    const maxRangeDistance = 15; // Maximum range distance
    let bestTarget = null;
    let bestDistance = Infinity;

    // Find all enemies within range
    for (const obj of this.objectManager.objects) {
      // Skip if dead, same team, or no team
      if (obj.isDead || !obj.team || obj.team === gameObject.team) {
        continue;
      }

      // Calculate minimum distance between any cells of both objects
      const distance = this.getMinDistanceBetweenObjects(gameObject, obj);

      // Check if enemy is within ranged attack distance
      if (distance >= minRangeDistance && distance <= maxRangeDistance) {
        // Find the closest enemy within range
        if (distance < bestDistance) {
          bestDistance = distance;
          bestTarget = obj;
        }
      }
    }

    return bestTarget;
  }

  // Update method to be called from ActionManager's update
  update(gameObject, deltaTime) {
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

      // Для дальнього бою спочатку шукаємо ціль в діапазоні дальньої атаки
      if (gameObject.isRanged) {
        const rangedTarget = this.findRangedTarget(gameObject);
        if (rangedTarget) {
          gameObject.attackTarget = rangedTarget;
          gameObject.isRangedAttack = true;
          return true;
        }
      }

      // Якщо немає цілі для дальнього бою, шукаємо найближчого ворога
      const nearestEnemy = this.findNearestEnemy(gameObject);

      if (!nearestEnemy) {
        // Якщо ворогів немає, скидаємо цілі
        this.moveAction.cancelMovement(gameObject);
        return false;
      }

      // Встановлюємо нову ціль
      gameObject.attackTarget = nearestEnemy;
      gameObject.isRangedAttack = false;
    }

    // Перевіряємо, чи ціль в діапазоні атаки
    if (gameObject.isRanged) {
      // Для дальнього бою перевіряємо, чи ціль в діапазоні дальньої атаки
      const distance = this.getMinDistanceBetweenObjects(
        gameObject,
        gameObject.attackTarget
      );
      const minRangeDistance = 5;
      const maxRangeDistance = 30;

      if (distance >= minRangeDistance && distance <= maxRangeDistance) {
        // Zupynyayemo rukh
        if (gameObject.isMoving) {
          // Change this line - don't keep the animation
          this.moveAction.cancelMovement(gameObject, false); // Set keepAnimation to false
        }
        gameObject.isRangedAttack = true;
        gameObject.moveTarget = null;
        return true;
      }
    }

    // Перевіряємо, чи ціль в діапазоні ближньої атаки
    if (this.isEnemyInRange(gameObject, gameObject.attackTarget)) {
      // Якщо ціль в діапазоні атаки, зупиняємо рух
      if (gameObject.isMoving && this.moveAction) {
        this.moveAction.cancelMovement(gameObject);
      }
      gameObject.isRangedAttack = false;
      return true;
    } else {
      // Якщо ціль не в діапазоні атаки, оновлюємо moveTarget
      gameObject.moveTarget = {
        col: gameObject.attackTarget.gridCol,
        row: gameObject.attackTarget.gridRow,
      };

      // Якщо є moveAction і об'єкт рухається, оновлюємо шлях
      if (this.moveAction && gameObject.isMoving) {
        this.moveAction.setMoveTarget(
          gameObject,
          gameObject.attackTarget.gridCol,
          gameObject.attackTarget.gridRow,
          [0] // allowedObstacleTypes
        );
      }

      return false;
    }
  }
}

// For a direct projectile (arrow)
const arrow = {
  type: "arrow",
  spritesheet: "projectiles",
  animation: "arrow",
  moveSpeed: 5,
  trajectoryType: "direct",
  damage: 10,
};

// For an arc projectile (catapult stone)
const stone = {
  type: "stone",
  spritesheet: "projectiles",
  animation: "stone",
  moveSpeed: 3,
  trajectoryType: "arc",
  arcHeight: 100, // Higher arc
  damage: 25,
  effectRadius: 2, // Area damage
};
