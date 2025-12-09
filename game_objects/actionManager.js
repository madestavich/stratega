import { MoveAction } from "../import.js";
import { AttackAction } from "../import.js";
import { TeleportAction } from "../import.js";
import { AuraAction } from "../import.js";
// import { DefendAction } from "../import.js";

// В GameManager.js
const actionsClasses = {
  move: MoveAction,
  attack: AttackAction,
  teleport: TeleportAction,
  aura: AuraAction,
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
  update(deltaTime, isAnimationTick = true) {
    // Process actions for ALL objects (player and enemy) for consistent results
    // Sort ONLY by id for absolute determinism (gridRow/gridCol changes during movement)
    const allObjects = [
      ...this.objectManager.objects,
      ...this.objectManager.enemyObjects,
    ];
    const sortedObjects = allObjects.sort((a, b) => a.id - b.id);

    for (const gameObject of sortedObjects) {
      // Update action-specific timers and states (always, for cooldown tracking)
      if (this.actions.attack) {
        this.actions.attack.update(gameObject, deltaTime);
      }

      // Update aura cooldown
      if (this.actions.aura) {
        this.actions.aura.update(gameObject, deltaTime);
      }

      // Only process actions on animation ticks to sync attack execution with animation frames
      if (isAnimationTick) {
        this.processObjectActions(gameObject, deltaTime);
      } else {
        // On non-animation ticks, only process movement (not attacks)
        this.processMovementOnly(gameObject, deltaTime);
      }
    }
  }

  // Process only movement actions (for non-animation ticks)
  processMovementOnly(gameObject, deltaTime) {
    if (!gameObject.objectType || !gameObject.canAct) {
      return;
    }

    // Only execute move action if object is currently moving
    if (gameObject.isMoving) {
      // Check if unit uses teleport movement
      if (gameObject.isTeleporting && this.actions.teleport) {
        this.actions.teleport.execute(gameObject, deltaTime, [0]);
      } else if (this.actions.move) {
        this.actions.move.execute(gameObject, deltaTime, [0]);
      }
    }
  }

  // Обробка дій для конкретного об'єкта з урахуванням deltaTime
  processObjectActions(gameObject, deltaTime) {
    // Перевірка, чи має об'єкт тип і чи може він діяти
    if (!gameObject.objectType || !gameObject.canAct) {
      return;
    }

    // Перевірка досягнення groupMoveTarget - скидаємо групу
    this.checkGroupTargetReached(gameObject);

    // Отримання пріоритетів дій об'єкта
    const actionPriorities = gameObject.actionPriorities;
    if (!actionPriorities || actionPriorities.length === 0) {
      return;
    }

    // Визначаємо ціль руху - groupMoveTarget має пріоритет над moveTarget
    const moveTargetCol =
      gameObject.groupMoveTarget?.col ?? gameObject.moveTarget?.col;
    const moveTargetRow =
      gameObject.groupMoveTarget?.row ?? gameObject.moveTarget?.row;

    // Перебір дій за пріоритетом
    for (const actionType of actionPriorities) {
      // Перевірка, чи існує такий тип дії і чи доступний він для цього типу об'єкта
      if (
        this.actions[actionType] &&
        gameObject.availableActions &&
        gameObject.availableActions.includes(actionType)
      ) {
        // Для move та teleport action використовуємо визначену ціль
        const isMovementAction =
          actionType === "move" || actionType === "teleport";
        const targetCol = isMovementAction ? moveTargetCol : undefined;
        const targetRow = isMovementAction ? moveTargetRow : undefined;

        // Перевірка, чи може бути виконана ця дія
        if (
          this.actions[actionType].canExecute(
            gameObject,
            targetCol,
            targetRow,
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

  // Перевірка чи юніт досяг groupMoveTarget і скидання до дефолту
  checkGroupTargetReached(gameObject) {
    // Якщо немає групи або немає цілі групи - нічого не робимо
    if (!gameObject.groupId || !gameObject.groupMoveTarget) {
      return;
    }

    // Перевіряємо чи юніт досяг цілі групи
    const targetCol = gameObject.groupMoveTarget.col;
    const targetRow = gameObject.groupMoveTarget.row;

    // Для телепортуючих юнітів перевіряємо також teleportTarget
    const isTeleporter =
      gameObject.availableActions &&
      gameObject.availableActions.includes("teleport");

    // Юніт досяг цілі ТІЛЬКИ якщо він фізично на позиції цілі
    // Не скидаємо пріоритети поки юніт не досяг точної позиції
    const reachedTarget =
      gameObject.gridCol === targetCol && gameObject.gridRow === targetRow;

    if (reachedTarget) {
      console.log(
        `Unit ${gameObject.id} (teleporter: ${isTeleporter}) reached group target at (${targetCol}, ${targetRow}), resetting to default priorities`
      );

      // Скидаємо actionPriorities до дефолтних
      if (gameObject.defaultActionPriorities) {
        gameObject.actionPriorities = [...gameObject.defaultActionPriorities];
      }

      // Очищаємо групові параметри
      gameObject.groupMoveTarget = null;
      gameObject.groupId = null;

      // Очищаємо цілі руху щоб юніт міг знайти нову ціль від поточної позиції
      gameObject.moveTarget = null;
      gameObject.teleportTarget = null;
      gameObject.teleportState = null;
      gameObject.isMoving = false;
      gameObject.isTeleporting = false;
    }
  }
}
