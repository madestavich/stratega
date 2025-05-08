export class AttackAction {
  constructor(objectManager) {
    this.objectManager = objectManager;
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

    // Find the nearest enemy unit in attack range
    const target = this.findNearestEnemyInRange(gameObject);

    if (target) {
      // Set the target for attack
      gameObject.attackTarget = target;
      return true;
    } else {
      // If no target in range, find any enemy and set as move target
      const anyEnemy = this.findNearestEnemy(gameObject);
      if (anyEnemy) {
        gameObject.moveTarget = {
          col: anyEnemy.gridCol,
          row: anyEnemy.gridRow,
        };
      }
      return false;
    }
  }

  execute(gameObject, deltaTime, allowedObstacleTypes) {
    // If already attacking and on last frame
    if (gameObject.isAttacking && gameObject.animator.hasFinished) {
      // Deal damage to the target
      this.dealDamage(gameObject, gameObject.attackTarget);

      // Reset attack state
      gameObject.isAttacking = false;

      // Set attack cooldown based on attack speed
      gameObject.attackCooldown = gameObject.attackSpeed || 1000; // Default 1 second cooldown

      // Return to idle animation
      gameObject.animator.setAnimation("idle", true, "idle");

      return true;
    }

    // Start a new attack
    if (!gameObject.isAttacking) {
      // Set attacking state
      gameObject.isAttacking = true;

      // Look at the target
      this.setLookDirection(gameObject, gameObject.attackTarget);

      // Play attack animation
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

  findNearestEnemyInRange(gameObject) {
    const attackRange = gameObject.attackRange || 1; // Default range is 1 cell
    const enemies = this.objectManager.objects.filter(
      (obj) => obj.team && obj.team !== gameObject.team
    );

    let nearestEnemy = null;
    let minDistance = Infinity;

    for (const enemy of enemies) {
      const distance = this.calculateDistance(
        gameObject.gridCol,
        gameObject.gridRow,
        enemy.gridCol,
        enemy.gridRow
      );

      if (distance <= attackRange && distance < minDistance) {
        minDistance = distance;
        nearestEnemy = enemy;
      }
    }

    return nearestEnemy;
  }

  findNearestEnemy(gameObject) {
    const enemies = this.objectManager.objects.filter(
      (obj) => obj.team && obj.team !== gameObject.team
    );

    let nearestEnemy = null;
    let minDistance = Infinity;

    for (const enemy of enemies) {
      const distance = this.calculateDistance(
        gameObject.gridCol,
        gameObject.gridRow,
        enemy.gridCol,
        enemy.gridRow
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestEnemy = enemy;
      }
    }

    return nearestEnemy;
  }

  calculateDistance(col1, row1, col2, row2) {
    // Manhattan distance for grid-based movement
    return Math.abs(col1 - col2) + Math.abs(row1 - row2);
  }

  setLookDirection(gameObject, target) {
    // Set look direction based on target position as a vector
    if (target.gridCol > gameObject.gridCol) {
      gameObject.lookDirection = { x: 1, y: 0 }; // Right direction
    } else if (target.gridCol < gameObject.gridCol) {
      gameObject.lookDirection = { x: -1, y: 0 }; // Left direction
    } else if (target.gridRow > gameObject.gridRow) {
      gameObject.lookDirection = { x: 0, y: 1 }; // Down direction
    } else if (target.gridRow < gameObject.gridRow) {
      gameObject.lookDirection = { x: 0, y: -1 }; // Up direction
    } else {
      // If they're in the same position, keep current look direction
      // or set a default if none exists
      gameObject.lookDirection = gameObject.lookDirection || { x: 1, y: 0 };
    }
  }

  dealDamage(attacker, target) {
    // Simple damage calculation
    const damage = attacker.attackDamage || 10; // Default damage

    // Apply damage to target if it has health
    if (target && target.health !== undefined) {
      target.health -= damage;

      // Check if target is defeated
      if (target.health <= 0) {
        // Handle unit defeat (could be handled by the object manager)
        this.objectManager.removeObject(target);
      }
    }
  }
}
