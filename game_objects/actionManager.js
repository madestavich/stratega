import { MoveAction } from "../import.js";
// import { AttackAction } from "../import.js";
// import { DefendAction } from "../import.js";
// import { PatrolAction } from "../import.js";
// import { RetreatAction } from "../import.js";

// В GameManager.js
const actionsClasses = {
  move: MoveAction,
  //   attack: AttackAction,
  //   defend: DefendAction,
  //   patrol: PatrolAction,
  //   retreat: RetreatAction,
};

export class ActionManager {
  constructor(objectManager, objectTypesConfig) {
    this.objectManager = objectManager;
    this.objectTypesConfig = objectTypesConfig; // Конфіг з типами об'єктів і їх параметрами
    this.actions = {}; // Зберігатиме екземпляри класів дій
    this.initializeActions(actionsClasses);
  }

  // Ініціалізація доступних дій
  initializeActions(actionsClasses) {
    // actionsClasses має бути об'єктом, де ключі - назви дій, а значення - класи дій
    for (const [actionType, ActionClass] of Object.entries(actionsClasses)) {
      this.actions[actionType] = new ActionClass(
        this.objectManager,
        this.objectTypesConfig
      );
    }
  }

  // Виконання дій для всіх об'єктів
  update() {
    for (const gameObject of this.objectManager.objects) {
      this.processObjectActions(gameObject);
    }
  }

  // Обробка дій для конкретного об'єкта
  processObjectActions(gameObject) {
    // Перевірка, чи має об'єкт тип і чи може він діяти
    if (!gameObject.objectType || !gameObject.canAct || gameObject.isMoving) {
      return;
    }

    // Отримання конфігурації типу об'єкта
    const typeConfig = this.objectTypesConfig[gameObject.objectType];
    if (!typeConfig) {
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
        typeConfig.availableActions.includes(actionType)
      ) {
        // Перевірка, чи може бути виконана ця дія
        if (this.actions[actionType].canExecute(gameObject)) {
          // Виконання дії
          this.actions[actionType].execute(gameObject);
          // Після успішного виконання однієї дії припиняємо перевірку інших
          break;
        }
      }
    }
  }
}
