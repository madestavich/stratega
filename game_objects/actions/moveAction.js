import { Pathfinder } from "../../import.js";

export class MoveAction {
  constructor(objectManager, objectTypesConfig) {
    this.objectManager = objectManager;
    this.objectTypesConfig = objectTypesConfig;
    this.pathfinder = null;
  }

  // Перевірка, чи може бути виконана дія переміщення
  canExecute(gameObject) {
    // Get the type config directly from the object type
    const typeConfig = this.objectTypesConfig[gameObject.objectType];

    // Перевірка базових умов
    if (gameObject.isMoving || typeConfig.moveSpeed <= 0) {
      return false;
    }

    // Отримуємо доступ до gridManager через об'єкт
    const gridManager = gameObject.gridManager;
    if (!gridManager || !gridManager.grid) {
      return false;
    }

    // Ініціалізуємо pathfinder, якщо він ще не створений
    if (!this.pathfinder) {
      this.pathfinder = new Pathfinder(gridManager);
    }

    // Знаходимо ціль для руху (наприклад, найближчий ресурс або ворог)
    // Це залежить від логіки гри, тому тут просто як приклад
    const target = this.findTarget(gameObject);

    if (!target) {
      return false;
    }

    // Зберігаємо ціль в об'єкті для використання в execute
    gameObject.moveTarget = target;

    // Отримуємо наступний крок на шляху до цілі
    const nextStep = this.pathfinder.getNextStep(
      gameObject,
      target.col,
      target.row
    );

    if (!nextStep) {
      return false;
    }

    // Зберігаємо напрямок руху для використання в execute
    gameObject.moveDirection = nextStep;
    return true;
  }

  // Метод для пошуку цілі (приклад, потрібно адаптувати під конкретну логіку гри)
  findTarget(gameObject) {
    // Тут має бути логіка пошуку цілі для руху
    // Наприклад, пошук найближчого ресурсу або ворога

    // Для прикладу, просто повертаємо випадкову позицію на сітці
    const gridManager = gameObject.gridManager;

    // Спробуємо знайти вільну клітинку в радіусі 5 клітинок від об'єкта
    for (let attempt = 0; attempt < 20; attempt++) {
      const radius = 5;
      const randomDx = Math.floor(Math.random() * (2 * radius + 1)) - radius;
      const randomDy = Math.floor(Math.random() * (2 * radius + 1)) - radius;

      const targetCol = gameObject.gridCol + randomDx;
      const targetRow = gameObject.gridRow + randomDy;

      // Перевіряємо, чи клітинка в межах сітки
      if (
        targetCol < 0 ||
        targetCol >= gridManager.cols ||
        targetRow < 0 ||
        targetRow >= gridManager.rows
      ) {
        continue;
      }

      // Перевіряємо, чи клітинка вільна
      if (!gridManager.grid[targetRow][targetCol].occupied) {
        return { col: targetCol, row: targetRow };
      }
    }

    return null;
  }

  // Виконання дії переміщення
  execute(gameObject) {
    // Get the type config directly from the object type
    const typeConfig = this.objectTypesConfig[gameObject.objectType];

    // Логіка переміщення об'єкта
    if (gameObject.moveDirection) {
      // Оновлюємо позицію об'єкта на сітці
      gameObject.gridCol += gameObject.moveDirection.dx;
      gameObject.gridRow += gameObject.moveDirection.dy;

      // Оновлюємо фізичні координати на основі нової позиції на сітці
      gameObject.updatePositionFromGrid();

      // Відмітка об'єкта як рухомого
      gameObject.isMoving = true;

      // Скидаємо напрямок руху
      gameObject.moveDirection = null;
    }
  }
}
