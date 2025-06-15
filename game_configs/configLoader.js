export class ConfigLoader {
  constructor() {
    this.configs = {};
    this.racesConfig = null;
  }

  async load(configList) {
    for (const [key, path] of Object.entries(configList)) {
      const res = await fetch(path);
      const config = await res.json();

      const defaultId = Object.keys(config)[0];
      const img = new Image();
      img.src = config[defaultId].sourceImage.link;
      await new Promise((resolve) => (img.onload = resolve));
      config[defaultId].sourceImage.link = img;

      this.configs[key] = config;
    }
  }

  async loadRacesConfig() {
    try {
      const response = await fetch("/game_configs/races.json");
      this.racesConfig = await response.json();
      return this.racesConfig;
    } catch (error) {
      console.error("Error loading races configuration:", error);
      return null;
    }
  }

  getUnitConfig(race, tier, unitName) {
    if (!this.racesConfig) {
      console.warn("Races config not loaded. Call loadRacesConfig first.");
      return null;
    }

    try {
      return this.racesConfig[race].units[tier][unitName];
    } catch (error) {
      console.error(
        `Unit config not found: race=${race}, tier=${tier}, unit=${unitName}`
      );
      return null;
    }
  }

  getConfig(key) {
    return this.configs[key];
  }
}
