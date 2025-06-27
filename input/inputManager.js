export class InputManager {
  constructor(canvas, gameManager) {
    this.keys = [];
    this.mouse = {
      x: 0,
      y: 0,
      left: false,
      right: false,
      middle: false,
    };
    this.hoverCell = null;

    // Додаємо стан для кнопки плей/пауза
    this.playButton = document.querySelector(".start-button");
    this.playButtonCallback = null;

    // Додаємо стан для вибраного юніта
    this.selectedUnitKey = null;
    this.gameManager = gameManager;
    this.canvas = canvas;

    // Ініціалізуємо обробник для кнопки
    if (this.playButton) {
      this.playButton.addEventListener("click", () => {
        if (this.playButtonCallback) {
          this.playButtonCallback();
        }
      });
    }

    // Ініціалізуємо обробники для вибору юнітів
    this.initUnitSelectionHandlers();

    // Ініціалізуємо обробники для розміщення юнітів на карті
    this.initCanvasHandlers();
  }

  // Метод для встановлення колбеку для кнопки
  setPlayButtonCallback(callback) {
    this.playButtonCallback = callback;
  }

  // Метод для оновлення тексту кнопки
  updatePlayButtonText(isPaused) {
    if (this.playButton) {
      this.playButton.textContent = isPaused ? "START" : "PAUSE";
    }
  }

  // Ініціалізація обробників для вибору юнітів
  initUnitSelectionHandlers() {
    // Додаємо делегування подій для всіх юніт-іконок
    document.addEventListener("click", (event) => {
      const unitIcon = event.target.closest(".unit-icon");
      if (unitIcon && unitIcon.hasAttribute("data-unit-key")) {
        this.selectUnit(unitIcon.getAttribute("data-unit-key"));
      }
    });
  }

  // Ініціалізація обробників для розміщення юнітів на карті
  initCanvasHandlers() {
    if (this.canvas) {
      this.canvas.addEventListener("mousemove", (event) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = event.clientX - rect.left;
        this.mouse.y = event.clientY - rect.top;
      });

      this.canvas.addEventListener("click", (event) => {
        if (this.selectedUnitKey && this.gameManager) {
          this.placeUnitAtCursor();
        }
      });
    }
  }

  // Метод для вибору юніта
  selectUnit(unitKey) {
    this.selectedUnitKey = unitKey;
    console.log(`Selected unit: ${unitKey}`);

    // Візуально виділяємо вибраний юніт
    document.querySelectorAll(".unit-icon").forEach((icon) => {
      if (icon.getAttribute("data-unit-key") === unitKey) {
        icon.style.borderColor = "#ffcc00";
        icon.style.boxShadow = "0 0 10px #ffcc00";
      } else {
        icon.style.borderColor = "#666";
        icon.style.boxShadow = "none";
      }
    });
  }

  // Modify the placeUnitAtCursor method in InputManager
  placeUnitAtCursor() {
    if (!this.gameManager || !this.selectedUnitKey) return;

    // Отримуємо координати сітки з координат миші
    const gridCoords = this.gameManager.gridManager.getGridCellFromPixel(
      this.mouse.x,
      this.mouse.y
    );

    if (!gridCoords) return;

    try {
      // Отримуємо конфігурацію юніта
      const unitConfig = this.gameManager.configLoader.getUnitConfig(
        this.gameManager.player.race,
        "tier_two", // Припускаємо, що всі юніти в tier_two для прикладу
        this.selectedUnitKey
      );

      if (!unitConfig) {
        console.error(
          `Unit configuration not found for ${this.selectedUnitKey}`
        );
        return;
      }

      // Створюємо тимчасовий об'єкт для перевірки розміщення
      const tempObject = {
        gridCol: gridCoords.col,
        gridRow: gridCoords.row,
        gridWidth: unitConfig.gridWidth || 1,
        gridHeight: unitConfig.gridHeight || 1,
        expansionDirection: unitConfig.expansionDirection || "bottomRight",
      };

      console.log("Checking placement at:", gridCoords.col, gridCoords.row);
      console.log(
        "Unit dimensions:",
        tempObject.gridWidth,
        "x",
        tempObject.gridHeight
      );

      // Використовуємо існуючий метод canPlaceAt для перевірки
      const canPlace = this.gameManager.gridManager.canPlaceAt(
        tempObject,
        gridCoords.col,
        gridCoords.row
      );
      console.log("Can place:", canPlace);

      if (!canPlace) {
        console.log(
          `Cannot place unit at ${gridCoords.col}, ${gridCoords.row} - not enough space or occupied cells`
        );
        return; // Виходимо з функції, не створюючи юніта
      }

      // Використовуємо існуючий метод для створення об'єкта ТІЛЬКИ якщо перевірка пройшла успішно
      console.log("Creating unit at:", gridCoords.col, gridCoords.row);
      const newUnit = this.gameManager.objectManager.createObject(
        this.selectedUnitKey,
        { ...unitConfig }, // Create a copy to avoid modifying the original
        this.gameManager.player.team,
        gridCoords.col,
        gridCoords.row
      );

      if (newUnit) {
        console.log("Unit created at:", newUnit.gridCol, newUnit.gridRow);
        // Check if the unit was created at the expected position
        if (
          newUnit.gridCol !== gridCoords.col ||
          newUnit.gridRow !== gridCoords.row
        ) {
          console.warn(
            "Unit was repositioned from",
            gridCoords.col,
            gridCoords.row,
            "to",
            newUnit.gridCol,
            newUnit.gridRow
          );
        }
      }

      // Важливо: оновлюємо сітку одразу після створення юніта
      this.gameManager.gridManager.updateGridObjects(
        this.gameManager.objectManager
      );
    } catch (error) {
      console.error(`Error creating unit ${this.selectedUnitKey}:`, error);
    }
  }

  // Add this method to the InputManager class
  initCanvasHandlers() {
    if (this.canvas) {
      this.canvas.addEventListener("mousemove", (event) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = event.clientX - rect.left;
        this.mouse.y = event.clientY - rect.top;

        // Update the hover cell
        this.hoverCell = this.gameManager.gridManager.getGridCellFromPixel(
          this.mouse.x,
          this.mouse.y
        );
      });

      this.canvas.addEventListener("click", (event) => {
        if (this.selectedUnitKey && this.gameManager) {
          this.placeUnitAtCursor();
        }
      });
    }
  }

  // Add this method to the InputManager class
  drawHoverIndicator(ctx) {
    if (this.hoverCell && this.gameManager) {
      const { col, row } = this.hoverCell;
      const { cellWidth, cellHeight } = this.gameManager.gridManager;

      // Draw a semi-transparent rectangle over the hovered cell
      ctx.fillStyle = "rgba(25, 0, 255, 0.3)";
      ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);

      // If a unit is selected, show the unit's footprint
      if (this.selectedUnitKey) {
        const unitConfig = this.gameManager.configLoader.getUnitConfig(
          this.gameManager.player.race,
          "tier_two",
          this.selectedUnitKey
        );

        if (unitConfig) {
          const gridWidth = unitConfig.gridWidth || 1;
          const gridHeight = unitConfig.gridHeight || 1;
          const expansionDirection =
            unitConfig.expansionDirection || "bottomRight";

          // Calculate the area the unit would occupy
          let startCol = col;
          let startRow = row;

          // Adjust based on expansion direction
          switch (expansionDirection) {
            case "topLeft":
              startCol = col - (gridWidth - 1);
              startRow = row - (gridHeight - 1);
              break;
            case "topRight":
              startRow = row - (gridHeight - 1);
              break;
            case "bottomLeft":
              startCol = col - (gridWidth - 1);
              break;
            case "bottomRight":
            default:
              // No adjustment needed
              break;
          }

          // Draw the unit's footprint
          ctx.fillStyle = "rgba(0, 255, 0, 0.3)";
          ctx.fillRect(
            startCol * cellWidth,
            startRow * cellHeight,
            gridWidth * cellWidth,
            gridHeight * cellHeight
          );
        }
      }
    }
  }
}
