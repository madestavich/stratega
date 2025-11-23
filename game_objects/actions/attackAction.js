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
      const animator = gameObject.animator;
      const isLastFrame =
        animator.frameIndex === animator.activeAnimation.frames.length - 1;

      // ВИПРАВЛЕННЯ: Якщо ціль атаки мертва або відсутня, примусово завершуємо атаку
      if (!gameObject.attackTarget || gameObject.attackTarget.isDead) {
        // Скидаємо стан атаки
        gameObject.isAttacking = false;
        gameObject.isRangedAttack = false;
        gameObject.attackTarget = null;

        // Встановлюємо анімацію idle
        if (
          gameObject.animator &&
          gameObject.animator.activeAnimation.name !== "idle"
        ) {
          gameObject.animator.setAnimation("idle", true);
        }

        return false; // Завершуємо атаку достроково
      }

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
    if (gameObject.isRanged && gameObject.canShootRanged()) {
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
          // Витрачаємо постріл
          gameObject.useShot();
        } else {
          // For melee attack, deal damage directly
          this.dealDamage(gameObject, gameObject.attackTarget);

          // Check for area attack
          if (gameObject.areaAttack && gameObject.areaAttackParameters) {
            const areaTargets = this.getAreaAttackTargets(
              gameObject,
              gameObject.attackTarget
            );

            areaTargets.forEach((targetInfo) => {
              this.dealDamage(
                gameObject,
                targetInfo.target,
                targetInfo.damageMultiplier
              );
            });
          }
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
    let minManhattan = Infinity;

    for (const obj of this.getAllObjects()) {
      // Skip if dead, no team, or same team
      if (obj.isDead || !obj.team || obj.team === gameObject.team) {
        continue;
      }
      const distance = this.getMinDistanceBetweenObjects(gameObject, obj);

      // Calculate Manhattan distance as tiebreaker (prefer straight lines)
      const dx = Math.abs(obj.gridCol - gameObject.gridCol);
      const dy = Math.abs(obj.gridRow - gameObject.gridRow);
      const manhattanDist = dx + dy;

      // Prefer enemies that are closer, or at same distance but in straight line
      if (
        distance < minDistance ||
        (distance === minDistance && manhattanDist < minManhattan)
      ) {
        minDistance = distance;
        minManhattan = manhattanDist;
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
    gameObject.lookDirection = { dx: dirX, dy: dirY };
  }

  dealDamage(attacker, target, damageMultiplier = 1) {
    // Skip if no target or target is already dead
    if (!target || target.isDead || target.health === undefined) {
      return;
    }

    // Apply damage
    const baseDamage = attacker.attackDamage || 10;
    const damage = baseDamage * damageMultiplier;
    target.health -= damage;

    if (damageMultiplier !== 1) {
      console.log(
        "[AREA DAMAGE]",
        attacker.name,
        "hit",
        target.name,
        "for",
        damage,
        "(x" + damageMultiplier + ")",
        "HP left:",
        target.health
      );
    }

    // Vampirism: heal attacker if enabled
    if (attacker.vampirism && attacker.vampirismPercent > 0) {
      const healAmount = (damage * attacker.vampirismPercent) / 100;
      attacker.health = Math.min(
        attacker.health + healAmount,
        attacker.maxHealth
      );
    }

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

  // Get secondary targets for area attack
  getAreaAttackTargets(attacker, primaryTarget) {
    if (!attacker.areaAttackParameters || !primaryTarget) {
      return [];
    }

    const params = attacker.areaAttackParameters;
    const pattern = params.pattern || "adjacent";
    const damageMultiplier = params.damageMultiplier || 0.5;

    // Calculate area coordinates based on pattern
    const areaCells = this.calculateAreaPattern(
      primaryTarget,
      attacker,
      pattern,
      params.range || {}
    );

    // Find targets in those cells
    const targets = this.findTargetsInCells(
      areaCells,
      attacker.team,
      primaryTarget
    );

    // Return targets with damage multiplier
    return targets.map((target) => ({
      target: target,
      damageMultiplier: damageMultiplier,
    }));
  }

  // Calculate area attack pattern coordinates
  calculateAreaPattern(primaryTarget, attacker, pattern, range) {
    const cells = [];
    const targetCol = primaryTarget.gridCol;
    const targetRow = primaryTarget.gridRow;
    const lookDir = attacker.lookDirection || { dx: 1, dy: 0 };

    switch (pattern) {
      case "line":
        // Attack in a straight line in the direction of lookDirection
        const horizontalRange = range.horizontal || 1;
        const verticalRange = range.vertical || 1;

        for (let i = 1; i <= horizontalRange; i++) {
          cells.push({
            col: targetCol + lookDir.dx * i,
            row: targetRow + lookDir.dy * i,
          });
        }
        break;

      case "triangle":
        // Triangle/cone pattern - expands both forward and sideways
        const hRange = range.horizontal || 1;

        for (let depth = 1; depth <= hRange; depth++) {
          for (let width = -depth; width <= depth; width++) {
            if (Math.abs(lookDir.dx) > Math.abs(lookDir.dy)) {
              // Horizontal cone - expands horizontally (forward) and vertically (width)
              cells.push({
                col: targetCol + lookDir.dx * depth,
                row: targetRow + width,
              });
            } else {
              // Vertical cone - expands vertically (forward) and horizontally (width)
              cells.push({
                col: targetCol + width,
                row: targetRow + lookDir.dy * depth,
              });
            }
          }
        }
        break;

      case "adjacent":
        // All cells adjacent to target
        const adjRange = range.horizontal || 1;
        for (let dc = -adjRange; dc <= adjRange; dc++) {
          for (let dr = -adjRange; dr <= adjRange; dr++) {
            if (dc === 0 && dr === 0) continue; // Skip target cell
            cells.push({ col: targetCol + dc, row: targetRow + dr });
          }
        }
        break;

      case "custom":
        // Custom offsets from parameters
        if (params.customOffsets && Array.isArray(params.customOffsets)) {
          params.customOffsets.forEach((offset) => {
            cells.push({
              col: targetCol + offset.col,
              row: targetRow + offset.row,
            });
          });
        }
        break;

      default:
        // Default to adjacent
        cells.push(
          { col: targetCol + 1, row: targetRow },
          { col: targetCol - 1, row: targetRow },
          { col: targetCol, row: targetRow + 1 },
          { col: targetCol, row: targetRow - 1 }
        );
    }

    return cells;
  }

  // Find enemy targets in specified cells
  findTargetsInCells(cells, attackerTeam, excludeTarget) {
    const targets = [];
    const allObjects = this.getAllObjects();

    cells.forEach((cell) => {
      allObjects.forEach((obj) => {
        // Skip if same object as excluded target
        if (excludeTarget && obj === excludeTarget) {
          return;
        }

        // Skip if dead, no team, or same team
        if (obj.isDead || !obj.team || obj.team === attackerTeam) {
          return;
        }

        // Check if object occupies this cell
        if (this.objectOccupiesCell(obj, cell.col, cell.row)) {
          // Avoid duplicates
          if (!targets.includes(obj)) {
            targets.push(obj);
          }
        }
      });
    });

    return targets;
  }

  // Check if object occupies a specific cell
  objectOccupiesCell(obj, col, row) {
    for (let c = 0; c < obj.gridWidth; c++) {
      for (let r = 0; r < obj.gridHeight; r++) {
        let cellCol, cellRow;

        switch (obj.expansionDirection) {
          case "bottomRight":
            cellCol = obj.gridCol + c;
            cellRow = obj.gridRow + r;
            break;
          case "topRight":
            cellCol = obj.gridCol + c;
            cellRow = obj.gridRow - r;
            break;
          case "bottomLeft":
            cellCol = obj.gridCol - c;
            cellRow = obj.gridRow + r;
            break;
          case "topLeft":
            cellCol = obj.gridCol - c;
            cellRow = obj.gridRow - r;
            break;
          default:
            cellCol = obj.gridCol + c;
            cellRow = obj.gridRow + r;
        }

        if (cellCol === col && cellRow === row) {
          return true;
        }
      }
    }
    return false;
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
    if (gameObject.isRanged && gameObject.canShootRanged()) {
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
