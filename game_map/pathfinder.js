export class Pathfinder {
  constructor(gridManager) {
    this.gridManager = gridManager;
    // Directions including diagonals (8 directions)
    this.directions = [
      { dx: 0, dy: -1 }, // up
      { dx: 1, dy: 0 }, // right
      { dx: 0, dy: 1 }, // down
      { dx: -1, dy: 0 }, // left
      { dx: 1, dy: -1 }, // up-right
      { dx: 1, dy: 1 }, // down-right
      { dx: -1, dy: 1 }, // down-left
      { dx: -1, dy: -1 }, // up-left
    ];
  }

  // Simple direct path finder with minimal obstacle avoidance
  findPath(
    startCol,
    startRow,
    targetCol,
    targetRow,
    objectWidth,
    objectHeight,
    expansionDirection,
    gameObject,
    allowedObstacleTypes = [0]
  ) {
    // If start and target are the same, return empty path
    if (startCol === targetCol && startRow === targetRow) {
      return [];
    }

    const path = [];

    // Try direct path first
    const directPath = this.getDirectPath(
      startCol,
      startRow,
      targetCol,
      targetRow
    );

    // Check if direct path is clear
    let isBlocked = false;
    let blockedStep = null;

    for (const step of directPath) {
      if (
        !this.canOccupyExcludingSelf(
          step.col,
          step.row,
          objectWidth,
          objectHeight,
          expansionDirection,
          gameObject,
          allowedObstacleTypes
        )
      ) {
        isBlocked = true;
        blockedStep = step;
        break;
      }
      path.push(step);
    }

    // If direct path is clear, return it
    if (!isBlocked) {
      return directPath;
    }

    // If path is blocked, try to find a simple detour
    // Check adjacent cells to current position
    const alternativePaths = [];

    for (const dir of this.directions) {
      const nextCol = startCol + dir.dx;
      const nextRow = startRow + dir.dy;

      // Skip if out of bounds
      if (
        nextCol < 0 ||
        nextCol >= this.gridManager.cols ||
        nextRow < 0 ||
        nextRow >= this.gridManager.rows
      ) {
        continue;
      }

      // Check if we can move to this position
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
        // Calculate distance to target
        const distance =
          Math.abs(nextCol - targetCol) + Math.abs(nextRow - targetRow);
        alternativePaths.push({
          col: nextCol,
          row: nextRow,
          distance: distance,
        });
      }
    }

    // Sort by distance to target, then by col, then by row for deterministic order
    alternativePaths.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.col !== b.col) return a.col - b.col;
      return a.row - b.row;
    });

    // If we found an alternative step, return it
    if (alternativePaths.length > 0) {
      return [{ col: alternativePaths[0].col, row: alternativePaths[0].row }];
    }

    // No path found
    return null;
  }

  // Get a simple direct path without checking obstacles
  getDirectPath(startCol, startRow, targetCol, targetRow) {
    const path = [];

    // Calculate direction vector
    const dx = targetCol - startCol;
    const dy = targetRow - startRow;

    // Calculate number of steps needed
    const steps = Math.max(Math.abs(dx), Math.abs(dy));

    if (steps === 0) return path;

    // Calculate step increments
    const stepX = dx / steps;
    const stepY = dy / steps;

    // Generate path
    for (let i = 1; i <= steps; i++) {
      const nextCol = Math.round(startCol + stepX * i);
      const nextRow = Math.round(startRow + stepY * i);

      // Add to path if position has changed
      if (
        path.length === 0 ||
        path[path.length - 1].col !== nextCol ||
        path[path.length - 1].row !== nextRow
      ) {
        path.push({ col: nextCol, row: nextRow });
      }
    }

    return path;
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

  // Simple check if the current path is still valid
  isPathStillValid(gameObject, currentPath, allowedObstacleTypes = [0]) {
    if (!currentPath || currentPath.length === 0) {
      return false;
    }

    // Only check the next step
    const nextStep = currentPath[0];
    return this.canOccupyExcludingSelf(
      nextStep.col,
      nextStep.row,
      gameObject.gridWidth,
      gameObject.gridHeight,
      gameObject.expansionDirection,
      gameObject,
      allowedObstacleTypes
    );
  }

  // Simple check for path recalculation
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

    return {
      needsRecalculation: false,
      nextStep: {
        dx: nextPosition.col - gameObject.gridCol,
        dy: nextPosition.row - gameObject.gridRow,
      },
    };
  }
}
