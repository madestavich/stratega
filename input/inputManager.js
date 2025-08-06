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

    // Додаємо стан для вибраного юніта
    this.selectedUnitKey = null;
    this.gameManager = gameManager;
    this.canvas = canvas;

    // Ready button
    this.readyButton = document.getElementById('ready-button');

    // Ініціалізуємо обробники для вибору юнітів
    this.initUnitSelectionHandlers();

    // Ініціалізуємо обробники для розміщення юнітів на карті
    this.initCanvasHandlers();
    
    // Ініціалізуємо обробник кнопки ready
    this.initReadyButton();
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

  initCanvasHandlers() {
    if (this.canvas) {
      this.canvas.addEventListener("mousemove", (event) => {
        const rect = this.canvas.getBoundingClientRect();

        // Враховуємо можливе масштабування канвасу
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // Перетворюємо координати з урахуванням масштабування
        this.mouse.x = (event.clientX - rect.left) * scaleX;
        this.mouse.y = (event.clientY - rect.top) * scaleY;

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

  // Метод для автоматичного визначення тіеру та конфігурації юніта
  getUnitConfigAndTier(unitKey) {
    if (!this.gameManager || !unitKey) {
      return { unitConfig: null, unitTier: null };
    }

    try {
      const racesConfig = this.gameManager.configLoader.racesConfig;
      if (!racesConfig) {
        console.warn("Races configuration not found");
        return { unitConfig: null, unitTier: null };
      }

      // Просто перебираємо всі раси і тіери, шукаючи юніт за ключем
      for (const race in racesConfig) {
        if (racesConfig[race].units) {
          for (const tier in racesConfig[race].units) {
            if (
              racesConfig[race].units[tier] &&
              racesConfig[race].units[tier][unitKey]
            ) {
              return {
                unitConfig: racesConfig[race].units[tier][unitKey],
                unitTier: tier,
              };
            }
          }
        }
      }

      console.warn(`Unit configuration not found for ${unitKey}`);
      return { unitConfig: null, unitTier: null };
    } catch (error) {
      console.error("Error in getUnitConfigAndTier:", error);
      return { unitConfig: null, unitTier: null };
    }
  }

  drawHoverIndicator(ctx) {
    if (this.hoverCell && this.gameManager) {
      const { col, row } = this.hoverCell;
      const { cellWidth, cellHeight } = this.gameManager.gridManager;

      // If a unit is selected, show the unit's footprint
      if (this.selectedUnitKey) {
        // Використовуємо новий метод для отримання конфігурації юніта
        const { unitConfig } = this.getUnitConfigAndTier(this.selectedUnitKey);

        if (unitConfig) {
          const gridWidth = unitConfig.gridWidth || 1;
          const gridHeight = unitConfig.gridHeight || 1;
          const expansionDirection =
            unitConfig.expansionDirection || "bottomRight";

          // Create a temporary object to check placement
          const tempObject = {
            gridCol: col,
            gridRow: row,
            gridWidth: gridWidth,
            gridHeight: gridHeight,
            expansionDirection: expansionDirection,
          };

          // Check if placement is valid
          const canPlace = this.gameManager.gridManager.canPlaceAt(
            tempObject,
            col,
            row
          );

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

          // Draw the unit's footprint with different color based on placement validity
          ctx.fillStyle = canPlace
            ? "rgba(37, 201, 119, 0.4)" // Green if can place
            : "rgba(255, 0, 0, 0.4)"; // Red if cannot place

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

  async placeUnitAtCursor() {
    // Allow unit placement only when game is paused (between rounds)
    if (!this.gameManager.isPaused) {
      console.log("Cannot place units during active battle. Wait for next round.");
      return;
    }

    const gridCoords = this.gameManager.gridManager.getGridCellFromPixel(
      this.mouse.x,
      this.mouse.y
    );

    try {
      // Використовуємо новий метод для отримання конфігурації юніта
      const { unitConfig } = this.getUnitConfigAndTier(this.selectedUnitKey);

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

      // ВАЖЛИВО: Спочатку оновлюємо сітку, щоб мати актуальну інформацію про зайняті клітинки
      this.gameManager.gridManager.updateGridObjects(
        this.gameManager.objectManager
      );

      // Використовуємо існуючий метод canPlaceAt для перевірки
      const canPlace = this.gameManager.gridManager.canPlaceAt(
        tempObject,
        gridCoords.col,
        gridCoords.row
      );

      if (!canPlace) {
        return; // Виходимо з функції, не створюючи юніта
      }

      await this.gameManager.objectManager.createObject(
        this.selectedUnitKey,
        { ...unitConfig }, // Create a copy to avoid modifying the original
        this.gameManager.player.team,
        gridCoords.col,
        gridCoords.row
      );
      
      // Update grid with ALL objects (including enemy units) to ensure proper collision detection
      this.gameManager.objectManager.updateGridWithAllObjects();
      
      // Save units to database immediately after creating new unit
      await this.gameManager.objectManager.saveObjects();
      console.log("New unit saved to database for synchronization");
    } catch (error) {
      console.error(`Error creating unit ${this.selectedUnitKey}:`, error);
    }
  }

  // Initialize ready button handler
  initReadyButton() {
    if (this.readyButton) {
      this.readyButton.addEventListener('click', () => {
        this.handleReadyClick();
      });
    } else {
      console.warn('Ready button not found in DOM');
    }
  }

  // Handle ready button click
  async handleReadyClick() {
    if (!this.gameManager || !this.gameManager.objectManager.currentRoomId) {
      console.error('Cannot set ready: no room ID available');
      return;
    }

    // Disable button to prevent multiple clicks
    if (this.readyButton) {
      this.readyButton.disabled = true;
      this.readyButton.textContent = 'Готовий...';
    }

    try {
      // Call gameManager's setPlayerReady method
      await this.gameManager.setPlayerReady();
      
      // Update button state
      if (this.readyButton) {
        this.readyButton.textContent = 'Готовий ✓';
        this.readyButton.style.backgroundColor = '#4CAF50';
      }
      
      console.log('Player marked as ready via button');
    } catch (error) {
      console.error('Error setting player ready:', error);
      
      // Re-enable button on error
      if (this.readyButton) {
        this.readyButton.disabled = false;
        this.readyButton.textContent = 'Готовий';
        this.readyButton.style.backgroundColor = '';
      }
    }
  }
}
