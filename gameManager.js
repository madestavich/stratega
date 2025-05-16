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
    this.fixedTimeStep = 1000 / 26;
    this.accumulator = 0;
    this.debugMode = false;
    this.debugInterval = null;
    this.isRunning = true;

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
      cavalry: "/game_configs/units/config1.json",
      archer: "/game_configs/units/config2.json",
      // інші
    };

    await this.configLoader.load(spriteConfigList);

    // створення об'єктів
    this.objectManager.createMultiple(
      this.configLoader.getConfig("cavalry"),
      {
        gridWidth: 2,
        gridHeight: 1,
        expansionDirection: "topRight",
        objectType: "cavalry",
        actionPriorities: ["attack", "move"], // Пріоритет дій для цього об'єкта
        moveSpeed: 15,
        availableActions: ["move", "attack"],
        team: 1,
        attackDamage: 100,
        attackSpeed: 1,
      },
      6,
      [
        {
          col: 25,
          row: 10,
        },
        {
          col: 25,
          row: 11,
        },
        {
          col: 25,
          row: 12,
        },
        {
          col: 25,
          row: 13,
        },
        {
          col: 25,
          row: 14,
        },
        {
          col: 25,
          row: 15,
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
        actionPriorities: ["attack", "move"], // Пріоритет дій для цього об'єкта
        moveSpeed: 8,
        availableActions: ["move", "attack"],
        team: 2,
        attackDamage: 20,
        attackSpeed: 1.5,
      },
      20,
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
        {
          col: 2,
          row: 1,
        },
        {
          col: 2,
          row: 2,
        },
        {
          col: 2,
          row: 3,
        },
        {
          col: 2,
          row: 4,
        },
        {
          col: 2,
          row: 5,
        },
        {
          col: 2,
          row: 6,
        },
        {
          col: 2,
          row: 7,
        },
        {
          col: 2,
          row: 8,
        },
        {
          col: 2,
          row: 9,
        },
        {
          col: 2,
          row: 10,
        },
      ]
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
    this.gridManager.debugDrawGrid();
    this.gridManager.debugColorOccupiedCells();

    // Draw debug paths when debug mode is enabled
    if (this.debugMode) {
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
