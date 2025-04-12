import { Animator } from "./animator.js";
import { Renderer } from "./renderer.js";

export class GameObject {
  constructor(ctx, config, x, y) {
    this.ctx = ctx;
    this.config = config;
    this.x = x;
    this.y = y;

    const defaultId = Object.keys(config)[0];

    this.animator = new Animator(config);
    this.animator.setSpritesheet(defaultId); // або змінюється пізніше

    const defaultAnim = Object.keys(config[defaultId].animations)[0];
    this.animator.setAnimation(defaultAnim, true, defaultAnim);

    this.renderer = new Renderer(ctx, this.animator);
  }

  update() {
    if (!this.animator.hasFinished) {
      this.animator.nextFrame();
    }
  }

  render() {
    this.renderer.draw(this.x, this.y);
  }
}
