export class Pathfinder {
  constructor(gridManager) {
    this.gridManager = gridManager;
    // Directions including diagonals (8 directions)
    this.directions = [
      { dx: 0, dy: -1 }, // up
      { dx: 1, dy: -1 }, // up-right
      { dx: 1, dy: 0 }, // right
      { dx: 1, dy: 1 }, // down-right
      { dx: 0, dy: 1 }, // down
      { dx: -1, dy: 1 }, // down-left
      { dx: -1, dy: 0 }, // left
      { dx: -1, dy: -1 }, // up-left
    ];
  }

  // Find path with A* algorithm, considering obstacle types
  findPath(
    startCol,
    startRow,
    targetCol,
    targetRow,
    objectWidth,
    objectHeight,
    expansionDirection,
    gameObject,
    allowedObstacleTypes = [0] // Default: only allow empty cells (type 0)
  ) {
    // Using A* algorithm for better path finding
    const openSet = [];
    const closedSet = new Set();
    const gScore = new Map();
    const fScore = new Map();
    const parent = new Map();

    const startKey = `${startCol},${startRow}`;

    // Initialize start node
    openSet.push({ col: startCol, row: startRow });
    gScore.set(startKey, 0);
    fScore.set(
      startKey,
      this.heuristic(startCol, startRow, targetCol, targetRow)
    );

    while (openSet.length > 0) {
      // Find node with lowest fScore
      let currentIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        const currentKey = `${openSet[currentIndex].col},${openSet[currentIndex].row}`;
        const iKey = `${openSet[i].col},${openSet[i].row}`;
        if (fScore.get(iKey) < fScore.get(currentKey)) {
          currentIndex = i;
        }
      }

      const current = openSet[currentIndex];
      const currentKey = `${current.col},${current.row}`;

      // If we reached the target
      if (current.col === targetCol && current.row === targetRow) {
        return this.reconstructPath(
          parent,
          startCol,
          startRow,
          targetCol,
          targetRow
        );
      }

      // Remove current from openSet and add to closedSet
      openSet.splice(currentIndex, 1);
      closedSet.add(currentKey);

      // Check all neighbors (8 directions)
      for (const dir of this.directions) {
        const nextCol = current.col + dir.dx;
        const nextRow = current.row + dir.dy;
        const nextKey = `${nextCol},${nextRow}`;

        // Skip if already evaluated
        if (closedSet.has(nextKey)) continue;

        // Check if we can move to this position considering obstacle types
        if (
          this.canOccupyExcludingSelf(
            nextCol,
            nextRow,
            objectWidth,
            objectHeight,
            expansionDirection,
            gameObject,
            allowedObstacleTypes
          )
        ) {
          // Calculate movement cost (diagonal movement costs more)
          const movementCost = dir.dx !== 0 && dir.dy !== 0 ? 1.414 : 1;
          const tentativeGScore = gScore.get(currentKey) + movementCost;

          const neighborInOpenSet = openSet.some(
            (node) => node.col === nextCol && node.row === nextRow
          );

          if (!neighborInOpenSet || tentativeGScore < gScore.get(nextKey)) {
            // This path is better, record it
            parent.set(nextKey, { col: current.col, row: current.row });
            gScore.set(nextKey, tentativeGScore);
            fScore.set(
              nextKey,
              tentativeGScore +
                this.heuristic(nextCol, nextRow, targetCol, targetRow)
            );

            if (!neighborInOpenSet) {
              openSet.push({ col: nextCol, row: nextRow });
            }
          }
        }
      }
    }

