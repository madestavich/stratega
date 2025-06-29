import { ConfigLoader } from "../import.js";
import { ObjectManager } from "../import.js";
import { GridManager } from "../import.js";
import { ActionManager } from "../import.js";
import { InputManager } from "../import.js";
import { SpriteLoader } from "../import.js";
import { Player } from "../import.js";
import { InterfaceManager } from "../import.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 1200;
canvas.height = 800;

class GameManager {
  constructor() {
    this.lastTime = 0;
    this.deltaTime = 0;
    this.fixedTimeStep = 1000 / 15;
    this.accumulator = 0;
    this.debugMode = false;
    this.debugInterval = null;
    this.isRunning = true;
    this.isPaused = true;
    this.player = null;

    //! ініціалізація об'єктів і інших менеджерів

    this.configLoader = new ConfigLoader();
    this.spriteLoader = new SpriteLoader(this.configLoader);
    this.gridManager = new GridManager(ctx, {
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      rows: 80,
      cols: 60,
    });
    this.objectManager = new ObjectManager(
      ctx,
      this.gridManager,
      this.configLoader,
      this.spriteLoader
    );
    this.actionManager = new ActionManager(this.objectManager);
    this.inputManager = new InputManager(canvas, this);

    this.inputManager.setPlayButtonCallback(() => this.togglePauseMode());
    this.interfaceManager = new InterfaceManager(
      this.spriteLoader,
      this.configLoader
    );

    document.addEventListener("keydown", (e) => {
      if (e.key === "`") {
        this.toggleDebugMode();
      }
    });

    this.start();
  }

  togglePauseMode() {
    this.isPaused = !this.isPaused;

    // Оновлюємо текст кнопки через InputManager
    this.inputManager.updatePlayButtonText(this.isPaused);

    console.log(`Game ${this.isPaused ? "paused" : "resumed"}`);
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

      // Оновлюємо сітку одразу при включенні режиму дебагу
      this.gridManager.updateGridObjects(this.objectManager);

      this.debugInterval = setInterval(() => this.logGameObjects(), 2000);
      this.logGameObjects();
    } else {
      console.log(
        "%c Debug mode disabled.",
        "background: #222; color:rgb(255, 38, 0); font-size: 14px;"
      );
      clearInterval(this.debugInterval);
    }

    // Викликаємо render для негайного відображення змін
    this.render();
  }

  async loadUnitIcons(race) {
    // Get all units for the race
    const raceData = this.configLoader.racesConfig[race];
    if (!raceData) return;

    // Collect all unit keys that need icons
    const unitKeys = [];
    Object.values(raceData.units).forEach((tier) => {
      Object.keys(tier).forEach((unitKey) => {
        unitKeys.push(`${unitKey}_icon`);
      });
    });

    // Load sprites for all unit icons
    if (unitKeys.length > 0) {
      await this.spriteLoader.loadSprites(unitKeys);
    }
  }

  async start() {
    await this.configLoader.loadRacesConfig();
    // Create player (for example purposes)
    this.player = new Player({
      nickname: "Player1",
      race: "neutral", // Use one of the races from races.json
      team: 1,
      coins: 100,
    });

    this.interfaceManager.updatePlayerInterface(this.player);

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    try {
      // Оновлюємо всі об'єкти
      this.objectManager.updateAll(dt);

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
    // Draw the hover indicator
    this.inputManager.drawHoverIndicator(ctx);
    this.objectManager.renderAll();
  }

  loop(timestamp) {
    if (!this.isRunning) return; // Не продовжуємо цикл, якщо гра зупинена
    if (this.lastTime === 0) this.lastTime = timestamp;
    this.deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;
    this.accumulator += this.deltaTime;

    while (this.accumulator >= this.fixedTimeStep) {
      // Оновлюємо анімації для всіх об'єктів незалежно від режиму
      for (const obj of this.objectManager.objects) {
        if (obj.animator && !obj.animator.hasFinished) {
          obj.animator.nextFrame();
        }
      }

      // Оновлюємо логіку гри тільки якщо не на паузі
      if (!this.isPaused) {
        // Оновлюємо всі об'єкти (крім анімацій, які вже оновлені)
        for (const obj of this.objectManager.objects) {
          // Викликаємо тільки оновлення позиції та інших параметрів, без анімації
          if (!obj.isDead) {
            obj.updateZCoordinate();
          }
        }

        // Оновлюємо дії для всіх об'єктів через ActionManager
        this.actionManager.update(this.fixedTimeStep);

        // Оновлюємо стан сітки після руху
        this.gridManager.updateGridObjects(this.objectManager);
      }

      this.accumulator -= this.fixedTimeStep;

      // Якщо гра зупинена через помилку, виходимо з циклу
      if (!this.isRunning) break;
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }
}

new GameManager();
