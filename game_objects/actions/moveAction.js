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
    try {
      // Check basic conditions
      if (gameObject.isDead) {
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

      // Check if target is occupied and find nearest free cell if needed
      let finalTargetCol = targetCol;
      let finalTargetRow = targetRow;

      // Безпечна перевірка перед викликом canOccupyExcludingSelf
      if (finalTargetCol === undefined || finalTargetRow === undefined) {
        if (gameObject.moveTarget) {
          // Використовуємо збережену ціль, якщо вона є
          finalTargetCol = gameObject.moveTarget.col;
          finalTargetRow = gameObject.moveTarget.row;
        } else {
          // Немає цілі для руху
          return false;
        }
      }

      // Check if the target position is occupied
      const canOccupy = this.pathfinder.canOccupyExcludingSelf(
        finalTargetCol,
        finalTargetRow,
        gameObject.gridWidth,
        gameObject.gridHeight,
        gameObject.expansionDirection,
        gameObject,
        allowedObstacleTypes
      );

      if (!canOccupy) {
        // Find nearest free cell around the target
        const nearestFree = this.findNearestFreeCell(
          gameObject,
          finalTargetCol,
          finalTargetRow,
          allowedObstacleTypes
        );
        if (nearestFree) {
          finalTargetCol = nearestFree.col;
          finalTargetRow = nearestFree.row;
        } else {
          // No free cells found near target
          return false;
        }
      }

      // Find a path to the target
      const path = this.pathfinder.findPath(
        gameObject.gridCol,
        gameObject.gridRow,
        finalTargetCol,
        finalTargetRow,
        gameObject.gridWidth,
        gameObject.gridHeight,
        gameObject.expansionDirection,
        gameObject,
        allowedObstacleTypes
      );

      // If no path found, we can't execute the action
      if (!path || path.length === 0) {
        return false;
      }

      // Store the path and target for future use
      gameObject.currentPath = path;
      gameObject.moveTarget = { col: finalTargetCol, row: finalTargetRow };

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
    } catch (error) {
      console.error("Error in MoveAction.canExecute:", error, {
        gameObject: gameObject
          ? {
              type: gameObject.objectType,
              col: gameObject.gridCol,
              row: gameObject.gridRow,
            }
          : null,
        targetCol,
        targetRow,
      });
      return false;
    }
  }

  // Find the nearest free cell around a target position
  findNearestFreeCell(gameObject, targetCol, targetRow, allowedObstacleTypes) {
    // Search in expanding rings around the target
    for (let radius = 1; radius <= 5; radius++) {
      // Limit search radius to 5 cells
      // Check all cells in the current radius
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Only check cells at the current radius (on the perimeter)
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
            const checkCol = targetCol + dx;
            const checkRow = targetRow + dy;

            // Check if this position can be occupied
            if (
              this.pathfinder.canOccupyExcludingSelf(
                checkCol,
                checkRow,
                gameObject.gridWidth,
                gameObject.gridHeight,
                gameObject.expansionDirection,
                gameObject,
                allowedObstacleTypes
              )
            ) {
              // Found a free cell
              return { col: checkCol, row: checkRow };
            }
          }
        }
      }
    }

    // No free cells found within the search radius
    return null;
  }

  // Execute the move action
  execute(gameObject, deltaTime) {
    // If we don't have a path or next position, we can't move
    if (!gameObject.currentPath || !gameObject.nextGridPosition) {
      return;
    }

    // Встановлюємо анімацію руху, якщо об'єкт ще не рухається
    if (gameObject.isMoving) {
      // Перевіряємо, чи поточна анімація не "move"
      if (gameObject.animator.activeAnimation.name !== "move") {
        gameObject.animator.setAnimation("move");
      }
    } else {
      // Встановлюємо анімацію руху, якщо об'єкт ще не рухається
      gameObject.animator.setAnimation("move");
      // Set the moving flag
      gameObject.isMoving = true;
    }

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
    const speedMultiplier = 5; // Додатковий множник швидкості
    const moveDistance =
      (gameObject.moveSpeed * deltaTime * speedMultiplier) / 1000;

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
        // Перевіряємо, чи анімація руху дійшла до останнього кадру
        const animator = gameObject.animator;
        const isLastFrame =
          animator.frameIndex === animator.activeAnimation.frames.length - 1;

        // Якщо це останній кадр анімації руху або анімація не "move", встановлюємо "idle"
        if (isLastFrame && animator.activeAnimation.name == "move") {
          gameObject.isMoving = false;
          gameObject.animator.setAnimation("idle");
        }

        gameObject.currentPath = null;
        gameObject.nextGridPosition = null;
        gameObject.lookDirection = gameObject.moveDirection;
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

  cancelMovement(gameObject, keepAnimation = false) {
    // Не змінюємо анімацію, якщо об'єкт мертвий
    if (
      !keepAnimation &&
      !gameObject.isDead &&
      gameObject.animator.activeAnimation.name != "idle"
    ) {
      gameObject.animator.setAnimation("idle");
    }
    gameObject.isMoving = false;
    gameObject.currentPath = null;
    gameObject.nextGridPosition = null;
    gameObject.moveTarget = null;
  }

  // Debug method to draw a direct line from object to movement target
  debugDrawPath(gameObject) {
    if (!gameObject || !gameObject.moveTarget) return;

    const ctx = gameObject.gridManager.ctx;
    const { cellWidth, cellHeight } = gameObject.gridManager;

    // Save current context state
    ctx.save();

    // Determine line color based on team
    let lineColor, targetColor;

    switch (gameObject.team) {
      case 1:
        lineColor = "rgba(0, 100, 255, 0.7)"; // Blue for team 1
        targetColor = "rgba(0, 50, 255, 0.7)";
        break;
      case 2:
        lineColor = "rgba(255, 50, 0, 0.7)"; // Red for team 2
        targetColor = "rgba(255, 100, 0, 0.7)";
        break;
      default:
        lineColor = "rgba(0, 255, 0, 0.7)"; // Green for any other team
        targetColor = "rgba(255, 165, 0, 0.7)";
    }

    // Draw direct line from object to target
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;

    // Start from object's center
    ctx.moveTo(gameObject.x, gameObject.y);

    // Draw direct line to target
    const targetCenterX = (gameObject.moveTarget.col + 0.5) * cellWidth;
    const targetCenterY = (gameObject.moveTarget.row + 0.5) * cellHeight;
    ctx.lineTo(targetCenterX, targetCenterY);

    ctx.stroke();

    // Draw a circle at the target location
    ctx.fillStyle = targetColor;
    ctx.beginPath();
    ctx.arc(targetCenterX, targetCenterY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Restore context state
    ctx.restore();
  }
}
