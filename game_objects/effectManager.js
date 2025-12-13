import { Effect } from "../import.js";

export class EffectManager {
  constructor(ctx, configLoader, spriteLoader) {
    this.ctx = ctx;
    this.effects = [];
    this.configLoader = configLoader;
    this.spriteLoader = spriteLoader;
    this.effectsConfig = null; // Конфіг з effects.json
  }

  /**
   * Завантажує конфігурацію ефектів з effects.json
   */
  async loadEffectsConfig() {
    try {
      const baseUrl = window.location.hostname.includes("github.io")
        ? "https://madestavich.github.io/stratega"
        : "";
      const response = await fetch(`${baseUrl}/game_configs/effects.json`);
      if (!response.ok) {
        throw new Error(`Failed to load effects config: ${response.status}`);
      }
      this.effectsConfig = await response.json();
      console.log("Effects config loaded:", this.effectsConfig);

      // Завантажуємо спрайти для всіх ефектів
      if (this.spriteLoader && this.effectsConfig) {
        const effectNames = Object.keys(this.effectsConfig);
        for (const effectName of effectNames) {
          await this.spriteLoader.loadSprites(effectName);
        }
        console.log("Effect sprites loaded:", effectNames);
      }
    } catch (error) {
      console.error("Error loading effects configuration:", error);
    }
  }

  /**
   * Створює новий ефект
   * @param {Object} spriteConfig - Конфігурація спрайту ефекту
   * @param {Object} effectConfig - Конфігурація ефекту
   * @returns {Effect} Створений ефект
   */
  createEffect(spriteConfig, effectConfig) {
    const effect = new Effect(this.ctx, spriteConfig, effectConfig);
    this.effects.push(effect);
    return effect;
  }

  /**
   * Створює ефект на юніті
   * @param {GameObject} targetUnit - Юніт для прив'язки
   * @param {string} effectName - Назва ефекту з effects.json
   * @param {Object} optionsOverride - Додаткові опції для перевизначення
   * @returns {Effect} Створений ефект
   */
  createEffectOnUnit(targetUnit, effectName, optionsOverride = {}) {
    // Отримуємо спрайт конфіг
    const spriteConfig = this.configLoader.getConfig(effectName);
    if (!spriteConfig) {
      console.error(
        `Effect sprite config for "${effectName}" not found. Make sure it's loaded via spriteLoader.`
      );
      return null;
    }

    // Отримуємо дефолтні параметри з effects.json
    const defaultParams = this.effectsConfig?.[effectName] || {};

    // Об'єднуємо дефолтні параметри з перевизначеннями
    const effectConfig = {
      targetUnit: targetUnit,
      attachmentPoint:
        optionsOverride.attachmentPoint ||
        defaultParams.attachmentPoint ||
        "center",
      zMode: optionsOverride.zMode || defaultParams.zMode || "over",
      zOffset: optionsOverride.zOffset || defaultParams.zOffset || 0,
      offsetX: optionsOverride.offsetX || defaultParams.offsetX || 0,
      offsetY:
        optionsOverride.offsetY !== undefined
          ? optionsOverride.offsetY
          : defaultParams.offsetY || 0,
      loop:
        optionsOverride.loop !== undefined
          ? optionsOverride.loop
          : defaultParams.loop || false,
      autoRemove:
        optionsOverride.autoRemove !== undefined
          ? optionsOverride.autoRemove
          : defaultParams.autoRemove !== undefined
          ? defaultParams.autoRemove
          : true,
      duration: optionsOverride.duration || defaultParams.duration || null,
      animationName:
        optionsOverride.animationName || defaultParams.animationName || null,
    };

    return this.createEffect(spriteConfig, effectConfig);
  }

  /**
   * Створює ефект на абсолютній позиції
   * @param {number} x - X координата
   * @param {number} y - Y координата
   * @param {Object|string} spriteConfigOrType - Конфігурація спрайту або назва типу ефекту
   * @param {Object} options - Додаткові опції
   * @returns {Effect} Створений ефект
   */
  createEffectAtPosition(x, y, spriteConfigOrType, options = {}) {
    console.log("[createEffectAtPosition] Called with:", spriteConfigOrType, "at", x, y);
    
    const effectConfig = {
      x: x,
      y: y,
      z: options.z || y, // За замовчуванням z = y
      zMode: options.zMode || "over",
      zOffset: options.zOffset || 0,
      loop: options.loop || false,
      autoRemove: options.autoRemove !== undefined ? options.autoRemove : true,
      duration: options.duration || null,
      animationName: options.animationName || null,
    };

    // Якщо передано рядок - отримуємо конфіг (вже завантажений через spriteLoader)
    if (typeof spriteConfigOrType === "string") {
      const spriteConfig = this.configLoader.getConfig(spriteConfigOrType);
      console.log("[createEffectAtPosition] Looking for config:", spriteConfigOrType);
      console.log("[createEffectAtPosition] Found spriteConfig:", spriteConfig);

      if (!spriteConfig) {
        console.error(
          `Effect config for "${spriteConfigOrType}" not found. Make sure it's loaded via spriteLoader.`
        );
        return null;
      }

      return this.createEffect(spriteConfig, effectConfig);
    }

    // Інакше використовуємо як готовий конфіг
    return this.createEffect(spriteConfigOrType, effectConfig);
  }

  /**
   * Оновлює всі ефекти
   * @param {number} deltaTime - Час з останнього оновлення в мс
   */
  updateAll(deltaTime) {
    // Оновлюємо всі ефекти
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];

      // Перевіряємо чи target юніт ще існує та живий
      if (effect.targetUnit && effect.targetUnit.isDead && effect.autoRemove) {
        // Якщо юніт мертвий і autoRemove = true, видаляємо ефект
        this.effects.splice(i, 1);
        continue;
      }

      effect.update(deltaTime);

      // Видаляємо закінчені ефекти
      if (effect.isFinished && effect.autoRemove) {
        this.effects.splice(i, 1);
      }
    }
  }

  /**
   * Рендерить всі ефекти (викликається з ObjectManager)
   * Ефекти рендеряться разом з юнітами в загальному сортуванні по Z
   */
  renderAll() {
    for (const effect of this.effects) {
      effect.render();
    }
  }

  /**
   * Видаляє всі ефекти
   */
  clearAll() {
    this.effects = [];
  }

  /**
   * Видаляє ефекти прив'язані до конкретного юніта
   * @param {GameObject} unit - Юніт для якого видаляємо ефекти
   */
  removeEffectsForUnit(unit) {
    this.effects = this.effects.filter((effect) => effect.targetUnit !== unit);
  }

  /**
   * Отримує всі ефекти (для сортування разом з іншими об'єктами)
   * @returns {Array<Effect>} Масив всіх ефектів
   */
  getAllEffects() {
    return this.effects;
  }
}
