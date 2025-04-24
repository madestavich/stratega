export class MoveAction {
  constructor(objectManager, objectTypesConfig) {
    this.objectManager = objectManager;
    this.objectTypesConfig = objectTypesConfig;
  }

  // Перевірка, чи може бути виконана дія переміщення
  canExecute(gameObject) {
    // Get the type config directly from the object type
    const typeConfig = this.objectTypesConfig[gameObject.objectType];

    // Перевірка умов для виконання дії руху
    // Наприклад, перевірка наявності цілі для руху, відсутності перешкод тощо

    // Спрощений приклад:
    return !gameObject.isMoving && typeConfig.moveSpeed > 0;
  }

  // Виконання дії переміщення
  execute(gameObject) {
    // Get the type config directly from the object type
    const typeConfig = this.objectTypesConfig[gameObject.objectType];

    // Логіка переміщення об'єкта
    // Використання параметрів з typeConfig, наприклад typeConfig.moveSpeed

    // Відмітка об'єкта як рухомого
    gameObject.isMoving = true;

    // Реалізація руху...
  }
}
