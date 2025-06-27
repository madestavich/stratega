export class ConfigLoader {
  constructor() {
    this.configs = {};
    this.racesConfig = null;
  }

  async load(configList) {
    const repoName = "stratega"; // Your repository name
    const isGitHubPages = window.location.hostname.includes("github.io");

    for (const [key, path] of Object.entries(configList)) {
      try {
        // Adjust path for GitHub Pages if needed
        let adjustedPath = path;
        if (isGitHubPages && !path.startsWith(`/${repoName}`)) {
          adjustedPath = `/${repoName}${path}`;
        }

        console.log(`Loading config ${key} from:`, adjustedPath);
        const res = await fetch(adjustedPath);

        if (!res.ok) {
          throw new Error(
            `Failed to load config ${key}: ${res.status} ${res.statusText}`
          );
        }

        const config = await res.json();

        const defaultId = Object.keys(config)[0];
        const img = new Image();
        img.src = config[defaultId].sourceImage.link;

        // Also adjust image path if needed
        if (
          isGitHubPages &&
          !img.src.includes(`/${repoName}/`) &&
          !img.src.startsWith("http")
        ) {
          img.src = `/${repoName}${img.src}`;
        }

        await new Promise((resolve) => (img.onload = resolve));
        config[defaultId].sourceImage.link = img;

        this.configs[key] = config;
      } catch (error) {
        console.error(`Error loading config ${key}:`, error);
      }
    }
  }

  async loadRacesConfig() {
    try {
      // Create the correct URL based on the repository name
      const repoName = "stratega"; // Your repository name
      const isGitHubPages = window.location.hostname.includes("github.io");

      let racesConfigPath;
      if (isGitHubPages) {
        racesConfigPath = `/${repoName}/game_configs/races.json`;
      } else {
        racesConfigPath = "/game_configs/races.json";
      }

      console.log("Attempting to load races config from:", racesConfigPath);
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
