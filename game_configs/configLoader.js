export class ConfigLoader {
  constructor() {
    this.configs = {};
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

  getConfig(key) {
    return this.configs[key];
  }
}
