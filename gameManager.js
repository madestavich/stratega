import { Animator } from "./animator.js";
import { Renderer } from "./renderer.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

class GameManager {
  constructor() {
    this.lastTime = 0;
    this.deltaTime = 0;
    this.fixedTimeStep = 1000 / 20; // 60 FPS
    this.accumulator = 0;
    this.animator = null; // Додано аніматор
    this.renderer = null; // Додано рендерер
    this.config = null; // Додано для конфігурації
    this.start();
  }

  async start() {
    try {
      // Завантажуємо конфігурацію з JSON файлу
      const response = await fetch("config.json"); // шлях до вашого JSON файлу
      this.config = await response.json();

      // Завантажуємо спрайтшит
      const spritesheet = new Image();
      spritesheet.src = this.config["111111111"].sourceImage.link;

      spritesheet.onload = () => {
        // Ініціалізація аніматора після завантаження спрайтшита
        this.config["111111111"].sourceImage.link = spritesheet; // Додаємо спрайтшит в конфігурацію

        this.animator = new Animator(this.config);
        this.animator.setSpritesheet("111111111");
        this.animator.setAnimation("22222", true, "22222"); // запускаємо анімацію

        this.renderer = new Renderer(ctx, this.animator);

        requestAnimationFrame((timestamp) => this.loop(timestamp));
      };
    } catch (error) {
      console.error("Error loading configuration:", error);
    }
  }

  loop(timestamp) {
    if (this.lastTime === 0) this.lastTime = timestamp;

    this.deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.accumulator += this.deltaTime;

    while (this.accumulator >= this.fixedTimeStep) {
      this.update(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
    }

    this.render();
    requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  update(dt) {
    if (this.animator && !this.animator.hasFinished) {
      this.animator.nextFrame();
    }
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.renderer) {
      this.renderer.draw(100, 100); // Малювання анімації на canvas
    }
  }
}

new GameManager();
