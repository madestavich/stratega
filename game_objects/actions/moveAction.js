import { Pathfinder } from "../../import.js";

export class MoveAction {
  constructor(objectManager) {
    this.objectManager = objectManager;
    this.pathfinder = null;
  }

  // Initialize the pathfinder if needed
  ensurePathfinder(gameObject) {
    if (!this.pathfinder && gameObject.gridManager) {
      this.pathfinder = new Pathfinder(gameObject.gridManager);
    }
    return this.pathfinder != null;
  }

  // Check if the move action can be executed
  canExecute(gameObject, targetCol, targetRow, allowedObstacleTypes = [0]) {
    // Get the type config directly from the object's configuration
    const typeConfig = gameObject.objectConfig;

    // Check basic conditions
    if (!typeConfig || typeConfig.moveSpeed <= 0) {
      return false;
    }

    // Ensure we have a pathfinder
    if (!this.ensurePathfinder(gameObject)) {
      return false;
    }

    // If the object is already moving, check if we need to recalculate the path
    if (gameObject.isMoving && gameObject.currentPath) {
      // Check if the target has changed
      if (
        gameObject.moveTarget &&
        (gameObject.moveTarget.col !== targetCol ||
          gameObject.moveTarget.row !== targetRow)
      ) {
        // Target changed, need to recalculate
        gameObject.currentPath = null;
      } else {
        // Check if the current path is still valid
        const pathStatus = this.pathfinder.checkAdjacentCells(
          gameObject,
          gameObject.currentPath,
          allowedObstacleTypes
        );

        if (!pathStatus.needsRecalculation) {
          // Path is still valid, continue using it
          return true;
        }
      }
    }

    // Find a path to the target
    const path = this.pathfinder.findPath(
      gameObject.gridCol,
      gameObject.gridRow,
      targetCol,
      targetRow,
      gameObject.gridWidth,
      gameObject.gridHeight,
      gameObject.expansionDirection,
      gameObject, // Передаємо сам об'єкт
      allowedObstacleTypes
    );

    // If no path found, we can't execute the action
    if (!path || path.length === 0) {
      return false;
    }

    // Store the path and target for future use
    gameObject.currentPath = path;
    gameObject.moveTarget = { col: targetCol, row: targetRow };

    // Set the next step from the path
    gameObject.nextGridPosition = {
      col: path[0].col,
      row: path[0].row,
    };

    // Calculate movement direction
    gameObject.moveDirection = {
      dx: path[0].col - gameObject.gridCol,
      dy: path[0].row - gameObject.gridRow,
    };

    return true;
  }

  // Execute the move action
  execute(gameObject, deltaTime) {
    // Get the type config directly from the object's configuration
    const typeConfig = gameObject.objectConfig;

    // If we don't have a path or next position, we can't move
    if (!gameObject.currentPath || !gameObject.nextGridPosition) {
      gameObject.isMoving = false;
      return;
    }

    // Set the moving flag
    gameObject.isMoving = true;

    // Calculate the target pixel position based on the next grid position
    const { cellWidth, cellHeight } = gameObject.gridManager;

    // Calculate anchor position based on expansion direction
    let anchorCol = gameObject.nextGridPosition.col;
    let anchorRow = gameObject.nextGridPosition.row;

    switch (gameObject.expansionDirection) {
      case "topLeft":
        anchorCol =
          gameObject.nextGridPosition.col - (gameObject.gridWidth - 1);
        anchorRow =
          gameObject.nextGridPosition.row - (gameObject.gridHeight - 1);
        break;
      case "topRight":
        anchorRow =
          gameObject.nextGridPosition.row - (gameObject.gridHeight - 1);
        break;
      case "bottomLeft":
        anchorCol =
          gameObject.nextGridPosition.col - (gameObject.gridWidth - 1);
        break;
      case "bottomRight":
      default:
        break;
    }

    // Calculate target position (center of the grid cell)
    const targetX = (anchorCol + gameObject.gridWidth / 2) * cellWidth;
    const targetY = (anchorRow + gameObject.gridHeight / 2) * cellHeight;

    // Calculate distance to move this frame based on speed and deltaTime
    const moveSpeed = typeConfig.moveSpeed;
    const speedMultiplier = 5; // Додатковий множник швидкості
    const moveDistance = (moveSpeed * deltaTime * speedMultiplier) / 1000;

    // Calculate direction vector to target
    const dx = targetX - gameObject.x;
    const dy = targetY - gameObject.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If we're close enough to the target, snap to it and move to the next step in the path
    if (distance <= moveDistance) {
      // Snap to the target position using setPosition
      gameObject.setPosition(targetX, targetY);

      // Update grid position
      gameObject.gridCol = gameObject.nextGridPosition.col;
      gameObject.gridRow = gameObject.nextGridPosition.row;

      // Update grid occupation
      gameObject.gridManager.updateObjectGridPosition(gameObject);

      // Remove the first step from the path
      gameObject.currentPath.shift();

      // If we've reached the end of the path, we're done
      if (gameObject.currentPath.length === 0) {
        gameObject.isMoving = false;
        gameObject.currentPath = null;
        gameObject.nextGridPosition = null;
        gameObject.moveDirection = null;
        return;
      }

      // Set the next step from the path
      gameObject.nextGridPosition = {
        col: gameObject.currentPath[0].col,
        row: gameObject.currentPath[0].row,
      };

      // Calculate new movement direction
      gameObject.moveDirection = {
        dx: gameObject.currentPath[0].col - gameObject.gridCol,
        dy: gameObject.currentPath[0].row - gameObject.gridRow,
      };
    } else {
      // Move towards the target using setPosition
      if (distance > 0) {
        const normalizedDx = dx / distance;
        const normalizedDy = dy / distance;

        const newX = gameObject.x + normalizedDx * moveDistance;
        const newY = gameObject.y + normalizedDy * moveDistance;

        // Use setPosition to update the object's position
        gameObject.setPosition(newX, newY);

        // Update grid position based on new pixel coordinates
        gameObject.gridManager.updateObjectGridPosition(gameObject);
      }
    }
  }

  // Set a new movement target for the object
  setMoveTarget(gameObject, targetCol, targetRow, allowedObstacleTypes = [0]) {
    // Reset current path
    gameObject.currentPath = null;
    gameObject.nextGridPosition = null;

    // Try to find a new path
    return this.canExecute(
      gameObject,
      targetCol,
      targetRow,
      allowedObstacleTypes
    );
  }

  // Check if the object has reached its target
  hasReachedTarget(gameObject) {
    return (
      !gameObject.isMoving &&
      gameObject.moveTarget &&
      gameObject.gridCol === gameObject.moveTarget.col &&
      gameObject.gridRow === gameObject.moveTarget.row
    );
  }

  // Cancel the current movement
  cancelMovement(gameObject) {
    gameObject.isMoving = false;
    gameObject.currentPath = null;
    gameObject.nextGridPosition = null;
    gameObject.moveDirection = null;
    gameObject.moveTarget = null;
  }
}
