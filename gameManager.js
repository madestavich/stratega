import { ConfigLoader } from "./configLoader.js";
import { ObjectManager } from "./objectManager.js";

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
    this.fixedTimeStep = 1000 / 20;
    this.accumulator = 0;

    this.configLoader = new ConfigLoader();
    this.objectManager = new ObjectManager(ctx);

    this.start();
  }

  async start() {
    const configList = {
      hero: "config.json",
      // інші
    };

    await this.configLoader.load(configList);

    // створення об'єктів
    this.objectManager.createMultiple(this.configLoader.getConfig("hero"), 10, [
      {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
      },
      {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
      },
      {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
      },
      {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
      },
      {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
      },
      {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
      },
      {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
      },
      {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
      },
      {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
      },
      {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
      },
    ]);

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.objectManager.updateAll();
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.objectManager.renderAll();
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
    requestAnimationFrame((t) => this.loop(t));
  }
}

new GameManager();
