import { ConfigLoader } from "./game_configs/configLoader.js";
import { ObjectManager } from "./game_objects/objectManager.js";
import { GridManager } from "./game_map/gridManager.js";
import { ActionManager } from "./game_objects/actionManager.js";
// import { InputManager } from "./input/inputManager.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 1500;
canvas.height = 800;

class GameManager {
  constructor() {
    this.lastTime = 0;
    this.deltaTime = 0;
    this.fixedTimeStep = 1000 / 8;
    this.accumulator = 0;

    this.configLoader = new ConfigLoader();
    this.gridManager = new GridManager(ctx, {
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      rows: 20,
      cols: 40,
    });
    this.objectManager = new ObjectManager(ctx, this.gridManager);
    this.objectTypesConfig = {
      cavalry: {
        moveSpeed: 2,
        attackRange: 1,
        attackDamage: 10,
        availableActions: ["move", "attack", "defend"],
      },
      archer: {
        moveSpeed: 1,
        attackRange: 4,
        attackDamage: 7,
        availableActions: ["attack", "move", "retreat"],
      },
      // Інші типи об'єктів...
    };
    this.actionManager = new ActionManager(
      this.objectManager,
      this.objectTypesConfig
    );

    this.start();
  }

  async start() {
    const configList = {
      cavalry: "/game_configs/units/config1.json",
      archer: "/game_configs/units/config2.json",
      // інші
    };

    await this.configLoader.load(configList);

    // створення об'єктів
    this.objectManager.createMultiple(
      this.configLoader.getConfig("cavalry"),
      {
        gridWidth: 2,
        gridHeight: 1,
        expansionDirection: "topRight",
        objectType: "cavalry",
        actionPriorities: ["attack", "move", "defend"], // Пріоритет дій для цього об'єкта
      },
      3,
      [
        {
          col: 2,
          row: 1,
        },
        {
          col: 3,
          row: 5,
        },
        {
          col: 3,
          row: 10,
        },
      ]
    );
    this.objectManager.createMultiple(
      this.configLoader.getConfig("archer"),
      {
        gridWidth: 1,
        gridHeight: 1,
        expansionDirection: "bottomRight",
        objectType: "archer",
      },
      10,
      [
        {
          col: 0,
          row: 1,
        },
        {
          col: 0,
          row: 2,
        },
        {
          col: 0,
          row: 3,
        },
        {
          col: 0,
          row: 4,
        },
        {
          col: 0,
          row: 5,
        },
        {
          col: 0,
          row: 6,
        },
        {
          col: 0,
          row: 7,
        },
        {
          col: 0,
          row: 8,
        },
        {
          col: 0,
          row: 9,
        },
        {
          col: 0,
          row: 10,
        },
      ]
    );

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
