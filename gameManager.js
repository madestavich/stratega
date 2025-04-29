import { ConfigLoader } from "./import.js";
import { ObjectManager } from "./import.js";
import { GridManager } from "./import.js";
import { ActionManager } from "./import.js";
import { InputManager } from "./import.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 1500;
canvas.height = 800;

class GameManager {
  constructor() {
    this.lastTime = 0;
    this.deltaTime = 0;
    this.fixedTimeStep = 1000 / 30;
    this.accumulator = 0;

    //! ініціалізація об'єктів і інших менеджерів

    this.configLoader = new ConfigLoader();
    this.gridManager = new GridManager(ctx, {
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      rows: 20,
      cols: 40,
    });
    this.objectManager = new ObjectManager(ctx, this.gridManager);
    this.actionManager = new ActionManager(this.objectManager);
    this.inputManager = new InputManager();

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
        actionPriorities: ["move"], // Пріоритет дій для цього об'єкта
        moveSpeed: 22,
        availableActions: ["move"],
      },
      3,
      [
        {
          col: 25,
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
        actionPriorities: ["move"], // Пріоритет дій для цього об'єкта
        moveSpeed: 8,
        availableActions: ["move"],
      },
      10,
      [
        {
          col: 10,
          row: 1,
        },
        {
          col: 20,
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

    // Assign random movement targets to all objects
    this.assignRandomMovementToAllObjects();
    console.log(this.objectManager.objects);

    requestAnimationFrame((t) => this.loop(t));
  }

  assignRandomMovementToAllObjects() {
    const moveAction = this.actionManager.actions.move;
    if (!moveAction) return;

    for (const obj of this.objectManager.objects) {
      // Generate random target within grid bounds
      const targetCol = Math.floor(Math.random() * this.gridManager.cols);
      const targetRow = Math.floor(Math.random() * this.gridManager.rows);

      // Use the setMoveTarget method from MoveAction
      moveAction.setMoveTarget(obj, targetCol, targetRow, [0]);
    }
  }

  update(dt) {
    // Оновлюємо всі об'єкти
    this.objectManager.updateAll();

    // Оновлюємо дії для всіх об'єктів через ActionManager
    this.actionManager.update(dt);

    // Оновлюємо стан сітки після руху
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
