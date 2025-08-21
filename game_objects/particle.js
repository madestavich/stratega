import { Animator } from "../import.js";
import { Renderer } from "../import.js";

export class Particle {
  constructor(ctx, spriteConfig, particleConfig, x, y, target, gridManager) {
    this.ctx = ctx;
    this.spriteConfig = spriteConfig;
    this.x = x;
    this.y = y;
    this.gridManager = gridManager;

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

    this.damage = particleConfig.damage;
    this.effectRadius = particleConfig.effectRadius || 0;

    // Setup animator and renderer
    this.animator = new Animator(this.spriteConfig);
    console.log(this);

    this.animator.setSpritesheet(Object.keys(spriteConfig)[0]);
    this.animator.setAnimation("bullet");

    this.renderer = new Renderer(this.ctx, this.animator);

    // Flag to indicate if particle has reached its target
    this.hasReachedTarget = false;
  }

  update(dt) {
    console.log("Particle update dt:", dt);
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

    // Check if we've reached the target
    const distanceToTarget = Math.sqrt(
      Math.pow(this.targetX - this.x, 2) + Math.pow(this.targetY - this.y, 2)
    );

    if (distanceToTarget < 5) {
      this.hasReachedTarget = true;
      // Apply damage to target if it exists
      if (this.target && !this.target.isDead) {
        this.target.health -= this.damage;
        if (this.target.health <= 0) {
          this.target.health = 0;
          this.target.isDead = true;
          this.target.animator.setAnimation("death", false);
        }
      }
    }
  }

  updateArcTrajectory(dt) {
    console.log("Particle updateArcTrajectory dt:", dt);
    // Calculate direction vector to target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;

    // Calculate current distance to target
    const currentDistance = Math.sqrt(dx * dx + dy * dy);

    // Update progress (0 to 1)
    const stepDistance = this.moveSpeed * (dt / 16.67);
    this.progress += stepDistance / this.totalDistance;
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
      const distance = Math.sqrt(
        Math.pow(this.target.x - this.x, 2) +
          Math.pow(this.target.y - this.y, 2)
      );

      // Check if within collision radius of the target
      if (distance < 70) {
        this.hasReachedTarget = true;
        console.log(`Particle hit target! Damage: ${this.damage}`); // Add debug log

        // Apply damage to the specific target
        if (this.target.health !== undefined) {
          console.log(`Target health before: ${this.target.health}`); // Debug log
          this.target.health -= this.damage;
          console.log(`Target health after: ${this.target.health}`); // Debug log

          // Check if target is defeated
          if (this.target.health <= 0 && !this.target.isDead) {
            console.log(`Target defeated!`); // Debug log
            this.target.isDead = true;
            this.target.canAct = false;

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
