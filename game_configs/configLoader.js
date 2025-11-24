export class ConfigLoader {
  constructor() {
    this.configs = {};
    this.racesConfig = null;
  }

  async load(configList) {
    // Get the base URL for GitHub Pages
    const baseUrl = window.location.hostname.includes("github.io")
      ? "https://madestavich.github.io/stratega"
      : "";

    for (const [key, path] of Object.entries(configList)) {
      try {
        // Create absolute URL
        const absolutePath = `${baseUrl}${path}`;

        const res = await fetch(absolutePath);
        if (!res.ok) {
          throw new Error(
            `Failed to load config ${key}: ${res.status} ${res.statusText}`
          );
        }

        const config = await res.json();
        const defaultId = Object.keys(config)[0];

        // Fix sprite path - this is critical
        let spritePath = config[defaultId].sourceImage.link;

        // If it's a relative path, make it absolute
        if (!spritePath.startsWith("http")) {
          // Check if path already contains full path (e.g., /sprites/effects/healing.png)
          if (spritePath.startsWith("/sprites/")) {
            spritePath = `${baseUrl}${spritePath}`;
          } else {
            // Legacy format - just filename
            spritePath = `${baseUrl}/sprites/${spritePath.split("/").pop()}`;
          }
        }

        const img = new Image();
        img.src = spritePath;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => {
            console.error(`Failed to load sprite: ${spritePath}`);
            reject(new Error(`Failed to load sprite: ${spritePath}`));
          };
        });

        config[defaultId].sourceImage.link = img;
        this.configs[key] = config;
      } catch (error) {
        console.error(`Error loading config ${key}:`, error);
      }
    }
  }

  async loadRacesConfig() {
    try {
      // Get the base URL for GitHub Pages
      const baseUrl = window.location.hostname.includes("github.io")
        ? "https://madestavich.github.io/stratega"
        : "";

      const racesConfigPath = `${baseUrl}/game_configs/races.json`;

      const response = await fetch(racesConfigPath);
      if (!response.ok) {
        throw new Error(
          `Failed to load races config: ${response.status} ${response.statusText}`
        );
      }

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
