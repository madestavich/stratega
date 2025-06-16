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
  populateUnitTabs(player) {
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

    // Use placeholder image for now
    // In a real implementation, you would need to get the correct sprite
    // based on how your spriteLoader works
    img.src = "placeholder.png";
    img.alt = unit.name;

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
  updatePlayerInterface(player) {
    this.populateUnitTabs(player);
  }
}
