import { ConfigLoader } from "./import.js";
import { ObjectManager } from "./import.js";
import { GridManager } from "./import.js";
import { ActionManager } from "./import.js";
import { InputManager } from "./import.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 1200;
canvas.height = 800;

class GameManager {
  constructor() {
    this.lastTime = 0;
    this.deltaTime = 0;
    this.fixedTimeStep = 800 / 16;
    this.accumulator = 0;
    this.debugMode = false;
    this.debugInterval = null;
    this.isRunning = true;

    //! ініціалізація об'єктів і інших менеджерів

    this.configLoader = new ConfigLoader();
    this.gridManager = new GridManager(ctx, {
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      rows: 80,
      cols: 60,
    });
    this.objectManager = new ObjectManager(ctx, this.gridManager);
    this.actionManager = new ActionManager(this.objectManager);
    this.inputManager = new InputManager();

    document.addEventListener("keydown", (e) => {
      if (e.key === "`") {
        this.toggleDebugMode();
      }
    });

    this.start();
  }

  logGameObjects() {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `%c ${timestamp} `,
      "background: #000; color:rgb(212, 194, 27); font-size: 14px;"
    );
    console.log(this.objectManager.objects);
  }

  toggleDebugMode() {
    this.debugMode = !this.debugMode;

    if (this.debugMode) {
      console.log(
        "%c Debug mode enabled. Objects will be logged every second.",
        "background: #222; color:rgb(47, 201, 9); font-size: 14px;"
      );
      console.log("Scroll down to see detailed object information.");
      this.debugInterval = setInterval(() => this.logGameObjects(), 2000);

      this.logGameObjects();
    } else {
      console.log(
        "%c Debug mode disabled.",
        "background: #222; color:rgb(255, 38, 0); font-size: 14px;"
      );
      clearInterval(this.debugInterval);
    }
  }

  async start() {
    const spriteConfigList = {
      skeleton: "/game_configs/units/config3.json",
      rider: "/game_configs/units/config4.json",
      paladin: "/game_configs/units/config5.json",
      horseman: "/game_configs/units/config6.json",
      mage: "/game_configs/units/config7.json",
      // інші
    };

    await this.configLoader.load(spriteConfigList);

    // створення об'єктів
    this.objectManager.fillArea(
      this.configLoader.getConfig("mage"),
      {
        gridWidth: 2,
        gridHeight: 2,
        expansionDirection: "topRight",
        objectType: "mage",
        actionPriorities: ["attack", "move"], // Пріоритет дій для цього об'єкта
        moveSpeed: 12,
        availableActions: ["move", "attack"],
        team: 2,
        attackDamage: 25,
        attackSpeed: 1.5,
        health: 80,
        isRanged: true,
        minRangeDistance: 10,
        maxRangeDistance: 20,
      },
      0,
      0,
      2,
      70
    );

    this.objectManager.fillArea(
      this.configLoader.getConfig("rider"),
      {
        gridWidth: 3,
        gridHeight: 2,
        expansionDirection: "topRight",
        objectType: "rider",
        actionPriorities: ["attack", "move"], // Пріоритет дій для цього об'єкта
        moveSpeed: 25,
        availableActions: ["move", "attack"],
        team: 1,
        attackDamage: 35,
        attackSpeed: 0.8,
        health: 140,
      },
      55,
      10,
      60,
      36
    );

    // Assign random movement targets to all objects
    // this.assignRandomMovementToAllObjects();
    // this.toggleDebugMode();

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
    try {
      // Оновлюємо всі об'єкти
      this.objectManager.updateAll();

      // Оновлюємо дії для всіх об'єктів через ActionManager
      this.actionManager.update(dt);

      // Оновлюємо стан сітки після руху
      this.gridManager.updateGridObjects(this.objectManager);
    } catch (error) {
      console.error("Error in update:", error);
      // Логування стану гри для відлагодження
      console.log("Game state:", {
        objects: this.objectManager.objects.map((obj) => ({
          gridCol: obj.gridCol,
          gridRow: obj.gridRow,
          gridWidth: obj.gridWidth,
          gridHeight: obj.gridHeight,
          expansionDirection: obj.expansionDirection,
        })),
      });
      // Зупиняємо цикл оновлення, щоб уникнути спаму помилками
      this.isRunning = false;
      console.warn(
        "Game loop stopped due to error. Check console for details."
      );
    }
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw debug paths when debug mode is enabled
    if (this.debugMode) {
      this.gridManager.debugDrawGrid();
      this.gridManager.debugColorOccupiedCells();
      const moveAction = this.actionManager.actions.move;
      if (moveAction) {
        for (const obj of this.objectManager.objects) {
          // Only draw paths for objects that are alive and have a move target
          if (obj.moveTarget && !obj.isDead) {
            moveAction.debugDrawPath(obj);
          }
        }
      }
    }

    this.objectManager.renderAll();
  }

  loop(timestamp) {
    if (!this.isRunning) return; // Не продовжуємо цикл, якщо гра зупинена
    if (this.lastTime === 0) this.lastTime = timestamp;
    this.deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;
    this.accumulator += this.deltaTime;

    while (this.accumulator >= this.fixedTimeStep) {
      this.update(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
      // Якщо гра зупинена через помилку, виходимо з циклу
      if (!this.isRunning) break;
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }
}

new GameManager();
