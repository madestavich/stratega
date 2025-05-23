import { MoveAction } from "../../import.js";

export class AttackAction {
  constructor(objectManager) {
    this.objectManager = objectManager;
    this.moveAction = new MoveAction();

    // Кеш для ворогів, згрупованих за командами
    this._enemiesByTeam = new Map();
    this._lastEnemyCacheUpdate = 0;
    this._enemyCacheUpdateInterval = 100; // Оновлювати кеш кожні 200мс
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

  // Метод для оновлення кешу ворогів
  updateEnemiesCache() {
    const now = Date.now();

    // Оновлюємо кеш тільки якщо минув певний час
    if (now - this._lastEnemyCacheUpdate < this._enemyCacheUpdateInterval) {
      return;
    }

    this._lastEnemyCacheUpdate = now;
    this._enemiesByTeam.clear();

    // Групуємо всіх живих юнітів за командами в один прохід
    const teamMap = new Map();

    // Проходимо по всіх об'єктах лише один раз
    for (const obj of this.objectManager.objects) {
      // Перевіряємо чи об'єкт має команду і не мертвий
      if (obj.team && !obj.isDead) {
        // Якщо команди ще немає в мапі, створюємо для неї масив
        if (!teamMap.has(obj.team)) {
          teamMap.set(obj.team, []);
        }
        // Додаємо об'єкт до його команди
        teamMap.get(obj.team).push(obj);
      }
    }

    // Для кожної команди створюємо список ворогів
    // Використовуємо вже згруповані дані замість повторної фільтрації
    for (const [team, units] of teamMap.entries()) {
      const enemies = [];

      // Збираємо ворогів з усіх інших команд
      for (const [otherTeam, otherUnits] of teamMap.entries()) {
        if (otherTeam !== team) {
          enemies.push(...otherUnits);
        }
      }

      this._enemiesByTeam.set(team, enemies);
    }
  }

  // Update method to be called from ActionManager's update
  update(gameObject, deltaTime) {
    // Reduce attack cooldown if it exists
    if (gameObject.attackCooldown && gameObject.attackCooldown > 0) {
      gameObject.attackCooldown -= deltaTime;
    }
  }

  findNearestEnemy(gameObject) {
    const attackRange = gameObject.attackRange || 1;

    // Використовуємо кешовані дані про ворогів
    this.updateEnemiesCache();

    // Отримуємо ворогів для команди цього юніта
    const enemies = this._enemiesByTeam.get(gameObject.team) || [];

    // Якщо ворогів немає, відразу повертаємо результат
    if (enemies.length === 0) {
      return { inRangeEnemy: null, anyEnemy: null };
    }

    let nearestEnemyInRange = null;
    let minDistanceInRange = Infinity;

    let nearestEnemy = null;
    let minDistance = Infinity;

    for (const enemy of enemies) {
      // Calculate the minimum distance between any cell of the attacker and any cell of the enemy
      let minCellDistance = Infinity;

      // Get attacker's occupied cells based on expansion direction
      let attackerCells = this.getOccupiedCells(gameObject);

      // Get enemy's occupied cells based on expansion direction
      let enemyCells = this.getOccupiedCells(enemy);

      // Find minimum distance between any pair of cells
      for (const attackerCell of attackerCells) {
        for (const enemyCell of enemyCells) {
          const distance = this.calculateDistance(
            attackerCell.col,
            attackerCell.row,
            enemyCell.col,
            enemyCell.row
          );

          if (distance < minCellDistance) {
            minCellDistance = distance;
          }
        }
      }

      // Update nearest enemy in range
      if (
        minCellDistance <= attackRange &&
        minCellDistance < minDistanceInRange
      ) {
        minDistanceInRange = minCellDistance;
        nearestEnemyInRange = enemy;
      }

      // Update nearest enemy overall
      if (minCellDistance < minDistance) {
        minDistance = minCellDistance;
        nearestEnemy = enemy;
      }
    }

    return {
      inRangeEnemy: nearestEnemyInRange,
      anyEnemy: nearestEnemy,
    };
  }

  getOccupiedCells(gameObject) {
    const cells = [];
    let startCol = gameObject.gridCol;
    let startRow = gameObject.gridRow;

    // Adjust start position based on expansion direction
    switch (gameObject.expansionDirection) {
      case "topLeft":
        startCol = gameObject.gridCol - (gameObject.gridWidth - 1);
        startRow = gameObject.gridRow - (gameObject.gridHeight - 1);
        break;
      case "topRight":
        startRow = gameObject.gridRow - (gameObject.gridHeight - 1);
        break;
      case "bottomLeft":
        startCol = gameObject.gridCol - (gameObject.gridWidth - 1);
        break;
      case "bottomRight":
        // Default, no need to change
        break;
    }

    // Add all cells occupied by the object
    for (let y = 0; y < gameObject.gridHeight; y++) {
      for (let x = 0; x < gameObject.gridWidth; x++) {
        cells.push({
          col: startCol + x,
          row: startRow + y,
        });
      }
    }

    return cells;
  }

  setNewTarget(gameObject) {
    // Find the nearest enemy (in range or not)
    let result = this.findNearestEnemy(gameObject);

    if (result.inRangeEnemy) {
      // Set the target for attack if enemy is in range
      gameObject.attackTarget = result.inRangeEnemy;
      return true;
    } else if (result.anyEnemy) {
      // Check if the unit can move at all by checking surrounding cells
      const canMove = this.hasFreeCellsAround(gameObject);

      if (canMove) {
        // If no target in range and unit can move, set any enemy as move target
        gameObject.attackTarget = result.anyEnemy;
        gameObject.moveTarget = {
          col: result.anyEnemy.gridCol,
          row: result.anyEnemy.gridRow,
        };
      } else {
        // Unit is surrounded and can't move, but still has an attack target
        gameObject.attackTarget = result.anyEnemy;
        // Don't set moveTarget to avoid pathfinding
      }
      return false;
    } else {
      gameObject.canAct = false;
      if (gameObject.animator.activeAnimation.name !== "idle") {
        gameObject.animator.setAnimation("idle");
      }
      return false;
    }
  }

  // Helper method to check if there are any free cells around the unit
  hasFreeCellsAround(gameObject) {
    // Get grid manager reference - it should be accessible through the objectManager
    const gridManager = this.objectManager.gridManager;
    if (!gridManager) return true; // If we can't check, assume unit can move

    // Directions to check (including diagonals)
    const directions = [
      { dx: -1, dy: -1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
    ];

    // Check each direction
    for (const dir of directions) {
      const checkCol = gameObject.gridCol + dir.dx;
      const checkRow = gameObject.gridRow + dir.dy;

      // Skip if out of bounds
      if (
        checkCol < 0 ||
        checkCol >= gridManager.cols ||
        checkRow < 0 ||
        checkRow >= gridManager.rows
      ) {
        continue;
      }

      // Check if the cell is not occupied (except by the current object)
      if (
        !gridManager.grid[checkRow][checkCol].occupied ||
        gridManager.grid[checkRow][checkCol].object === gameObject
      ) {
        return true; // Found at least one free cell
      }
    }

    return false; // No free cells found
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
