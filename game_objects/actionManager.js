import { MoveAction } from "../import.js";
import { AttackAction } from "../import.js";
// import { DefendAction } from "../import.js";

// В GameManager.js
const actionsClasses = {
  move: MoveAction,
  attack: AttackAction,
  //   defend: DefendAction,
};

export class ActionManager {
  constructor(objectManager) {
    this.objectManager = objectManager;
    this.actions = {};
    this.pathCache = new Map(); // Cache for shared paths
    this.pathCacheTimeout = 2000; // Path cache validity in ms
    this.initializeActions(actionsClasses);
  }

  // When initializing actions, pass the ActionManager itself
  initializeActions(actionsClasses) {
    for (const [actionType, ActionClass] of Object.entries(actionsClasses)) {
      this.actions[actionType] = new ActionClass(this.objectManager, this);
    }
  }

  // Add path caching methods to ActionManager
  getSharedPath(startCol, startRow, targetCol, targetRow, objectType, team) {
    const key = `${startCol},${startRow}-${targetCol},${targetRow}-${objectType}-${team}`;
    const cachedPath = this.pathCache.get(key);

    if (
      cachedPath &&
      performance.now() - cachedPath.timestamp < this.pathCacheTimeout
    ) {
      return cachedPath.path.slice(); // Return a copy of the cached path
    }

    return null;
  }

  storePath(startCol, startRow, targetCol, targetRow, objectType, team, path) {
    const key = `${startCol},${startRow}-${targetCol},${targetRow}-${objectType}-${team}`;
    this.pathCache.set(key, {
      path: path.slice(), // Store a copy
      timestamp: performance.now(),
    });
  }

  // Виконання дій для всіх об'єктів з урахуванням deltaTime
  update(deltaTime) {
    // Process actions for all objects (player and enemy)
    const allObjects = [...this.objectManager.objects, ...this.objectManager.enemyObjects];
    for (const gameObject of allObjects) {
      // Update action-specific timers and states
      if (this.actions.attack) {
        this.actions.attack.update(gameObject, deltaTime);
      }

      this.processObjectActions(gameObject, deltaTime);
    }
  }

  // Обробка дій для конкретного об'єкта з урахуванням deltaTime
  processObjectActions(gameObject, deltaTime) {
    // Перевірка, чи має об'єкт тип і чи може він діяти
    if (!gameObject.objectType || !gameObject.canAct) {
      return;
    }

    // Отримання пріоритетів дій об'єкта
    const actionPriorities = gameObject.actionPriorities;
    if (!actionPriorities || actionPriorities.length === 0) {
      return;
    }

    // Перебір дій за пріоритетом
    for (const actionType of actionPriorities) {
      // Перевірка, чи існує такий тип дії і чи доступний він для цього типу об'єкта
      if (
        this.actions[actionType] &&
        gameObject.availableActions &&
        gameObject.availableActions.includes(actionType)
      ) {
        // Перевірка, чи може бути виконана ця дія
        if (
          this.actions[actionType].canExecute(
            gameObject,
            gameObject.moveTarget?.col,
            gameObject.moveTarget?.row,
            [0]
          )
        ) {
          // Виконання дії з передачею deltaTime
          this.actions[actionType].execute(gameObject, deltaTime, [0]);
          // Після успішного виконання однієї дії припиняємо перевірку інших
          break;
        }
      }
    }
  }
}
