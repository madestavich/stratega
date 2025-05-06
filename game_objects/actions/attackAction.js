export class AttackAction {
  constructor(objectManager) {
    this.objectManager = objectManager;
    this.attackTimers = new Map(); // Store attack cooldown timers for each object
  }

  // Check if the attack action can be executed
  canExecute(gameObject, targetObject) {
    // Check if target exists
    if (!targetObject) {
      return false;
    }

    // Check if target is an enemy (different team)
    if (gameObject.team === targetObject.team) {
      return false;
    }

    // Check if the object has attack range defined
    if (!gameObject.attackRange) {
      return false;
    }

    // Check if attack is on cooldown
    const attackTimer = this.attackTimers.get(gameObject.id);
    if (attackTimer && attackTimer > 0) {
      return false;
    }

    // Calculate distance between attacker and target
    const distance = this.calculateGridDistance(
      gameObject.gridCol,
      gameObject.gridRow,
      targetObject.gridCol,
      targetObject.gridRow
    );

    // Check if target is within attack range
    return distance <= gameObject.attackRange;
  }

  // Calculate grid distance between two points
  calculateGridDistance(col1, row1, col2, row2) {
    // Manhattan distance
    return Math.abs(col1 - col2) + Math.abs(row1 - row2);
  }

  // Execute the attack action
  execute(gameObject, deltaTime) {
    if (!gameObject.attackTarget) {
      return false;
    }

    // Check if we can attack the target
    if (!this.canExecute(gameObject, gameObject.attackTarget)) {
      // If we can't attack because of range or other reasons (not cooldown)
      if (!this.attackTimers.get(gameObject.id)) {
        // Clear attack target if it's no longer valid
        gameObject.attackTarget = null;
      }
      return false;
    }

    // Set the look direction towards the target
    this.setLookDirection(gameObject, gameObject.attackTarget);

    // Set the attack animation if available
    if (gameObject.animator && gameObject.animator.hasAnimation("attack")) {
      gameObject.animator.setAnimation("attack", true, "idle");
    }

    // Apply damage to the target
    this.applyDamage(gameObject, gameObject.attackTarget);

    // Set attack cooldown based on attack speed
    const attackSpeed = gameObject.attackSpeed || 1; // Attacks per second
    const cooldownTime = 1000 / attackSpeed; // Convert to milliseconds
    this.attackTimers.set(gameObject.id, cooldownTime);

    return true;
  }

  // Update attack timers
  update(deltaTime) {
    // Update all attack timers
    for (const [objectId, timer] of this.attackTimers.entries()) {
      const newTimer = timer - deltaTime;
      if (newTimer <= 0) {
        this.attackTimers.delete(objectId);
      } else {
        this.attackTimers.set(objectId, newTimer);
      }
    }
  }

  // Set the look direction towards the target
  setLookDirection(gameObject, targetObject) {
    // Calculate direction vector
    const dx = targetObject.gridCol - gameObject.gridCol;
    const dy = targetObject.gridRow - gameObject.gridRow;

    // Determine the primary direction (simplistic approach)
    if (Math.abs(dx) > Math.abs(dy)) {
      gameObject.lookDirection = dx > 0 ? "right" : "left";
    } else {
      gameObject.lookDirection = dy > 0 ? "down" : "up";
    }
  }

  // Apply damage to the target
  applyDamage(attacker, target) {
    // Check if target has health
    if (typeof target.health !== "undefined") {
      // Calculate damage (can be expanded with more complex logic)
      const damage = attacker.attackDamage || 1;

      // Apply damage
      target.health -= damage;

      // Check if target is defeated
      if (target.health <= 0) {
        // Handle target defeat
        this.objectManager.removeObject(target);
      }
    }
  }

  // Find nearest enemy within attack range
  findNearestEnemy(gameObject) {
    let nearestEnemy = null;
    let shortestDistance = Infinity;

    for (const obj of this.objectManager.objects) {
      // Skip if not an enemy
      if (obj.team === gameObject.team || obj === gameObject) {
        continue;
      }

      // Calculate distance
      const distance = this.calculateGridDistance(
        gameObject.gridCol,
        gameObject.gridRow,
        obj.gridCol,
        obj.gridRow
      );

      // Update nearest enemy if this one is closer and within attack range
      if (distance <= gameObject.attackRange && distance < shortestDistance) {
        nearestEnemy = obj;
        shortestDistance = distance;
      }
    }

    return nearestEnemy;
  }

  // Set attack target
  setAttackTarget(gameObject, targetObject) {
    // Validate target
    if (!targetObject || gameObject.team === targetObject.team) {
      return false;
    }

    gameObject.attackTarget = targetObject;
    return true;
  }
}
