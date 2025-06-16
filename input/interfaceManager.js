export class InterfaceManager {
  constructor(spriteLoader, configLoader) {
    this.spriteLoader = spriteLoader;
    this.configLoader = configLoader;
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
   * Create a unit element with icon and name
   * @param {Object} unit - Unit data with name and key
   * @returns {HTMLElement} - The created unit element
   */
  createUnitElement(unit) {
    const unitIcon = document.createElement("div");
    unitIcon.className = "unit-icon";
    unitIcon.dataset.unitKey = unit.key;

    // Create image element
    const img = document.createElement("img");
    img.alt = unit.name;

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
        // If no icon animation, try to use the first frame of the idle animation
        if (spritesheet.animations.idle) {
          const idleFrame = spritesheet.animations.idle.frames[0];

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          canvas.width = idleFrame.width;
          canvas.height = idleFrame.height;

          ctx.drawImage(
            spritesheet.sourceImage.link,
            idleFrame.x,
            idleFrame.y,
            idleFrame.width,
            idleFrame.height,
            0,
            0,
            idleFrame.width,
            idleFrame.height
          );

          img.src = canvas.toDataURL();
        } else {
          // Fallback to placeholder
          img.src = "placeholder.png";
        }
      }
    } else {
      // Fallback to placeholder if no sprite config found
      img.src = "placeholder.png";
      console.warn(`Sprite config not found for unit: ${unit.key}`);
    }

    // Create name element
    const nameDiv = document.createElement("div");
    nameDiv.className = "unit-name";
    nameDiv.textContent = unit.name;

    // Append elements
    unitIcon.appendChild(img);
    unitIcon.appendChild(nameDiv);

    return unitIcon;
  }

  /**
   * Update the interface when player changes
   * @param {Player} player - The new player
   */
  async updatePlayerInterface(player) {
    await this.populateUnitTabs(player);
  }
}
