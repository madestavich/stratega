import { Animator } from "../import.js";
import { Renderer } from "../import.js";

export class Particle {
  constructor(
    ctx,
    spriteConfig,
    particleConfig,
    x,
    y,
    target,
    gridManager,
    objectManager = null,
    sourceTeam = null
  ) {
    this.ctx = ctx;
    this.spriteConfig = spriteConfig;
    this.x = x;
    this.y = y;
    this.gridManager = gridManager;
    this.objectManager = objectManager;
    this.sourceTeam = sourceTeam;

    // Particle specific properties
    this.moveSpeed = particleConfig.moveSpeed || 2;
    this.moveVector = particleConfig.moveVector || { dx: 0, dy: 0 };
    this.type = particleConfig.type || "default";

    // Target properties
    this.target = target || null;
    this.arcHeight = particleConfig.arcHeight || 30; // Controls the height of the arc

    // Track progress for arc trajectory
    this.progress = 0;
    this.startX = x;
    this.startY = y;
    this.targetX = this.target ? this.target.x : x;
    this.targetY = this.target ? this.target.y : y;

    // Calculate total distance for progress tracking
    this.totalDistance = this.target
      ? Math.sqrt(
          Math.pow(this.targetX - this.startX, 2) +
            Math.pow(this.targetY - this.startY, 2)
        )
      : 0;

    // Store initial distance for progress calculation (won't change)
    this.initialTotalDistance = this.totalDistance;

    this.damage = particleConfig.damage;
    this.effectRadius = particleConfig.effectRadius || 0;

    // AoE parameters
    this.aoeRadius = particleConfig.aoeRadius || 0; // Радіус AoE в клітинках сітки
    this.aoeDamageMultiplier = particleConfig.aoeDamageMultiplier || 0.5; // Множник пошкодження для AoE

    // Hit effect parameters
    this.hitEffect = particleConfig.hitEffect || null; // Назва ефекту при попаданні

    // Setup animator and renderer
    this.animator = new Animator(this.spriteConfig);

    this.animator.setSpritesheet(Object.keys(spriteConfig)[0]);
    this.animator.setAnimation("bullet");

    this.renderer = new Renderer(this.ctx, this.animator);

    // Flag to indicate if particle has reached its target
    this.hasReachedTarget = false;
  }

  update(dt) {
    if (this.target && !this.target.isDead) {
      // Оновлюємо тільки X-координату цілі, якщо вона рухається
      this.targetX = this.target.x;

      // НЕ оновлюємо Y-координату, щоб зберегти наше налаштування для центру цілі
      // Якщо ми не встановили targetY раніше, встановлюємо його на центр цілі
      if (this.targetY === this.target.y) {
        const targetFrame = this.target.animator.activeFrame;
        const targetHeight = targetFrame.height;
        this.targetY = this.target.y - targetHeight / 2;
      }
      // Оновлюємо totalDistance якщо targetX або targetY змінилися
      this.totalDistance = Math.sqrt(
        Math.pow(this.targetX - this.startX, 2) +
          Math.pow(this.targetY - this.startY, 2)
      );
    }

    if (this.hasReachedTarget) return;

    this.updateArcTrajectory(dt / 2);

    // Check if we've completed the trajectory (progress reached 1)
    if (this.progress >= 1) {
      this.hasReachedTarget = true;

      // Spawn hit effect at impact location
      this.spawnHitEffect();

      // Apply damage to primary target if it exists
      if (this.target && !this.target.isDead) {
        this.applyDamageToUnit(this.target, this.damage);
      }

      // Apply AoE damage if configured
      if (this.aoeRadius > 0 && this.objectManager) {
        this.applyAoeDamage();

        // Debug: visualize AoE impact area
        if (
          window.gameManager &&
          window.gameManager.debugManager &&
          window.gameManager.debugManager.isLayerEnabled("aoeCells")
        ) {
          const impactCol = Math.floor(this.x / this.gridManager.cellWidth);
          const impactRow = Math.floor(this.y / this.gridManager.cellHeight);
          const aoeCells = this.getAoeCircleCells(
            impactCol,
            impactRow,
            this.aoeRadius
          );
          window.gameManager.debugManager.setAoECells(aoeCells);

          // Починаємо затухання після короткої затримки
          setTimeout(() => {
            if (window.gameManager && window.gameManager.debugManager) {
              window.gameManager.debugManager.clearAoECells();
            }
          }, 500);
        }
      }
    }
  }

