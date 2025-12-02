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

    // Стан для системи груп юнітів
    this.ctrlPressed = false;
    this.selectedUnits = []; // Масив вибраних юнітів для групи
    this.isSelecting = false; // Чи зараз відбувається box selection
    this.selectionStart = null; // Початкова точка box selection {x, y}
    this.selectionEnd = null; // Кінцева точка box selection {x, y}
    this.unitGroups = {}; // Збережені групи: {1: {units: [...], moveTarget: null, actionPriorities: null}, ...}
    this.activeGroupId = null; // Активна група для редагування
    this.isSettingMoveTarget = false; // Режим вибору точки руху для групи

    // Ready button
    this.readyButton = document.getElementById("ready-button");

    // Ініціалізуємо обробники для вибору юнітів
    this.initUnitSelectionHandlers();

    // Ініціалізуємо обробники для розміщення юнітів на карті
    this.initCanvasHandlers();

    // Ініціалізуємо обробник кнопки ready
    this.initReadyButton();

    // Ініціалізуємо обробники клавіатури для груп
    this.initKeyboardHandlers();

    // Створюємо UI для груп
    this.createGroupsUI();
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

        // Оновлюємо кінцеву точку box selection
        if (this.isSelecting) {
          this.selectionEnd = { x: this.mouse.x, y: this.mouse.y };
        }
      });

      // Автоматичне завершення box selection при виході за межі канваса
      this.canvas.addEventListener("mouseleave", (event) => {
        if (this.isSelecting) {
          this.finishBoxSelection();
        }
      });

      // Початок box selection (mousedown)
      this.canvas.addEventListener("mousedown", (event) => {
        if (event.button === 0 && this.ctrlPressed) {
          // Ліва кнопка + Ctrl
          this.isSelecting = true;
          this.selectionStart = { x: this.mouse.x, y: this.mouse.y };
          this.selectionEnd = { x: this.mouse.x, y: this.mouse.y };
          event.preventDefault();
        }
      });

      // Кінець box selection (mouseup)
      this.canvas.addEventListener("mouseup", (event) => {
        if (event.button === 0 && this.isSelecting) {
          this.finishBoxSelection();
        }
      });

      this.canvas.addEventListener("click", (event) => {
        // Якщо Ctrl натиснуто - вибір юнітів вже оброблений в finishBoxSelection
        if (this.ctrlPressed) {
          return;
        }

        // Режим вибору точки руху для групи
        if (this.isSettingMoveTarget && this.activeGroupId) {
          const gridCoords = this.gameManager.gridManager.getGridCellFromPixel(
            this.mouse.x,
            this.mouse.y
          );
          this.setGroupMoveTarget(
            this.activeGroupId,
            gridCoords.col,
            gridCoords.row
          );
          this.isSettingMoveTarget = false;
          return;
        }

        // Звичайне розміщення юнітів
        if (this.selectedUnitKey && this.gameManager) {
          this.placeUnitAtCursor();
        }
      });
    }
  }

  // Ініціалізація обробників клавіатури
  initKeyboardHandlers() {
    document.addEventListener("keydown", (event) => {
      // Відстежуємо Ctrl
      if (event.key === "Control") {
        this.ctrlPressed = true;
      }

      // Escape - скасувати вибір
      if (event.key === "Escape") {
        this.clearUnitSelection();
        this.activeGroupId = null;
        this.isSettingMoveTarget = false;
        this.updateGroupsUI();
      }

      // M - вхід в режим вибору точки руху для групи (toggle)
      if (event.key === "m" || event.key === "M") {
        if (this.activeGroupId && this.unitGroups[this.activeGroupId]) {
          this.isSettingMoveTarget = !this.isSettingMoveTarget;
          console.log(
            `Move target mode ${
              this.isSettingMoveTarget ? "enabled" : "disabled"
            } for group ${this.activeGroupId}`
          );
          this.updateGroupsUI();
        }
      }

      // X - очистити moveTarget групи
      if (event.key === "x" || event.key === "X") {
        if (this.activeGroupId && this.unitGroups[this.activeGroupId]) {
          this.clearGroupMoveTarget(this.activeGroupId);
        }
      }

      // A - пріоритет атаки (attack first)
      if (event.key === "a" || event.key === "A") {
        if (
          !this.ctrlPressed &&
          this.activeGroupId &&
          this.unitGroups[this.activeGroupId]
        ) {
          this.setGroupPriority(this.activeGroupId, ["attack", "move"]);
        }
      }

      // R - пріоритет руху (move first)
      if (event.key === "r" || event.key === "R") {
        if (this.activeGroupId && this.unitGroups[this.activeGroupId]) {
          this.setGroupPriority(this.activeGroupId, ["move", "attack"]);
        }
      }

      // Цифри 1-5 - зберегти/вибрати групу (тільки не під час бою)
      if (
        event.key >= "1" &&
        event.key <= "5" &&
        !this.gameManager.isBattleInProgress
      ) {
        const groupId = parseInt(event.key);

        if (this.ctrlPressed) {
          // Prevent browser tab switching (Ctrl+1-9)
          event.preventDefault();
          // Ctrl + цифра = зберегти вибраних юнітів в групу
          this.saveGroup(groupId);
        } else {
          // Просто цифра = вибрати групу для перегляду/редагування
          this.selectGroup(groupId);
        }
      }
    });

    document.addEventListener("keyup", (event) => {
      if (event.key === "Control") {
        this.ctrlPressed = false;
      }
    });
  }

  // Обробка кліку для вибору юніта в групу
  handleUnitSelectionClick() {
    // Заборонити вибір юнітів під час бою
    if (this.gameManager.isBattleInProgress) {
      return;
    }

    const clickedUnit = this.getUnitAtPosition(this.mouse.x, this.mouse.y);

    if (clickedUnit) {
      // Перевіряємо чи юніт належить гравцю
      const playerObjects = this.gameManager.objectManager.objects;
      if (!playerObjects.includes(clickedUnit)) {
        console.log("Cannot select enemy units");
        return;
      }

      const index = this.selectedUnits.indexOf(clickedUnit);
      if (index !== -1) {
        // Юніт вже вибраний - видаляємо з вибору
        this.selectedUnits.splice(index, 1);
        console.log(`Removed unit ${clickedUnit.id} from selection`);
      } else {
        // Додаємо юніта до вибору
        this.selectedUnits.push(clickedUnit);
        console.log(`Added unit ${clickedUnit.id} to selection`);
      }
    }
  }

  // Завершення box selection
  finishBoxSelection() {
    if (!this.selectionStart || !this.selectionEnd) {
      this.isSelecting = false;
      return;
    }

    const minX = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const maxX = Math.max(this.selectionStart.x, this.selectionEnd.x);
    const minY = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const maxY = Math.max(this.selectionStart.y, this.selectionEnd.y);

    // Якщо область занадто мала - це просто клік (тогл юніта)
    if (maxX - minX < 10 && maxY - minY < 10) {
      this.isSelecting = false;
      this.selectionStart = null;
      this.selectionEnd = null;

      // Пробуємо знайти юніта під курсором
      const clickedUnit = this.getUnitAtPosition(this.mouse.x, this.mouse.y);
      if (clickedUnit) {
        const playerObjects = this.gameManager.objectManager.objects;
        if (playerObjects.includes(clickedUnit)) {
          const index = this.selectedUnits.indexOf(clickedUnit);
          if (index !== -1) {
            // Юніт вже вибраний - видаляємо з вибору
            this.selectedUnits.splice(index, 1);
            console.log(`Removed unit ${clickedUnit.id} from selection`);
          } else {
            // Додаємо юніта до вибору
            this.selectedUnits.push(clickedUnit);
            console.log(`Added unit ${clickedUnit.id} to selection`);
          }
        }
      }
      return;
    }

    // Box selection - скидаємо попередній вибір і вибираємо нових
    this.selectedUnits = [];

    // Знаходимо всіх юнітів гравця в межах selection box
    const playerObjects = this.gameManager.objectManager.objects;

    for (const unit of playerObjects) {
      if (
        unit.x >= minX &&
        unit.x <= maxX &&
        unit.y >= minY &&
        unit.y <= maxY
      ) {
        if (!this.selectedUnits.includes(unit)) {
          this.selectedUnits.push(unit);
        }
      }
    }

    console.log(`Box selection: ${this.selectedUnits.length} units selected`);

    this.isSelecting = false;
    this.selectionStart = null;
    this.selectionEnd = null;
  }

  // Отримати юніта на позиції
  getUnitAtPosition(x, y) {
    const allObjects = [
      ...this.gameManager.objectManager.objects,
      ...this.gameManager.objectManager.enemyObjects,
    ];

    for (const unit of allObjects) {
      // Перевіряємо чи клік потрапив на юніта
      const unitWidth = unit.gridWidth * this.gameManager.gridManager.cellWidth;
      const unitHeight =
        unit.gridHeight * this.gameManager.gridManager.cellHeight;

      // Враховуємо центр юніта
      const unitLeft = unit.x - unitWidth / 2;
      const unitRight = unit.x + unitWidth / 2;
      const unitTop = unit.y - unitHeight / 2;
      const unitBottom = unit.y + unitHeight / 2;

      if (x >= unitLeft && x <= unitRight && y >= unitTop && y <= unitBottom) {
        return unit;
      }
    }
    return null;
  }

  // Встановити пріоритет для групи
  setGroupPriority(groupId, priorities) {
    if (this.gameManager.isBattleInProgress) {
      console.log("Cannot modify groups during battle");
      return;
    }

    const group = this.unitGroups[groupId];
    if (!group) {
      console.log(`Group ${groupId} not found`);
      return;
    }

    group.actionPriorities = priorities;
    console.log(`Group ${groupId} priority set to:`, priorities);

    // Оновити пріоритет у всіх юнітів групи
    for (const unit of group.units) {
      unit.actionPriorities = [...priorities];
    }

    this.syncGroupsToObjectManager();
    this.updateGroupsUI();
  }

  // Встановити точку руху для групи
  setGroupMoveTarget(groupId, col, row) {
    if (this.gameManager.isBattleInProgress) {
      console.log("Cannot modify groups during battle");
      return;
    }

    const group = this.unitGroups[groupId];
    if (!group) {
      console.log(`Group ${groupId} not found`);
      return;
    }

    group.moveTarget = { col, row };
    console.log(`Group ${groupId} move target set to:`, col, row);

    // Оновити moveTarget у всіх юнітів групи
    for (const unit of group.units) {
      unit.groupMoveTarget = { col, row };
    }

    this.syncGroupsToObjectManager();
    this.updateGroupsUI();
  }

  // Очистити точку руху для групи
  clearGroupMoveTarget(groupId) {
    if (this.gameManager.isBattleInProgress) {
      console.log("Cannot modify groups during battle");
      return;
    }

    const group = this.unitGroups[groupId];
    if (!group) {
      console.log(`Group ${groupId} not found`);
      return;
    }

    group.moveTarget = null;
    console.log(`Group ${groupId} move target cleared`);

    // Очистити moveTarget у всіх юнітів групи
    for (const unit of group.units) {
      unit.groupMoveTarget = null;
    }

    this.syncGroupsToObjectManager();
    this.updateGroupsUI();
  }

  // Зберегти групу
  saveGroup(groupId) {
    // Заборонити зміну груп під час бою
    if (this.gameManager.isBattleInProgress) {
      console.log("Cannot modify groups during battle");
      return;
    }

    if (this.selectedUnits.length === 0) {
      console.log("No units selected to save in group");
      return;
    }

    // Видаляємо юнітів з інших груп, якщо вони там є
    for (const unit of this.selectedUnits) {
      // Якщо юніт вже в іншій групі - видаляємо його звідти
      if (
        unit.groupId &&
        unit.groupId !== groupId &&
        this.unitGroups[unit.groupId]
      ) {
        const oldGroup = this.unitGroups[unit.groupId];
        oldGroup.units = oldGroup.units.filter((u) => u !== unit);

        // Якщо стара група стала пустою - видаляємо її
        if (oldGroup.units.length === 0) {
          delete this.unitGroups[unit.groupId];
        }
      }

      // Призначаємо новий groupId
      unit.groupId = groupId;
    }

    this.unitGroups[groupId] = {
      units: [...this.selectedUnits],
      moveTarget: null,
      actionPriorities: ["move", "attack"], // Дефолтний пріоритет для груп - спочатку рух
    };

    // Оновлюємо групи в objectManager
    this.syncGroupsToObjectManager();

    console.log(
      `Saved group ${groupId} with ${this.selectedUnits.length} units`
    );

    // Зберігаємо в БД
    this.gameManager.objectManager
      .saveObjects()
      .then(() => {
        console.log(`Group ${groupId} saved to database`);
      })
      .catch((err) => {
        console.error("Failed to save group to database:", err);
      });

    // Очищаємо вибір та встановлюємо активну групу
    this.activeGroupId = groupId;
    this.updateGroupsUI();
  }

  // Вибрати групу
  selectGroup(groupId) {
    // Заборонити вибір групи під час бою
    if (this.gameManager.isBattleInProgress) {
      console.log("Cannot select groups during battle");
      return;
    }

    const group = this.unitGroups[groupId];

    if (group && group.units.length > 0) {
      // Фільтруємо тільки живих юнітів
      group.units = group.units.filter(
        (u) => !u.isDead && this.gameManager.objectManager.objects.includes(u)
      );

      if (group.units.length > 0) {
        this.selectedUnits = [...group.units];
        this.activeGroupId = groupId;
        console.log(
          `Selected group ${groupId} with ${this.selectedUnits.length} units`
        );
      } else {
        // Група пуста - видаляємо
        delete this.unitGroups[groupId];
        this.selectedUnits = [];
        this.activeGroupId = null;
        console.log(`Group ${groupId} is empty, removed`);
      }
    } else {
      // Групи немає - очищаємо вибір
      this.selectedUnits = [];
      this.activeGroupId = groupId;
      console.log(`Group ${groupId} is empty, ready to create`);
    }

    this.updateGroupsUI();
  }

  // Очистити вибір юнітів
  clearUnitSelection() {
    this.selectedUnits = [];
    console.log("Unit selection cleared");
  }

  // Синхронізувати групи з ObjectManager
  syncGroupsToObjectManager() {
    // Конвертуємо групи в формат ObjectManager
    const omGroups = {};

    for (const groupId in this.unitGroups) {
      const group = this.unitGroups[groupId];
      if (group.units.length > 0) {
        omGroups[groupId] = {
          actionPriorities: group.actionPriorities,
          moveTarget: group.moveTarget,
        };
      }
    }

    this.gameManager.objectManager.unitGroups = omGroups;
  }

  // Відновити групи з завантажених об'єктів
  restoreGroupsFromObjects() {
    this.unitGroups = {};

    const playerObjects = this.gameManager.objectManager.objects;
    const omGroups = this.gameManager.objectManager.unitGroups;

    // Знаходимо всіх юнітів з groupId і групуємо їх
    for (const unit of playerObjects) {
      if (unit.groupId !== null && unit.groupId !== undefined) {
        // Для player юнітів groupId вже числовий
        // Пропускаємо enemy groups (починаються з 'e')
        if (typeof unit.groupId === "string" && unit.groupId.startsWith("e")) {
          continue;
        }

        const numericGroupId =
          typeof unit.groupId === "string"
            ? parseInt(unit.groupId)
            : unit.groupId;

        if (!this.unitGroups[numericGroupId]) {
          // Отримуємо конфіг групи з objectManager якщо є
          const groupConfig = omGroups[numericGroupId] || {};

          this.unitGroups[numericGroupId] = {
            units: [],
            moveTarget: groupConfig.moveTarget || null,
            actionPriorities: groupConfig.actionPriorities || [
              "move",
              "attack",
            ],
          };
        }

        // Застосовуємо пріоритети та moveTarget до юніта
        const groupData = this.unitGroups[numericGroupId];
        if (groupData.actionPriorities) {
          unit.actionPriorities = [...groupData.actionPriorities];
        }
        if (groupData.moveTarget) {
          unit.groupMoveTarget = groupData.moveTarget;
        }

        this.unitGroups[numericGroupId].units.push(unit);
      }
    }

    console.log(
      "Restored groups from objects:",
      Object.keys(this.unitGroups).map((id) => ({
        id,
        units: this.unitGroups[id].units.length,
      }))
    );

    // Оновлюємо UI
    this.updateGroupsUI();
  }

  // Ініціалізувати UI для груп (обробники кліків)
  createGroupsUI() {
    const groupsPanel = document.getElementById("groups-panel");
    if (!groupsPanel) {
      console.warn("Groups panel not found in DOM");
      return;
    }

    // Додаємо обробники кліків на слоти груп
    groupsPanel.querySelectorAll(".group-slot").forEach((slot) => {
      slot.addEventListener("click", () => {
        // Заборонити клік на групу під час бою
        if (this.gameManager.isBattleInProgress) {
          console.log("Cannot interact with groups during battle");
          return;
        }
        const groupId = parseInt(slot.getAttribute("data-group-id"));
        this.selectGroup(groupId);
      });
    });
  }

  // Оновити UI груп
  updateGroupsUI() {
    const slots = document.querySelectorAll(".group-slot");

    slots.forEach((slot) => {
      const groupId = parseInt(slot.getAttribute("data-group-id"));
      const group = this.unitGroups[groupId];
      const countEl = slot.querySelector(".group-count");
      let infoEl = slot.querySelector(".group-info");

      // Створюємо елемент info якщо немає
      if (!infoEl) {
        infoEl = document.createElement("span");
        infoEl.className = "group-info";
        slot.appendChild(infoEl);
      }

      // Оновлюємо кількість юнітів
      const count = group ? group.units.filter((u) => !u.isDead).length : 0;
      countEl.textContent = count;

      // Оновлюємо інформацію про групу
      if (group && count > 0) {
        const priorityIcon =
          group.actionPriorities && group.actionPriorities[0] === "attack"
            ? "⚔"
            : "→";
        const targetIcon = group.moveTarget ? "🎯" : "";
        infoEl.textContent = `${priorityIcon}${targetIcon}`;
        infoEl.title = this.getGroupTooltip(group);
      } else {
        infoEl.textContent = "";
        infoEl.title = "";
      }

      // Оновлюємо класи
      slot.classList.toggle("has-units", count > 0);
      slot.classList.toggle("active", this.activeGroupId === groupId);
      slot.classList.toggle(
        "setting-target",
        this.isSettingMoveTarget && this.activeGroupId === groupId
      );
    });
  }

  // Отримати tooltip для групи
  getGroupTooltip(group) {
    if (!group) return "";

    const parts = [];
    const priority =
      group.actionPriorities && group.actionPriorities[0] === "attack"
        ? "Attack first"
        : "Move first";
    parts.push(`Priority: ${priority}`);

    if (group.moveTarget) {
      parts.push(`Target: (${group.moveTarget.col}, ${group.moveTarget.row})`);
    }

    parts.push("");
    parts.push("Hotkeys: A=Attack, R=Run, M=MoveTarget");

    return parts.join("\n");
  }

  // Малювання виділення та selection box
  drawGroupSelectionIndicators(ctx) {
    // Малюємо selection box якщо активний
    if (this.isSelecting && this.selectionStart && this.selectionEnd) {
      ctx.save();
      ctx.strokeStyle = "rgba(0, 255, 0, 0.8)";
      ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      const x = Math.min(this.selectionStart.x, this.selectionEnd.x);
      const y = Math.min(this.selectionStart.y, this.selectionEnd.y);
      const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
      const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);

      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
      ctx.restore();
    }

    // Малюємо підсвічування вибраних юнітів (овальне під спрайтом)
    for (const unit of this.selectedUnits) {
      if (unit.isDead) continue;

      ctx.save();

      const cellWidth = this.gameManager.gridManager.cellWidth;
      const cellHeight = this.gameManager.gridManager.cellHeight;

      // Отримуємо розміри спрайту для масштабування овалу
      let spriteWidth = unit.gridWidth * cellWidth;
      let spriteHeight = unit.gridHeight * cellHeight;

      // Якщо є анімований спрайт, використовуємо його розмір
      if (unit.animator && unit.animator.currentSprite) {
        const sprite = unit.animator.currentSprite;
        if (sprite.frameWidth && sprite.frameHeight) {
          spriteWidth = sprite.frameWidth * (unit.scaleX || 1);
          spriteHeight = sprite.frameHeight * (unit.scaleY || 1);
        }
      }

      // Розміри овалу базуються на розмірі спрайту
      const radiusX = spriteWidth * 0.45;
      const radiusY = spriteWidth * 0.15; // Сплющений овал пропорційний ширині

      // Позиція овалу - нижній край на centralPoint спрайту
      const ellipseX = unit.x;
      const ellipseY = unit.y - radiusY;

      // Малюємо заповнений овал
      ctx.fillStyle = "rgba(255, 204, 0, 0.3)";
      ctx.beginPath();
      ctx.ellipse(ellipseX, ellipseY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.fill();

      // Малюємо контур овалу
      ctx.strokeStyle = "#ffcc00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ellipseX, ellipseY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // Малюємо маркери moveTarget для активної групи
    this.drawMoveTargetMarker(ctx);
  }

  // Малювання маркера точки руху групи
  drawMoveTargetMarker(ctx) {
    if (!this.activeGroupId) return;

    const group = this.unitGroups[this.activeGroupId];
    if (!group || !group.moveTarget) return;

    const gm = this.gameManager.gridManager;
    const pixelPos = gm.getPixelFromGridCell(
      group.moveTarget.col,
      group.moveTarget.row
    );

    ctx.save();

    // Малюємо хрестик-маркер
    const size = 15;
    const x = pixelPos.x;
    const y = pixelPos.y;

    // Зовнішній круг
    ctx.fillStyle = "rgba(39, 174, 96, 0.3)";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Контур
    ctx.strokeStyle = "#27ae60";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();

    // Хрестик
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.5, y);
    ctx.lineTo(x + size * 0.5, y);
    ctx.moveTo(x, y - size * 0.5);
    ctx.lineTo(x, y + size * 0.5);
    ctx.stroke();

    ctx.restore();
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

      // Спочатку перевіряємо war_machines (вони спільні для всіх рас)
      if (racesConfig.war_machines && racesConfig.war_machines[unitKey]) {
        return {
          unitConfig: racesConfig.war_machines[unitKey],
          unitTier: "war_machines",
        };
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

          // Check zone restriction first
          const canPlaceInZone = this.gameManager.canPlaceUnitAt(
            col,
            row,
            unitConfig
          );

          // Check if placement is valid (both zone and collision)
          const canPlace =
            canPlaceInZone &&
            this.gameManager.gridManager.canPlaceAt(tempObject, col, row);

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
      console.log(
        "Cannot place units during active battle. Wait for next round."
      );
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

      // Check if player can purchase this unit
      if (!this.gameManager.player.canPurchaseUnit(unitConfig)) {
        const reason =
          this.gameManager.player.getPurchaseBlockReason(unitConfig);
        console.warn(`Cannot place unit: ${reason}`);
        // TODO: Show error message in UI
        alert(reason); // Temporary UI feedback
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

      // Check if player can place in this zone (left/right half restriction)
      const canPlaceInZone = this.gameManager.canPlaceUnitAt(
        gridCoords.col,
        gridCoords.row,
        unitConfig
      );
      if (!canPlaceInZone) {
        const zoneInfo = this.gameManager.getPlacementZoneInfo();
        console.log(
          `Cannot place unit here. You can only place units on the ${zoneInfo.side} side of the map.`
        );
        return; // Exit without creating unit
      }

      // Використовуємо існуючий метод canPlaceAt для перевірки
      const canPlace = this.gameManager.gridManager.canPlaceAt(
        tempObject,
        gridCoords.col,
        gridCoords.row
      );

      if (!canPlace) {
        return; // Виходимо з функції, не створюючи юніта
      }

      // Purchase unit (deduct money and increment unit count)
      const purchased = await this.gameManager.player.purchaseUnit(unitConfig);
      if (!purchased) {
        console.error("Failed to purchase unit");
        return;
      }

      // Create the unit
      const newUnit = await this.gameManager.objectManager.createObject(
        this.selectedUnitKey,
        { ...unitConfig }, // Create a copy to avoid modifying the original
        this.gameManager.isRoomCreator ? 1 : 2, // команда гравця
        gridCoords.col,
        gridCoords.row
      );

      if (newUnit) {
        console.log(
          `Unit created successfully! Remaining resources: Money=${this.gameManager.player.money}, Units=${this.gameManager.player.unitLimit}/${this.gameManager.player.maxUnitLimit}`
        );
      }

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
      this.readyButton.addEventListener("click", () => {
        this.handleReadyClick();
      });
    } else {
      console.warn("Ready button not found in DOM");
    }
  }

  // Handle ready button click
  async handleReadyClick() {
    if (!this.gameManager || !this.gameManager.objectManager.currentRoomId) {
      console.error("Cannot set ready: no room ID available");
      return;
    }

    // Disable button to prevent multiple clicks
    if (this.readyButton) {
      this.readyButton.disabled = true;
      this.readyButton.textContent = "Готовий...";
    }

    try {
      // Call gameManager's setPlayerReady method
      await this.gameManager.setPlayerReady();

      // Update button state
      if (this.readyButton) {
        this.readyButton.textContent = "Готовий ✓";
        this.readyButton.style.backgroundColor = "#4CAF50";
      }

      console.log("Player marked as ready via button");
    } catch (error) {
      console.error("Error setting player ready:", error);

      // Re-enable button on error
      if (this.readyButton) {
        this.readyButton.disabled = false;
        this.readyButton.textContent = "Готовий";
        this.readyButton.style.backgroundColor = "";
      }
    }
  }
}
