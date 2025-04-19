export class MoveAction {
  constructor(objectManager, objectTypesConfig) {
    this.objectManager = objectManager;
    this.objectTypesConfig = objectTypesConfig;
  }

  // Перевірка, чи може бути виконана дія переміщення
  canExecute(gameObject, typeConfig) {
    // Перевірка умов для виконання дії руху
    // Наприклад, перевірка наявності цілі для руху, відсутності перешкод тощо

    // Спрощений приклад:
    return !gameObject.isMoving && typeConfig.moveSpeed > 0;
  }

  // Виконання дії переміщення
  execute(gameObject, typeConfig) {
    // Логіка переміщення об'єкта
    // Використання параметрів з typeConfig, наприклад typeConfig.moveSpeed

    // Відмітка об'єкта як рухомого
    gameObject.isMoving = true;

    // Реалізація руху...
  }
}