    // No path found
    return null;
  }

  // Heuristic function for A* (Manhattan distance)
  heuristic(col1, row1, col2, row2) {
    return Math.abs(col1 - col2) + Math.abs(row1 - row2);
  }

  // Check if an object can occupy the specified position, excluding cells occupied by itself
  canOccupyExcludingSelf(
    col,
    row,
    width,
    height,
    expansionDirection,
    gameObject,
    allowedObstacleTypes = [0]
  ) {
    if (!this.gridManager || !this.gridManager.grid) {
      return false;
    }

    // Determine starting coordinates based on expansion direction
    let startCol = col;
    let startRow = row;

    // Adjust starting coordinates based on expansionDirection
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
        // Default, no need to change
        break;
    }

    // Determine cells occupied by the game object itself
    let selfOccupiedCells = new Set();
    if (gameObject) {
      let selfStartCol = gameObject.gridCol;
      let selfStartRow = gameObject.gridRow;

      switch (gameObject.expansionDirection) {
        case "topLeft":
          selfStartCol = gameObject.gridCol - (gameObject.gridWidth - 1);
          selfStartRow = gameObject.gridRow - (gameObject.gridHeight - 1);
          break;
        case "topRight":
          selfStartRow = gameObject.gridRow - (gameObject.gridHeight - 1);
          break;
        case "bottomLeft":
          selfStartCol = gameObject.gridCol - (gameObject.gridWidth - 1);
          break;
        case "bottomRight":
          // Default, no need to change
          break;
      }

      for (let y = 0; y < gameObject.gridHeight; y++) {
        for (let x = 0; x < gameObject.gridWidth; x++) {
          const cellKey = `${selfStartCol + x},${selfStartRow + y}`;
          selfOccupiedCells.add(cellKey);
        }
      }
    }

    // Check all cells the object will occupy
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const checkCol = startCol + x;
        const checkRow = startRow + y;
        const cellKey = `${checkCol},${checkRow}`;

        // Check if cell is within grid bounds
        if (
          checkCol < 0 ||
          checkCol >= this.gridManager.cols ||
          checkRow < 0 ||
          checkRow >= this.gridManager.rows
        ) {
          return false;
        }

        // Check if cell is of an allowed type
        const cellType = this.gridManager.grid[checkRow][checkCol].type || 0;

        if (!allowedObstacleTypes.includes(cellType)) {
          return false;
        }

        // Check if cell is occupied by another object (not self)
        if (
          this.gridManager.grid[checkRow][checkCol].occupied &&
          !selfOccupiedCells.has(cellKey)
        ) {
          return false;
        }
      }
    }

    return true;
  }

  // Reconstruct path from target to start position
  reconstructPath(parent, startCol, startRow, targetCol, targetRow) {
    const path = [];
    let current = { col: targetCol, row: targetRow };

    // Reconstruct path from target to start
    while (current.col !== startCol || current.row !== startRow) {
      path.unshift(current);
      const key = `${current.col},${current.row}`;
      current = parent.get(key);

      // Safety check in case of broken path
      if (!current) break;
    }

    return path;
  }

  // Get next step on the path to the target
  getNextStep(gameObject, targetCol, targetRow, allowedObstacleTypes = [0]) {
    const path = this.findPath(
      gameObject.gridCol,
      gameObject.gridRow,
      targetCol,
      targetRow,
      gameObject.gridWidth,
      gameObject.gridHeight,
      gameObject.expansionDirection,
      gameObject,
      allowedObstacleTypes
    );

    if (!path || path.length === 0) {
      return null;
    }

    // Return the first step of the path
    const nextStep = path[0];
    return {
      dx: nextStep.col - gameObject.gridCol,
      dy: nextStep.row - gameObject.gridRow,
      path: path, // Return the full path for future reference
    };
  }

  // Check if the current path is still valid by checking adjacent cells
  isPathStillValid(gameObject, currentPath, allowedObstacleTypes = [0]) {
    if (!currentPath || currentPath.length === 0) {
      return false;
    }

    // Check only the next few steps in the path (e.g., next 3 steps)
    const stepsToCheck = Math.min(3, currentPath.length);

    for (let i = 0; i < stepsToCheck; i++) {
      const nextStep = currentPath[i];

      // Check if this step is still valid
      if (
        !this.canOccupyExcludingSelf(
          nextStep.col,
          nextStep.row,
          gameObject.gridWidth,
          gameObject.gridHeight,
          gameObject.expansionDirection,
          gameObject,
          allowedObstacleTypes
        )
      ) {
        return false; // Path is blocked
      }
    }

    return true; // Path is still valid
  }

  // Check adjacent cells to see if the path needs recalculation
  checkAdjacentCells(gameObject, currentPath, allowedObstacleTypes = [0]) {
    if (!currentPath || currentPath.length === 0) {
      return { needsRecalculation: true };
    }

    // Get the next position in the path
    const nextPosition = currentPath[0];

    // Check if we can still move to the next position
    if (
      !this.canOccupyExcludingSelf(
        nextPosition.col,
        nextPosition.row,
        gameObject.gridWidth,
        gameObject.gridHeight,
        gameObject.expansionDirection,
        gameObject,
        allowedObstacleTypes
      )
    ) {
      return { needsRecalculation: true };
    }

    // Check surrounding cells for any changes that might affect the path
    for (const dir of this.directions) {
      const checkCol = gameObject.gridCol + dir.dx;
      const checkRow = gameObject.gridRow + dir.dy;

      // Skip if out of bounds
      if (
        checkCol < 0 ||
        checkCol >= this.gridManager.cols ||
        checkRow < 0 ||
        checkRow >= this.gridManager.rows
      ) {
        continue;
      }

      // Check if a cell that was previously passable is now blocked
      const cellType = this.gridManager.grid[checkRow][checkCol].type || 0;
      const wasAllowed = allowedObstacleTypes.includes(cellType);
      const isOccupied = this.gridManager.grid[checkRow][checkCol].occupied;

      // If a previously passable cell is now blocked, we might need to recalculate
      if (
        wasAllowed &&
        isOccupied &&
        !allowedObstacleTypes.includes(cellType)
      ) {
        // Check if this cell is part of our path
        const isInPath = currentPath.some(
          (step) => step.col === checkCol && step.row === checkRow
        );

        if (isInPath) {
          return { needsRecalculation: true };
        }
      }
    }

    return {
      needsRecalculation: false,
      nextStep: {
        dx: nextPosition.col - gameObject.gridCol,
        dy: nextPosition.row - gameObject.gridRow,
      },
    };
  }
}