  // Apply damage to a single unit
  applyDamageToUnit(unit, damage) {
    if (!unit || unit.isDead) return;

    unit.health -= damage;
    if (unit.health <= 0) {
      unit.health = 0;
      unit.isDead = true;
      unit.canAct = false;

      // Reset all active states on the dying target
      unit.isAttacking = false;
      unit.isRangedAttack = false;
      unit.attackTarget = null;
      unit.attackDamageDealt = false;
      unit.isMoving = false;
      unit.isTeleporting = false;
      unit.teleportState = null;
      unit.teleportTarget = null;
      unit.moveTarget = null;
      unit.currentPath = null;

      unit.animator.setAnimation("death", false);
    }
  }

  // Apply AoE damage to all enemies in radius (grid-based circle)
  applyAoeDamage() {
    if (!this.objectManager || !this.gridManager) return;

    // Get the grid cell where the projectile landed
    const impactCol = Math.floor(this.x / this.gridManager.cellWidth);
    const impactRow = Math.floor(this.y / this.gridManager.cellHeight);

    // Calculate which cells are within the AoE circle
    const aoeCells = this.getAoeCircleCells(
      impactCol,
      impactRow,
      this.aoeRadius
    );

    const allObjects = [
      ...this.objectManager.objects,
      ...this.objectManager.enemyObjects,
    ];

    const aoeDamage = this.damage * this.aoeDamageMultiplier;

    for (const obj of allObjects) {
      // Skip dead units, units without team, same team, and the primary target
      if (
        obj.isDead ||
        !obj.team ||
        obj.team === this.sourceTeam ||
        obj === this.target
      ) {
        continue;
      }

      // Check if any of the object's cells are within AoE
      if (this.isObjectInAoeCells(obj, aoeCells)) {
        this.applyDamageToUnit(obj, aoeDamage);
      }
    }
  }

  // Get all cells that form a circle around the impact point
  getAoeCircleCells(centerCol, centerRow, radius) {
    const cells = [];

    for (let dCol = -radius; dCol <= radius; dCol++) {
      for (let dRow = -radius; dRow <= radius; dRow++) {
        // Check if this cell is within the circle (using Euclidean distance)
        const distance = Math.sqrt(dCol * dCol + dRow * dRow);
        if (distance <= radius) {
          const col = centerCol + dCol;
          const row = centerRow + dRow;

          // Make sure cell is within grid bounds
          if (
            col >= 0 &&
            col < this.gridManager.cols &&
            row >= 0 &&
            row < this.gridManager.rows
          ) {
            cells.push({ col, row });
          }
        }
      }
    }

    return cells;
  }

  // Check if any cell of the object is within AoE cells
  isObjectInAoeCells(obj, aoeCells) {
    // Get all cells occupied by the object
    const objCells = this.getObjectCells(obj);

    // Check if any object cell is in the AoE cells
    for (const objCell of objCells) {
      for (const aoeCell of aoeCells) {
        if (objCell.col === aoeCell.col && objCell.row === aoeCell.row) {
          return true;
        }
      }
    }

    return false;
  }

  // Get all cells occupied by an object
  getObjectCells(obj) {
    const cells = [];
    const { gridCol, gridRow, gridWidth, gridHeight, expansionDirection } = obj;

    let startCol = gridCol;
    let startRow = gridRow;

    // Adjust start position based on expansion direction
    switch (expansionDirection) {
      case "topLeft":
        startCol = gridCol - (gridWidth - 1);
        startRow = gridRow - (gridHeight - 1);
        break;
      case "topRight":
        startRow = gridRow - (gridHeight - 1);
        break;
      case "bottomLeft":
        startCol = gridCol - (gridWidth - 1);
        break;
      case "bottomRight":
      default:
        break;
    }

    for (let row = startRow; row < startRow + gridHeight; row++) {
      for (let col = startCol; col < startCol + gridWidth; col++) {
        cells.push({ col, row });
      }
    }

    return cells;
  }

  // Spawn hit effect at impact location
  spawnHitEffect() {
    console.log("[spawnHitEffect] Called, hitEffect:", this.hitEffect);
    console.log("[spawnHitEffect] objectManager:", !!this.objectManager);
    console.log(
      "[spawnHitEffect] effectManager:",
      !!this.objectManager?.effectManager
    );

    if (
      !this.hitEffect ||
      !this.objectManager ||
      !this.objectManager.effectManager
    ) {
      console.log("[spawnHitEffect] Early return - missing dependencies");
      return;
    }

    console.log(
      "[spawnHitEffect] Creating effect at position:",
      this.x,
      this.y
    );
    const effect = this.objectManager.effectManager.createEffectAtPosition(
      this.x,
      this.y,
      this.hitEffect,
      {
        zMode: "over",
        autoRemove: true,
      }
    );
    console.log("[spawnHitEffect] Effect created:", effect);
  }

