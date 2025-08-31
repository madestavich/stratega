export class SpriteLoader {
  constructor(configLoader) {
    this.configLoader = configLoader;
    this.loadedSprites = new Set();
    this.spriteConfigMap = {
      //! necropolis
      skeleton: "/game_configs/units/skeleton.json",
      black_knight: "/game_configs/units/black_knight.json",
      bone_dragon: "/game_configs/units/bone_dragon.json",
      lich: "/game_configs/units/lich.json",
      vampire: "/game_configs/units/vampire.json",
      walking_dead: "/game_configs/units/walking_dead.json",
      wight: "/game_configs/units/wight.json",
      //! castle
      pikeman: "/game_configs/units/pikeman.json",
      archer: "/game_configs/units/archer.json",
      swordsman: "/game_configs/units/swordsman.json",
      zealot: "/game_configs/units/zealot.json",
      angel: "/game_configs/units/angel.json",
      cavalier: "/game_configs/units/cavalier.json",
      griffin: "/game_configs/units/griffin.json",
      //! rampart
      centaur: "/game_configs/units/centaur.json",
      dwarf: "/game_configs/units/dwarf.json",
      pegasus: "/game_configs/units/pegasus.json",
      wood_elf: "/game_configs/units/wood_elf.json",
      green_dragon: "/game_configs/units/green_dragon.json",
      unicorn: "/game_configs/units/unicorn.json",
      dendroid_guard: "/game_configs/units/dendroid_guard.json",
      //! neutral
      rider: "/game_configs/units/rider.json",
      //! conflux
      psychic_elemental: "/game_configs/units/psychic_elemental.json",
      fire_elemental: "/game_configs/units/fire_elemental.json",
      pixie: "/game_configs/units/pixie.json",
      air_elemental: "/game_configs/units/air_elemental.json",
      earth_elemental: "/game_configs/units/earth_elemental.json",
      firebird: "/game_configs/units/firebird.json",
      water_elemental: "/game_configs/units/water_elemental.json",
    };
  }

  /**
   * Завантажує необхідні спрайти для гри
   * @param {Array|String} spriteKeys - Ключі спрайтів для завантаження
   * @returns {Promise} - Promise, який резолвиться після завантаження всіх спрайтів
   */
  async loadSprites(spriteKeys) {
    if (!spriteKeys) return;

    // Якщо передано один ключ як рядок, перетворюємо його на масив
    if (typeof spriteKeys === "string") {
      spriteKeys = [spriteKeys];
    }

    // Фільтруємо тільки ті спрайти, які ще не завантажені
    const spritesToLoad = spriteKeys.filter(
      (key) => !this.loadedSprites.has(key)
    );

    if (spritesToLoad.length === 0) return;

    // Створюємо об'єкт конфігурації для завантаження
    const configList = {};
    spritesToLoad.forEach((key) => {
      if (this.spriteConfigMap[key]) {
        configList[key] = this.spriteConfigMap[key];
      } else {
        console.warn(`Sprite config for "${key}" not found in spriteConfigMap`);
      }
    });

    // Завантажуємо спрайти через configLoader
    await this.configLoader.load(configList);

    // Додаємо завантажені спрайти до списку
    spritesToLoad.forEach((key) => this.loadedSprites.add(key));
  }

  /**
   * Завантажує спрайти для конкретної раси
   * @param {String} race - Назва раси
   * @returns {Promise} - Promise, який резолвиться після завантаження всіх спрайтів раси
   */
  async loadRaceSprites(race) {
    try {
      // Якщо раса "all", завантажуємо всі доступні спрайти
      if (race === "all") {
        const allSpriteKeys = Object.keys(this.spriteConfigMap);
        await this.loadSprites(allSpriteKeys);
        return;
      }

      // Завантажуємо конфігурацію рас, якщо потрібно
      const response = await fetch("/game_configs/races.json");
      const racesConfig = await response.json();

      if (!racesConfig[race]) {
        console.warn(`Race "${race}" not found in races config`);
        return;
      }

      // Збираємо всі типи юнітів для цієї раси
      const unitTypes = [];
      const tiers = ["tier_one", "tier_two", "tier_three", "tier_four"];

      tiers.forEach((tier) => {
        if (racesConfig[race].units[tier]) {
          unitTypes.push(...Object.keys(racesConfig[race].units[tier]));
        }
      });

      // Завантажуємо спрайти для всіх юнітів
      await this.loadSprites(unitTypes);
    } catch (error) {
      console.error("Error loading race sprites:", error);
    }
  }
}
