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

    // Calculate distance to enemy
    const distance = this.calculateDistance(
      gameObject.gridCol,
      gameObject.gridRow,
      nearestEnemy.gridCol,
      nearestEnemy.gridRow
    );

    // Check if enemy is in attack range
    const attackRange = gameObject.attackRange || 1;
    if (distance <= attackRange) {
      // Enemy in range - set as attack target
      gameObject.attackTarget = nearestEnemy;
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
        // Deal damage to the target
        this.dealDamage(gameObject, gameObject.attackTarget);
        // Reset attack state
        gameObject.isAttacking = false;
        // Set attack cooldown
        gameObject.attackCooldown = gameObject.attackSpeed * 1000;
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
      gameObject.animator.setAnimation("attack", false);
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
    let nearestEnemy = null;
    let minDistance = Infinity;

    // Find all enemies (units from other teams)
    for (const obj of this.objectManager.objects) {
      // Skip if dead, same team, or no team
      if (obj.isDead || !obj.team || obj.team === gameObject.team) {
        continue;
      }

      // Calculate distance
      const distance = this.calculateDistance(
        gameObject.gridCol,
        gameObject.gridRow,
        obj.gridCol,
        obj.gridRow
      );

      // Update nearest enemy
      if (distance < minDistance) {
        minDistance = distance;
        nearestEnemy = obj;
      }
    }

    return nearestEnemy;
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
}