  updateArcTrajectory(dt) {
    // Calculate direction vector to target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;

    // Calculate current distance to target
    const currentDistance = Math.sqrt(dx * dx + dy * dy);

    // Update progress (0 to 1) using initial distance for consistent speed
    const stepDistance = this.moveSpeed * (dt / 16.67);
    this.progress += stepDistance / this.initialTotalDistance;
    this.progress = Math.min(this.progress, 1); // Clamp to 1

    // Calculate new position using parametric equation for parabola
    const newX = this.startX + (this.targetX - this.startX) * this.progress;
    const newY = this.startY + (this.targetY - this.startY) * this.progress;

    // Add arc height at the middle of the trajectory
    const arcOffset = Math.sin(this.progress * Math.PI) * this.arcHeight;

    // Update position
    this.x = newX;
    this.y = newY - arcOffset; // Subtract because y increases downward in canvas

    // Update move vector for rendering
    if (currentDistance > 0) {
      this.moveVector = {
        dx: dx / currentDistance,
        dy:
          dy / currentDistance -
          (Math.cos(this.progress * Math.PI) * this.arcHeight) /
            currentDistance,
      };
    }
  }

  draw() {
    this.renderer.draw(this.x, this.y, this.moveVector);
    if (false) {
      // Set to true to enable debug visualization
      this.ctx.save();
      this.ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
      this.ctx.beginPath();
      this.ctx.moveTo(this.startX, this.startY);

      // Draw the arc path
      for (let t = 0; t <= 1; t += 0.05) {
        const px = this.startX + (this.targetX - this.startX) * t;
        const py =
          this.startY +
          (this.targetY - this.startY) * t -
          Math.sin(t * Math.PI) * this.arcHeight;
        this.ctx.lineTo(px, py);
      }

      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  checkCollision(gameObjects) {
    if (this.hasReachedTarget) return;

    // First check if we've reached our specific target
    if (this.target && !this.target.isDead) {
      // Use targetY (center of sprite) instead of target.y (feet position)
      const distance = Math.sqrt(
        Math.pow(this.targetX - this.x, 2) + Math.pow(this.targetY - this.y, 2)
      );

      // Check if within collision radius of the target
      if (distance < 20) {
        this.hasReachedTarget = true;

        // Apply damage to the specific target
        if (this.target.health !== undefined) {
          this.target.health -= this.damage;

          // Check if target is defeated
          if (this.target.health <= 0 && !this.target.isDead) {
            this.target.isDead = true;
            this.target.canAct = false;

            // Reset all active states on the dying target
            this.target.isAttacking = false;
            this.target.isRangedAttack = false;
            this.target.attackTarget = null;
            this.target.attackDamageDealt = false;
            this.target.isMoving = false;
            this.target.isTeleporting = false;
            this.target.teleportState = null;
            this.target.teleportTarget = null;
            this.target.moveTarget = null;
            this.target.currentPath = null;

            // Play death animation if available
            if (
              this.target.animator &&
              this.target.animator.activeSpritesheet.animations.death
            ) {
              this.target.animator.setAnimation("death", false);
            }
          }
        }
        return;
      }
    }

    // Only check for other collisions if we don't have a specific target
    // or if we want area of effect damage
    if (!this.target || this.effectRadius > 0) {
      for (const obj of gameObjects) {
        // Skip if it's our specific target (already checked)
        if (obj === this.target) continue;

        // Skip objects from the same team if needed
        // if (obj.team === this.sourceTeam) continue;

        const distance = Math.sqrt(
          Math.pow(obj.x - this.x, 2) + Math.pow(obj.y - this.y, 2)
        );

        // Check if within collision radius
        if (distance < (obj.collisionRadius || 20)) {
          this.hasReachedTarget = true;

          // Apply damage or effects
          if (obj.health !== undefined && !obj.isDead) {
            obj.health -= this.damage;

            // Check if target is defeated
            if (obj.health <= 0) {
              obj.isDead = true;
              obj.canAct = false;

              // Reset all active states on the dying target
              obj.isAttacking = false;
              obj.isRangedAttack = false;
              obj.attackTarget = null;
              obj.attackDamageDealt = false;
              obj.isMoving = false;
              obj.isTeleporting = false;
              obj.teleportState = null;
              obj.teleportTarget = null;
              obj.moveTarget = null;
              obj.currentPath = null;

              // Play death animation if available
              if (
                obj.animator &&
                obj.animator.activeSpritesheet.animations.death
              ) {
                obj.animator.setAnimation("death", false);
              }
            }
          }
          break;
        }
      }
    }
  }
}
