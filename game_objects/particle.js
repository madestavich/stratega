import { Animator } from "../import.js";
import { Renderer } from "../import.js";

export class Particle {
  constructor(ctx, spriteConfig, particleConfig, x, y, gridManager) {
    this.ctx = ctx;
    this.spriteConfig = spriteConfig;
    this.x = x;
    this.y = y;
    this.gridManager = gridManager;

    // Particle specific properties
    this.moveSpeed = particleConfig.moveSpeed || 2;
    this.moveVector = particleConfig.moveVector || { dx: 0, dy: 0 };
    this.type = particleConfig.type || "default";

    // Setup animator and renderer
    this.animator = new Animator(this.spriteConfig);
    this.animator.setSpritesheet(particleConfig.spritesheet);
    this.animator.setAnimation(particleConfig.animation);

    this.renderer = new Renderer(this.ctx, this.animator);
  }

  update(dt) {
    // Update position based on vector
    this.x += this.moveVector.dx * this.moveSpeed * (dt / 16.67);
    this.y += this.moveVector.dy * this.moveSpeed * (dt / 16.67);

    // Update animation
    this.animator.nextFrame();
  }

  draw() {
    this.renderer.draw(this.x, this.y, this.moveVector);
  }
}
