import { ConfigLoader } from "./game_configs/configLoader.js";
import { ObjectManager } from "./game_objects/objectManager.js";
import { GridManager } from "./game_map/gridManager.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  this.gridManager.updateSize(canvas.width, canvas.height);
});

class GameManager {
  constructor() {
    this.lastTime = 0;
    this.deltaTime = 0;
    this.fixedTimeStep = 1000 / 10;
    this.accumulator = 0;

    this.configLoader = new ConfigLoader();
    this.gridManager = new GridManager(ctx, {
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      rows: 20,
      cols: 40,
    });
    this.objectManager = new ObjectManager(ctx, this.gridManager);

    this.start();
  }

  async start() {
    const configList = {
      hero: "/game_configs/units/config.json",
      // інші
    };

    await this.configLoader.load(configList);

    // створення об'єктів
    this.objectManager.createMultiple(this.configLoader.getConfig("hero"), 10, [
      {
        x: Math.floor(Math.random() * canvas.width),
        y: Math.floor(Math.random() * canvas.height),
      },
      {
        x: Math.floor(Math.random() * canvas.width),
        y: Math.floor(Math.random() * canvas.height),
      },
      {
        x: Math.floor(Math.random() * canvas.width),
        y: Math.floor(Math.random() * canvas.height),
      },
    ]);

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.objectManager.updateAll();
    this.gridManager.updateGridObjects(this.objectManager);
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.gridManager.debugDrawGrid();
    this.gridManager.debugColorOccupiedCells();
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
