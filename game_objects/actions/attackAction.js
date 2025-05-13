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

  execute(gameObject) {
    // If already attacking and on last frame
    if (gameObject.isAttacking && gameObject.animator.hasFinished) {
      // Deal damage to the target
      this.dealDamage(gameObject, gameObject.attackTarget);

      // Reset attack state
      gameObject.isAttacking = false;

      // Set attack cooldown based on attack speed
      gameObject.attackCooldown = gameObject.attackSpeed * 1000; // Default 1 second cooldown

      // Return to idle animation
      if (!gameObject.isMoving) {
        gameObject.animator.setAnimation("idle", true);
      } else {
        // If moving, set move animation
        gameObject.animator.setAnimation("move", true);
      }

      return true;
    }

    // Start a new attack
    if (!gameObject.isAttacking) {
      // Set attacking state
      gameObject.isAttacking = true;

      // Look at the target
      this.setLookDirection(gameObject, gameObject.attackTarget);

      // Play attack animation
      setTimeout(() => {
        // Play attack animation
        gameObject.animator.setAnimation("attack", false, "idle");
      }, 0);

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
      (obj) => obj.team && obj.team !== gameObject.team && !obj.isDead
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
      (obj) => obj.team && obj.team !== gameObject.team && !obj.isDead
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

        // Play death animation without looping
        if (
          target.animator &&
          target.animator.activeSpritesheet.animations.death
        ) {
          target.animator.setAnimation("death", false);
        }

        // Clear the move target so unit doesn't move to the defeated target's position
        if (
          attacker.moveTarget &&
          attacker.moveTarget.col === target.gridCol &&
          attacker.moveTarget.row === target.gridRow
        ) {
          attacker.moveTarget = null;
        }

        // Immediately look for a new target
        const newTarget = this.findNearestEnemy(attacker);
        if (newTarget) {
          attacker.moveTarget = {
            col: newTarget.gridCol,
            row: newTarget.gridRow,
          };
        }
      }
    }
  }
}
