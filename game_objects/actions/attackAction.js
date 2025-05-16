import { MoveAction } from "../../import.js";

export class AttackAction {
  constructor(objectManager) {
    this.objectManager = objectManager;
    this.moveAction = new MoveAction();
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
      this.checkIfTargetIsDead(gameObject);
      this.setNewTarget(gameObject);
      return false;
    }
    this.checkIfTargetIsDead(gameObject);
    return this.setNewTarget(gameObject);
  }

  execute(gameObject) {
    // Перевірка на існування цілі
    if (
      gameObject.isAttacking &&
      (!gameObject.attackTarget || gameObject.attackTarget.isDead)
    ) {
      gameObject.isAttacking = false;
      gameObject.animator.setAnimation("idle");
      return false;
    }

    // Якщо атакуємо і анімація на останньому кадрі
    if (gameObject.isAttacking) {
      const animator = gameObject.animator;
      const isLastFrame =
        animator.frameIndex === animator.activeAnimation.frames.length - 1;

      if (isLastFrame) {
        // Deal damage to the target
        this.dealDamage(gameObject, gameObject.attackTarget);
        // Reset attack state
        gameObject.isAttacking = false;
        // Set attack cooldown
        gameObject.attackCooldown = gameObject.attackSpeed * 1000;

        // Return to idle animation
        if (!gameObject.isMoving) {
          gameObject.animator.setAnimation("idle");
        } else {
          gameObject.animator.setAnimation("move");
        }
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
      gameObject.animator.setAnimation("attack", false, "idle");
      return true;
    }

    return false;
  }

  // Update method to be called from ActionManager's update
  update(gameObject, deltaTime) {
    // Reduce attack cooldown if it exists
    if (gameObject.attackCooldown && gameObject.attackCooldown > 0) {
      gameObject.attackCooldown -= deltaTime;
    }
  }

  findNearestEnemy(gameObject) {
    const attackRange = gameObject.attackRange || 1; // Default range is 1 cell
    const enemies = this.objectManager.objects.filter(
      (obj) => obj.team && obj.team !== gameObject.team && !obj.isDead
    );

    // If no enemies found, return false
    if (enemies.length === 0) {
      return { inRangeEnemy: null, anyEnemy: null };
    }

    let nearestEnemyInRange = null;
    let minDistanceInRange = Infinity;

    let nearestEnemy = null;
    let minDistance = Infinity;

    for (const enemy of enemies) {
      const distance = this.calculateDistance(
        gameObject.gridCol,
        gameObject.gridRow,
        enemy.gridCol,
        enemy.gridRow
      );

      // Update nearest enemy in range
      if (distance <= attackRange && distance < minDistanceInRange) {
        minDistanceInRange = distance;
        nearestEnemyInRange = enemy;
      }

      // Update nearest enemy overall
      if (distance < minDistance) {
        minDistance = distance;
        nearestEnemy = enemy;
      }
    }

    return {
      inRangeEnemy: nearestEnemyInRange,
      anyEnemy: nearestEnemy,
    };
  }

  setNewTarget(gameObject) {
    // Find the nearest enemy (in range or not)
    let result = this.findNearestEnemy(gameObject);

    if (result.inRangeEnemy) {
      // Set the target for attack if enemy is in range
      gameObject.attackTarget = result.inRangeEnemy;
      return true;
    } else if (result.anyEnemy) {
      // If no target in range, set any enemy as move target
      gameObject.attackTarget = result.anyEnemy;
      gameObject.moveTarget = {
        col: result.anyEnemy.gridCol,
        row: result.anyEnemy.gridRow,
      };
      return false;
    } else {
      gameObject.canAct = false;
      if (gameObject.animator.activeAnimation.name !== "idle") {
        gameObject.animator.setAnimation("idle");
      }
      return false;
    }
  }

  calculateDistance(col1, row1, col2, row2) {
    // Use Chebyshev distance for grid-based movement with diagonals
    // This allows diagonal movement to count as 1 distance unit
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
    // Simple damage calculation
    const damage = attacker.attackDamage || 10; // Default damage

    // Apply damage to target if it has health
    if (target && target.health !== undefined) {
      target.health -= damage;

      // Check if target is defeated
      if (target.health <= 0 && !target.isDead) {
        // Set the isDead flag instead of removing the object
        target.isDead = true;
        target.canAct = false;
        attacker.isAttacking = false;

        // Play death animation without looping
        if (
          target.animator &&
          target.animator.activeSpritesheet.animations.death
        ) {
          target.animator.setAnimation("death", false);
        }

        // Immediately look for a new target for the attacker
        this.checkIfTargetIsDead(attacker);
        this.setNewTarget(attacker);
      }
    }
  }

  checkIfTargetIsDead(gameObject) {
    if (gameObject.attackTarget && gameObject.attackTarget.isDead) {
      this.moveAction.cancelMovement(gameObject);
    }
  }
}
