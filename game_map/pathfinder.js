export class Pathfinder {
  constructor(gridManager) {
    this.gridManager = gridManager;
  }

  // Метод для пошуку найкоротшого шляху від початкової позиції до цілі
  findPath(
    startCol,
    startRow,
    targetCol,
    targetRow,
    objectWidth,
    objectHeight,
    expansionDirection
  ) {
    // Використовуємо алгоритм пошуку в ширину (BFS)
    const queue = [];
    const visited = new Set();
    const parent = new Map();

    // Додаємо початкову позицію в чергу
    queue.push({ col: startCol, row: startRow });
    visited.add(`${startCol},${startRow}`);

    while (queue.length > 0) {
      const current = queue.shift();

      // Якщо досягли цілі, відновлюємо шлях
      if (current.col === targetCol && current.row === targetRow) {
        return this.reconstructPath(
          parent,
          startCol,
          startRow,
          targetCol,
          targetRow
        );
      }

      // Перевіряємо сусідні клітинки
      const directions = [
        { dx: 0, dy: -1 }, // вгору
        { dx: 1, dy: 0 }, // вправо
        { dx: 0, dy: 1 }, // вниз
        { dx: -1, dy: 0 }, // вліво
      ];

      for (const dir of directions) {
        const nextCol = current.col + dir.dx;
        const nextRow = current.row + dir.dy;
        const key = `${nextCol},${nextRow}`;

        // Перевіряємо, чи не відвідували цю клітинку раніше
        if (visited.has(key)) continue;

        // Перевіряємо, чи може об'єкт переміститися в цю позицію
        if (
          this.canOccupy(
            nextCol,
            nextRow,
            objectWidth,
            objectHeight,
            expansionDirection
          )
        ) {
          queue.push({ col: nextCol, row: nextRow });
          visited.add(key);
          parent.set(key, { col: current.col, row: current.row });
        }
      }
    }

    // Якщо шлях не знайдено
    return null;
  }

  // Перевірка, чи може об'єкт зайняти вказану позицію
  canOccupy(col, row, width, height, expansionDirection) {
    if (!this.gridManager || !this.gridManager.grid) {
      return false;
    }

    // Визначаємо початкові координати для перевірки в залежності від напрямку розширення
    let startCol = col;
    let startRow = row;

    // Корегуємо початкові координати в залежності від expansionDirection
    switch (expansionDirection) {
      case "topLeft":
        startCol = col - (width - 1);
        startRow = row - (height - 1);
        break;
      case "topRight":
        startRow = row - (height - 1);
        break;
      case "bottomLeft":
        startCol = col - (width - 1);
        break;
      case "bottomRight":
        // За замовчуванням, не потрібно змінювати
        break;
    }

    // Перевіряємо всі клітинки, які займе об'єкт
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const checkCol = startCol + x;
        const checkRow = startRow + y;

        // Перевіряємо, чи клітинка в межах сітки
        if (
          checkCol < 0 ||
          checkCol >= this.gridManager.cols ||
          checkRow < 0 ||
          checkRow >= this.gridManager.rows
        ) {
          return false;
        }

        // Перевіряємо, чи клітинка вільна
        if (this.gridManager.grid[checkRow][checkCol].occupied) {
          return false;
        }
      }
    }

    return true;
  }

  // Відновлення шляху від цілі до початкової позиції
  reconstructPath(parent, startCol, startRow, targetCol, targetRow) {
    const path = [];
    let current = { col: targetCol, row: targetRow };

    // Відновлюємо шлях від цілі до початку
    while (current.col !== startCol || current.row !== startRow) {
      path.unshift(current);
      const key = `${current.col},${current.row}`;
      current = parent.get(key);
    }

    return path;
  }

  // Метод для отримання наступного кроку на шляху до цілі
  getNextStep(gameObject, targetCol, targetRow) {
    const path = this.findPath(
      gameObject.gridCol,
      gameObject.gridRow,
      targetCol,
      targetRow,
      gameObject.gridWidth,
      gameObject.gridHeight,
      gameObject.expansionDirection
    );

    if (!path || path.length === 0) {
      return null;
    }

    // Повертаємо перший крок шляху
    const nextStep = path[0];
    return {
      dx: nextStep.col - gameObject.gridCol,
      dy: nextStep.row - gameObject.gridRow,
    };
  }
}
