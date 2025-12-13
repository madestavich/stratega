/**
 * DebugManager - модуль для управління debug візуалізаціями
 * Виділено з gameManager.js для кращої модульності
 */

export class DebugManager {
  constructor(gameManager) {
    this.gameManager = gameManager;
    this.gridManager = gameManager.gridManager;
    this.objectManager = gameManager.objectManager;
    this.actionManager = gameManager.actionManager;
    this.ctx = this.gridManager.ctx;

    // Debug mode state
    this.enabled = false;

    // Debug layers - кожен шар можна тогглити окремо
    this.layers = {
      grid: true, // Відображення сітки
      occupiedCells: true, // Зайняті клітинки
      movePaths: true, // Шляхи руху юнітів
      auraRanges: true, // Радіуси аур
      rangedAttackRange: true, // Дальність атаки для рендж юнітів
      aoeCells: true, // AoE зони атаки
      unitFrames: true, // Debug рамки юнітів (frame, bulletPoint)
    };

    // AoE cells storage
    this.aoeDebugCells = null;

    // Debug panel element
    this.panelElement = null;

    // Setup keyboard shortcut
    this.setupKeyboardShortcut();
  }

  setupKeyboardShortcut() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "`") {
        this.toggle();
      }
    });
  }

  toggle() {
    this.enabled = !this.enabled;

    if (this.enabled) {
      console.log(
        "%c Debug mode enabled.",
        "background: #222; color:rgb(47, 201, 9); font-size: 14px;"
      );
      this.gridManager.updateGridObjects(this.objectManager);
      this.showPanel();
    } else {
      console.log(
        "%c Debug mode disabled.",
        "background: #222; color:rgb(255, 38, 0); font-size: 14px;"
      );
      this.hidePanel();
    }

    // Force render to apply changes
    this.gameManager.render();
  }

  // Показати/сховати панель debug
  showPanel() {
    if (!this.panelElement) {
      this.createPanel();
    }
    this.panelElement.style.display = "flex";
  }

  hidePanel() {
    if (this.panelElement) {
      this.panelElement.style.display = "none";
    }
  }

  createPanel() {
    // Створюємо контейнер панелі
    this.panelElement = document.createElement("div");
    this.panelElement.className = "debug-panel";
    this.panelElement.innerHTML = `
      <div class="debug-panel-header">
        <span>Debug Layers</span>
        <button class="debug-close-btn">&times;</button>
      </div>
      <div class="debug-panel-content">
        ${this.createToggleButton("grid", "Grid", "Показати сітку")}
        ${this.createToggleButton(
          "occupiedCells",
          "Occupied",
          "Зайняті клітинки"
        )}
        ${this.createToggleButton("movePaths", "Paths", "Шляхи руху")}
        ${this.createToggleButton("auraRanges", "Auras", "Радіуси аур")}
        ${this.createToggleButton(
          "rangedAttackRange",
          "Range",
          "Дальність атаки"
        )}
        ${this.createToggleButton("aoeCells", "AoE", "AoE зони")}
        ${this.createToggleButton("unitFrames", "Frames", "Debug рамки юнітів")}
      </div>
    `;

    document.body.appendChild(this.panelElement);

    // Додаємо обробники подій
    this.panelElement
      .querySelector(".debug-close-btn")
      .addEventListener("click", () => {
        this.toggle();
      });

    // Обробники для кнопок toggle
    this.panelElement.querySelectorAll(".debug-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const layer = btn.dataset.layer;
        this.toggleLayer(layer);
        btn.classList.toggle("active");
      });
    });
  }

  createToggleButton(layer, label, tooltip) {
    const isActive = this.layers[layer] ? "active" : "";
    return `
      <button class="debug-toggle-btn ${isActive}" data-layer="${layer}" title="${tooltip}">
        ${label}
      </button>
    `;
  }

  toggleLayer(layerName) {
    if (this.layers.hasOwnProperty(layerName)) {
      this.layers[layerName] = !this.layers[layerName];
      console.log(
        `Debug layer '${layerName}': ${this.layers[layerName] ? "ON" : "OFF"}`
      );
    }
  }

  // Основний метод рендерингу всіх debug візуалізацій
  render() {
    if (!this.enabled) return;

    // Grid
    if (this.layers.grid) {
      this.gridManager.debugDrawGrid();
    }

    // Occupied cells
    if (this.layers.occupiedCells) {
      this.gridManager.debugColorOccupiedCells();
    }

    // Move paths
    if (this.layers.movePaths) {
      this.renderMovePaths();
    }

    // Aura ranges
    if (this.layers.auraRanges) {
      this.renderAuraRanges();
    }

    // Ranged attack range
    if (this.layers.rangedAttackRange) {
      this.renderRangedAttackRanges();
    }

    // AoE cells (рендериться останнім, поверх всього)
    if (this.layers.aoeCells && this.aoeDebugCells) {
      this.gridManager.debugDrawAoECells(this.aoeDebugCells);
    }
  }

  renderMovePaths() {
    const moveAction = this.actionManager.actions.move;
    if (!moveAction) return;

    // Player units (blue)
    for (const obj of this.objectManager.objects) {
      if (obj.moveTarget && !obj.isDead) {
        moveAction.debugDrawPath(obj);
      }
    }

    // Enemy units (red)
    for (const obj of this.objectManager.enemyObjects) {
      if (obj.moveTarget && !obj.isDead) {
        moveAction.debugDrawPath(obj, "rgba(255,0,0,0.8)");
      }
    }
  }

  renderAuraRanges() {
    const auraAction = this.actionManager.actions.aura;
    if (!auraAction) return;

    for (const obj of this.objectManager.objects) {
      if (obj.auraConfig && !obj.isDead) {
        auraAction.debugDrawAuraRange(obj);
      }
    }

    for (const obj of this.objectManager.enemyObjects) {
      if (obj.auraConfig && !obj.isDead) {
        auraAction.debugDrawAuraRange(obj);
      }
    }
  }

  /**
   * Рендеринг дальності атаки для рендж юнітів
   */
  renderRangedAttackRanges() {
    // Player units
    for (const obj of this.objectManager.objects) {
      if (obj.isRanged && !obj.isDead) {
        this.debugDrawRangedAttackRange(obj, "player");
      }
    }

    // Enemy units
    for (const obj of this.objectManager.enemyObjects) {
      if (obj.isRanged && !obj.isDead) {
        this.debugDrawRangedAttackRange(obj, "enemy");
      }
    }
  }

  /**
   * Малює дальність рендж атаки юніта (min та max range)
   * @param {GameObject} gameObject - юніт з рендж атакою
   * @param {string} team - 'player' або 'enemy' для визначення кольору
   */
  debugDrawRangedAttackRange(gameObject, team = "player") {
    const minRange = gameObject.minRangeDistance || 1;
    const maxRange = gameObject.maxRangeDistance || 10;

    // Кольори в залежності від команди
    const colors =
      team === "player"
        ? {
            minFill: "rgba(255, 100, 100, 0.15)", // Мертва зона - червона
            minStroke: "rgba(255, 100, 100, 0.5)",
            maxFill: "rgba(100, 200, 255, 0.1)", // Зона атаки - синя
            maxStroke: "rgba(100, 200, 255, 0.4)",
          }
        : {
            minFill: "rgba(255, 150, 100, 0.15)", // Мертва зона - оранжева
            minStroke: "rgba(255, 150, 100, 0.5)",
            maxFill: "rgba(255, 100, 100, 0.1)", // Зона атаки - червона
            maxStroke: "rgba(255, 100, 100, 0.4)",
          };

    // Центр юніта (в клітинках)
    const centerCol = gameObject.gridCol + (gameObject.gridWidth - 1) / 2;
    const centerRow = gameObject.gridRow + (gameObject.gridHeight - 1) / 2;

    this.ctx.save();

    // Малюємо зону атаки (maxRange) - зелені/сині клітинки
    const maxRangeInt = Math.ceil(maxRange);
    for (let dy = -maxRangeInt; dy <= maxRangeInt; dy++) {
      for (let dx = -maxRangeInt; dx <= maxRangeInt; dx++) {
        const col = Math.floor(centerCol) + dx;
        const row = Math.floor(centerRow) + dy;

        // Перевіряємо межі сітки
        if (
          col < 0 ||
          col >= this.gridManager.cols ||
          row < 0 ||
          row >= this.gridManager.rows
        ) {
          continue;
        }

        // Обчислюємо відстань (Chebyshev distance для grid-based)
        const distance = Math.max(Math.abs(dx), Math.abs(dy));

        // Якщо в зоні атаки (між min і max)
        if (distance >= minRange && distance <= maxRange) {
          const x = col * this.gridManager.cellWidth;
          const y = row * this.gridManager.cellHeight;

          this.ctx.fillStyle = colors.maxFill;
          this.ctx.fillRect(
            x,
            y,
            this.gridManager.cellWidth,
            this.gridManager.cellHeight
          );
        }
      }
    }

    // Малюємо мертву зону (minRange) - червоні клітинки
    const minRangeInt = Math.ceil(minRange);
    for (let dy = -minRangeInt; dy <= minRangeInt; dy++) {
      for (let dx = -minRangeInt; dx <= minRangeInt; dx++) {
        const col = Math.floor(centerCol) + dx;
        const row = Math.floor(centerRow) + dy;

        // Перевіряємо межі сітки
        if (
          col < 0 ||
          col >= this.gridManager.cols ||
          row < 0 ||
          row >= this.gridManager.rows
        ) {
          continue;
        }

        // Обчислюємо відстань
        const distance = Math.max(Math.abs(dx), Math.abs(dy));

        // Якщо в мертвій зоні (менше min)
        if (distance < minRange) {
          const x = col * this.gridManager.cellWidth;
          const y = row * this.gridManager.cellHeight;

          this.ctx.fillStyle = colors.minFill;
          this.ctx.fillRect(
            x,
            y,
            this.gridManager.cellWidth,
            this.gridManager.cellHeight
          );
        }
      }
    }

    // Малюємо контур максимальної дальності
    this.drawRangeCircle(centerCol, centerRow, maxRange, colors.maxStroke);

    // Малюємо контур мінімальної дальності
    this.drawRangeCircle(centerCol, centerRow, minRange, colors.minStroke);

    this.ctx.restore();
  }

  /**
   * Малює контур кола для дальності (апроксимація на сітці)
   */
  drawRangeCircle(centerCol, centerRow, range, strokeColor) {
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 2;

    const rangeInt = Math.ceil(range);
    const cellWidth = this.gridManager.cellWidth;
    const cellHeight = this.gridManager.cellHeight;

    // Малюємо межу range зони
    for (let dy = -rangeInt; dy <= rangeInt; dy++) {
      for (let dx = -rangeInt; dx <= rangeInt; dx++) {
        const col = Math.floor(centerCol) + dx;
        const row = Math.floor(centerRow) + dy;

        if (
          col < 0 ||
          col >= this.gridManager.cols ||
          row < 0 ||
          row >= this.gridManager.rows
        ) {
          continue;
        }

        const distance = Math.max(Math.abs(dx), Math.abs(dy));

        // Малюємо тільки на межі
        if (distance === Math.floor(range)) {
          const x = col * cellWidth;
          const y = row * cellHeight;

          // Перевіряємо чи сусідні клітинки за межами range
          const checkBorder = (ddx, ddy) => {
            const nd = Math.max(Math.abs(dx + ddx), Math.abs(dy + ddy));
            return nd > range;
          };

          this.ctx.beginPath();

          // Top border
          if (checkBorder(0, -1)) {
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x + cellWidth, y);
          }
          // Bottom border
          if (checkBorder(0, 1)) {
            this.ctx.moveTo(x, y + cellHeight);
            this.ctx.lineTo(x + cellWidth, y + cellHeight);
          }
          // Left border
          if (checkBorder(-1, 0)) {
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x, y + cellHeight);
          }
          // Right border
          if (checkBorder(1, 0)) {
            this.ctx.moveTo(x + cellWidth, y);
            this.ctx.lineTo(x + cellWidth, y + cellHeight);
          }

          this.ctx.stroke();
        }
      }
    }
  }

  /**
   * Встановити AoE клітинки для відображення
   * @param {Array} cells - масив клітинок для відображення
   */
  setAoECells(cells) {
    this.aoeDebugCells = cells;
  }

  /**
   * Очистити AoE клітинки
   */
  clearAoECells() {
    this.aoeDebugCells = null;
  }

  /**
   * Перевірити чи ввімкнений debug режим
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Перевірити чи ввімкнений конкретний шар
   */
  isLayerEnabled(layerName) {
    return this.enabled && this.layers[layerName];
  }
}
