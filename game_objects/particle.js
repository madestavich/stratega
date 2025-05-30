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
    this.trajectoryType = particleConfig.trajectoryType || "direct"; // "direct" or "arc"
    this.arcHeight = particleConfig.arcHeight || 50; // Controls the height of the arc

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

    // Damage and effect properties
    this.damage = particleConfig.damage || 0;
    this.effectRadius = particleConfig.effectRadius || 0;

    // Setup animator and renderer
    this.animator = new Animator(this.spriteConfig);
    this.animator.setSpritesheet(this.spriteConfig.spritesheet);
    this.animator.setAnimation(this.spriteConfig.spritesheet.animations[0]);

    this.renderer = new Renderer(this.ctx, this.animator);

    // Flag to indicate if particle has reached its target
    this.hasReachedTarget = false;
  }

  update(dt) {
    // If we have a target, update target position (in case target is moving)
    if (this.target && !this.target.isDead) {
      this.targetX = this.target.x;
      this.targetY = this.target.y;
    }

    if (this.hasReachedTarget) return;

    // Calculate movement based on trajectory type
    if (this.trajectoryType === "direct") {
      this.updateDirectTrajectory(dt);
    } else if (this.trajectoryType === "arc") {
      this.updateArcTrajectory(dt);
    }

    // Check if we've reached the target
    const distanceToTarget = Math.sqrt(
      Math.pow(this.targetX - this.x, 2) + Math.pow(this.targetY - this.y, 2)
    );

    if (distanceToTarget < 5) {
      this.hasReachedTarget = true;
      // Here you could trigger impact effects or damage calculations
    }

    // Update animation
    this.animator.nextFrame();
  }

  updateDirectTrajectory(dt) {
    // Calculate direction vector to target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;

    // Normalize the vector
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 0) {
      const normalizedDx = dx / distance;
      const normalizedDy = dy / distance;

      // Update position
      this.x += normalizedDx * this.moveSpeed * (dt / 16.67);
      this.y += normalizedDy * this.moveSpeed * (dt / 16.67);

      // Update move vector for rendering
      this.moveVector = { dx: normalizedDx, dy: normalizedDy };
    }
  }

  updateArcTrajectory(dt) {
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

    // Debug visualization for trajectory
    if (this.trajectoryType === "arc" && false) {
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

  // Method to check if particle hit a target
  checkCollision(gameObjects) {
    if (this.hasReachedTarget) return;

    for (const obj of gameObjects) {
      // Skip objects from the same team if needed
      // if (obj.team === this.sourceTeam) continue;

      const distance = Math.sqrt(
        Math.pow(obj.x - this.x, 2) + Math.pow(obj.y - this.y, 2)
      );

      // Check if within collision radius
      if (distance < (obj.collisionRadius || 20)) {
        this.hasReachedTarget = true;
        // Apply damage or effects
        if (typeof obj.takeDamage === "function") {
          obj.takeDamage(this.damage);
        }
        break;
      }
    }
  }
}
