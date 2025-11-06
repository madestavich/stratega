export class InterfaceManager {
  constructor(spriteLoader, configLoader) {
    this.spriteLoader = spriteLoader;
    this.configLoader = configLoader;
    this.selectedUnitKey = null; // Додаємо змінну для збереження вибраного юніта
    this.unitContainers = {
      level1: document.getElementById("level1-units"),
      level2: document.getElementById("level2-units"),
      level3: document.getElementById("level3-units"),
      level4: document.getElementById("level4-units"),
    };

    // Map tier names from JSON to UI container IDs
    this.tierMapping = {
      tier_one: "level1",
      tier_two: "level2",
      tier_three: "level3",
      tier_four: "level4",
    };

    this.initTabSwitching();
    this.initUnitInfoDisplay();
  }

  /**
   * Populate unit tabs based on player's race
   * @param {Player} player - The player object containing race information
   */
  async populateUnitTabs(player) {
    if (!player || !player.race) {
      console.error(`Invalid player race: ${player?.race}`);
      return;
    }

    // Якщо раса "all", завантажуємо всі доступні юніти
    if (player.race === "all") {
      // Clear existing units
      Object.values(this.unitContainers).forEach((container) => {
        if (container) container.innerHTML = "";
      });

      // Завантажуємо всі спрайти
      await this.spriteLoader.loadRaceSprites("all");

      // Завантажуємо конфігурацію всіх рас для правильного розподілу
      const response = await fetch("/game_configs/races.json");
      const racesConfig = await response.json();

      // Збираємо всі юніти з їх тірами
      const unitsByTier = {
        tier_one: [],
        tier_two: [],
        tier_three: [],
        tier_four: [],
      };

      // Проходимо по всім расам і збираємо юніти по тірам
      Object.values(racesConfig).forEach((race) => {
        if (race.units) {
          Object.entries(race.units).forEach(([tier, units]) => {
            if (unitsByTier[tier]) {
              Object.keys(units).forEach((unitKey) => {
                if (!unitsByTier[tier].includes(unitKey)) {
                  unitsByTier[tier].push(unitKey);
                }
              });
            }
          });
        }
      });

      // Розподіляємо юніти по правильних тірах
      Object.entries(unitsByTier).forEach(([tier, unitKeys]) => {
        const containerKey = this.tierMapping[tier];
        const container = this.unitContainers[containerKey];

        if (container) {
          unitKeys.forEach((unitKey) => {
            const unitElement = this.createUnitElement({
              name: this.formatUnitName(unitKey),
              key: unitKey,
            });
            container.appendChild(unitElement);
          });
        }
      });

      return;
    }

    const racesConfig = this.configLoader.racesConfig;
    if (!racesConfig || !racesConfig[player.race]) {
      console.error(`Race configuration not found for: ${player.race}`);
      return;
    }

    const raceUnits = racesConfig[player.race].units;

    // Clear existing units
    Object.values(this.unitContainers).forEach((container) => {
      if (container) container.innerHTML = "";
    });

    // Load all unit sprites first
    const allUnitKeys = [];
    Object.values(raceUnits).forEach((tier) => {
      allUnitKeys.push(...Object.keys(tier));
    });

    // Load all sprites for this race's units
    await this.spriteLoader.loadSprites(allUnitKeys);

    // Populate each tier with appropriate units
    Object.entries(raceUnits).forEach(([tier, units]) => {
      const containerKey = this.tierMapping[tier];
      const container = this.unitContainers[containerKey];

      if (!container) return;

      // Add each unit in this tier to the container
      Object.entries(units).forEach(([unitKey, unitData]) => {
        const unitElement = this.createUnitElement({
          name: this.formatUnitName(unitKey),
          key: unitKey,
        });
        container.appendChild(unitElement);
      });
    });
  }

  /**
   * Format unit key to a readable name
   * @param {string} unitKey - The unit key from JSON
   * @returns {string} Formatted unit name
   */
  formatUnitName(unitKey) {
    return unitKey
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Create a unit element with icon only
   * @param {Object} unit - Unit data with name and key
   * @returns {HTMLElement} - The created unit element
   */
  createUnitElement(unit) {
    const unitIcon = document.createElement("div");
    unitIcon.className = "unit-icon";
    unitIcon.dataset.unitKey = unit.key;
    unitIcon.title = unit.name; // Add name as tooltip

    // Create image element
    const img = document.createElement("img");
    img.alt = unit.name;
    img.style.width = "100%"; // Make image fill the container
    img.style.height = "100%"; // Make image fill the container
    img.style.objectFit = "contain"; // Maintain aspect ratio while filling

    // Try to get the unit's sprite configuration
    const spriteConfig = this.configLoader.getConfig(unit.key);

    if (spriteConfig) {
      // Get the first spritesheet (usually there's only one)
      const spritesheetId = Object.keys(spriteConfig)[0];
      const spritesheet = spriteConfig[spritesheetId];

      // Check if the unit has an "icon" animation
      if (spritesheet.animations.icon) {
        // Use the first frame of the icon animation
        const iconFrame = spritesheet.animations.icon.frames[0];

        // Create a canvas to extract just this frame from the spritesheet
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Set canvas size to match the frame
        canvas.width = iconFrame.width;
        canvas.height = iconFrame.height;

        // Draw just this frame from the spritesheet
        ctx.drawImage(
          spritesheet.sourceImage.link,
          iconFrame.x,
          iconFrame.y,
          iconFrame.width,
          iconFrame.height,
          0,
          0,
          iconFrame.width,
          iconFrame.height
        );

        // Use the canvas as the image source
        img.src = canvas.toDataURL();
      } else {
        // Fallback to placeholder if no icon animation
        img.src = "placeholder.png";
      }
    } else {
      // Fallback to placeholder if no sprite config found
      img.src = "placeholder.png";
      console.warn(`Sprite config not found for unit: ${unit.key}`);
    }

    // Append only the image element
    unitIcon.appendChild(img);

    return unitIcon;
  }

  /**
   * Update the interface when player changes
   * @param {Player} player - The new player
   */
  async updatePlayerInterface(player) {
    await this.populateUnitTabs(player);
    this.updatePlayerResources(player);
  }

  /**
   * Update player resources display (money and unit limit)
   * @param {Player} player - The player object
   */
  updatePlayerResources(player) {
    // Update gold amount
    const goldElement = document.getElementById("gold-amount");
    if (goldElement) {
      goldElement.textContent = player.money || 0;
    }

    // Update unit limit
    const unitLimitElement = document.getElementById("unit-limit");
    if (unitLimitElement) {
      const current = player.unitLimit || 0;
      const max = player.maxUnitLimit || 0;
      unitLimitElement.textContent = `${current}/${max}`;

      // Add warning styling if near limit
      if (max > 0 && current >= max) {
        unitLimitElement.style.color = "#ff4444";
      } else if (max > 0 && current >= max * 0.8) {
        unitLimitElement.style.color = "#ffaa00";
      } else {
        unitLimitElement.style.color = "";
      }
    }
  }

  // Add this method to the existing InterfaceManager class
  initTabSwitching() {
    // Left menu tabs
    const leftTabs = document.querySelectorAll("#unitMenu .category-tab");
    leftTabs.forEach((tab) => {
      tab.addEventListener("click", function () {
        // Remove active class from all tabs and content in left menu
        document
          .querySelectorAll("#unitMenu .category-tab")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelectorAll("#unitMenu .category-content")
          .forEach((c) => c.classList.remove("active"));

        // Add active class to clicked tab
        this.classList.add("active");

        // Show corresponding content
        const category = this.getAttribute("data-category");
        document.getElementById(`${category}-units`).classList.add("active");
      });
    });

    // Right menu tabs
    const rightTabs = document.querySelectorAll("#rightMenu .category-tab");
    rightTabs.forEach((tab) => {
      tab.addEventListener("click", function () {
        // Remove active class from all tabs and content in right menu
        document
          .querySelectorAll("#rightMenu .category-tab")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelectorAll("#rightMenu .category-content")
          .forEach((c) => c.classList.remove("active"));

        // Add active class to clicked tab
        this.classList.add("active");

        // Show corresponding content
        const category = this.getAttribute("data-category");
        document.getElementById(`${category}-panel`).classList.add("active");
      });
    });
  }

  /**
   * Initialize unit info display functionality
   */
  initUnitInfoDisplay() {
    // Add event listeners to unit containers for hover/click events
    Object.values(this.unitContainers).forEach((container) => {
      if (container) {
        container.addEventListener("mouseover", (e) => {
          const unitIcon = e.target.closest(".unit-icon");
          if (unitIcon) {
            this.showUnitInfo(unitIcon.dataset.unitKey);
          }
        });

        container.addEventListener("mouseout", (e) => {
          const unitIcon = e.target.closest(".unit-icon");
          if (unitIcon) {
            // При виведенні миші відновлюємо параметри вибраного юніта або очищаємо
            if (this.selectedUnitKey) {
              this.showUnitInfo(this.selectedUnitKey);
            } else {
              this.clearUnitInfo();
            }
          }
        });

        container.addEventListener("click", (e) => {
          const unitIcon = e.target.closest(".unit-icon");
          if (unitIcon) {
            const unitKey = unitIcon.dataset.unitKey;
            // Якщо клікнули на вже вибраного юніта - скасовуємо вибір
            if (this.selectedUnitKey === unitKey) {
              this.deselectUnit();
            } else {
              // Інакше вибираємо новий юніт
              this.selectUnit(unitKey);
            }
          } else {
            // Клік в порожнє місце - скасовуємо вибір
            this.deselectUnit();
          }
        });
      }
    });

    // Додаємо можливість скасування вибору при кліку поза меню юнітів
    document.addEventListener("click", (e) => {
      // Перевіряємо чи клік був поза меню юнітів
      const isInsideUnitMenu = e.target.closest("#unitMenu");
      if (!isInsideUnitMenu && this.selectedUnitKey) {
        this.deselectUnit();
      }
    });
  }

  /**
   * Show unit information in the footer
   * @param {string} unitKey - The unit key to display info for
   */
  showUnitInfo(unitKey) {
    if (!unitKey) return;

    // Get unit configuration from races config
    const unitConfig = this.getUnitConfig(unitKey);
    if (!unitConfig) {
      console.warn(`Unit config not found for: ${unitKey}`);
      return;
    }

    // Update unit info display
    this.updateUnitInfoDisplay(unitConfig);
  }

  /**
   * Get unit configuration from races config
   * @param {string} unitKey - The unit key
   * @returns {Object|null} Unit configuration object
   */
  getUnitConfig(unitKey) {
    const racesConfig = this.configLoader.racesConfig;
    if (!racesConfig) return null;

    // Search through all races and tiers to find the unit
    for (const [raceName, raceData] of Object.entries(racesConfig)) {
      if (raceData.units) {
        for (const [tierName, tierUnits] of Object.entries(raceData.units)) {
          if (tierUnits[unitKey]) {
            return tierUnits[unitKey];
          }
        }
      }
    }

    return null;
  }

  /**
   * Update the unit info display with unit stats
   * @param {Object} unitConfig - Unit configuration object
   */
  updateUnitInfoDisplay(unitConfig) {
    // Get all stat elements
    const costElement = document.getElementById("unit-cost");
    const attackElement = document.getElementById("unit-attack");
    const rangedAttackElement = document.getElementById("unit-ranged-attack");
    const rangedAttackStat = document.getElementById("ranged-attack-stat");
    const attackSpeedElement = document.getElementById("unit-attack-speed");
    const hpElement = document.getElementById("unit-hp");
    const moveSpeedElement = document.getElementById("unit-move-speed");

    if (
      !costElement ||
      !attackElement ||
      !attackSpeedElement ||
      !hpElement ||
      !moveSpeedElement
    ) {
      console.warn("Unit info elements not found in DOM");
      return;
    }

    // Update basic stats
    costElement.textContent = unitConfig.cost || "-";
    attackElement.textContent = unitConfig.attackDamage || "-";
    attackSpeedElement.textContent = unitConfig.attackSpeed || "-";
    hpElement.textContent = unitConfig.health || "-";
    moveSpeedElement.textContent = unitConfig.moveSpeed || "-";

    // Handle ranged attack display
    if (unitConfig.isRanged && unitConfig.bulletConfig) {
      rangedAttackElement.textContent =
        unitConfig.bulletConfig.bulletDamage || "-";
      rangedAttackStat.style.display = "block";
    } else {
      rangedAttackStat.style.display = "none";
    }
  }

  /**
   * Clear unit information display
   */
  clearUnitInfo() {
    // Не очищаємо якщо є вибраний юніт
    if (this.selectedUnitKey) {
      return;
    }

    const costElement = document.getElementById("unit-cost");
    const attackElement = document.getElementById("unit-attack");
    const rangedAttackElement = document.getElementById("unit-ranged-attack");
    const rangedAttackStat = document.getElementById("ranged-attack-stat");
    const attackSpeedElement = document.getElementById("unit-attack-speed");
    const hpElement = document.getElementById("unit-hp");
    const moveSpeedElement = document.getElementById("unit-move-speed");

    if (costElement) costElement.textContent = "-";
    if (attackElement) attackElement.textContent = "-";
    if (rangedAttackElement) rangedAttackElement.textContent = "-";
    if (rangedAttackStat) rangedAttackStat.style.display = "none";
    if (attackSpeedElement) attackSpeedElement.textContent = "-";
    if (hpElement) hpElement.textContent = "-";
    if (moveSpeedElement) moveSpeedElement.textContent = "-";
  }

  /**
   * Select a unit (for persistent display or other actions)
   * @param {string} unitKey - The unit key to select
   */
  selectUnit(unitKey) {
    // Зберігаємо вибраний юніт
    this.selectedUnitKey = unitKey;

    // Remove previous selection highlighting
    document.querySelectorAll(".unit-icon.selected").forEach((icon) => {
      icon.classList.remove("selected");
    });

    // Add selection highlighting to clicked unit
    const unitIcon = document.querySelector(`[data-unit-key="${unitKey}"]`);
    if (unitIcon) {
      unitIcon.classList.add("selected");
    }

    // Show unit info persistently
    this.showUnitInfo(unitKey);
  }

  /**
   * Deselect current unit (clear selection)
   */
  deselectUnit() {
    this.selectedUnitKey = null;

    // Remove selection highlighting
    document.querySelectorAll(".unit-icon.selected").forEach((icon) => {
      icon.classList.remove("selected");
    });

    // Очищаємо параметри тільки після скасування вибору
    this.forceClearUnitInfo();
  }

  /**
   * Force clear unit information display (ignoring selection)
   */
  forceClearUnitInfo() {
    const costElement = document.getElementById("unit-cost");
    const attackElement = document.getElementById("unit-attack");
    const rangedAttackElement = document.getElementById("unit-ranged-attack");
    const rangedAttackStat = document.getElementById("ranged-attack-stat");
    const attackSpeedElement = document.getElementById("unit-attack-speed");
    const hpElement = document.getElementById("unit-hp");
    const moveSpeedElement = document.getElementById("unit-move-speed");

    if (costElement) costElement.textContent = "-";
    if (attackElement) attackElement.textContent = "-";
    if (rangedAttackElement) rangedAttackElement.textContent = "-";
    if (rangedAttackStat) rangedAttackStat.style.display = "none";
    if (attackSpeedElement) attackSpeedElement.textContent = "-";
    if (hpElement) hpElement.textContent = "-";
    if (moveSpeedElement) moveSpeedElement.textContent = "-";
  }
}
