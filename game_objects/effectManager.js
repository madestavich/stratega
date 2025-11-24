import { Effect } from "../import.js";

export class EffectManager {
  constructor(ctx, configLoader, spriteLoader) {
    this.ctx = ctx;
    this.effects = [];
    this.configLoader = configLoader;
    this.spriteLoader = spriteLoader;
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
   * Створює ефект з конфігу (завантажуючи спрайт якщо потрібно)
   * @param {string} effectType - Тип ефекту (назва файлу конфігу)
   * @param {Object} effectConfig - Конфігурація ефекту
   * @returns {Promise<Effect>} Створений ефект
   */
  async createEffectFromConfig(effectType, effectConfig) {
    // Перевіряємо чи спрайт вже завантажений
    if (!this.configLoader.getConfig(effectType)) {
      // Якщо ні, завантажуємо його
      await this.spriteLoader.loadSprites(effectType);
    }

    // Отримуємо конфігурацію спрайту
    const spriteConfig = this.configLoader.getConfig(effectType);

    if (!spriteConfig) {
      console.error(`Effect config for "${effectType}" not found`);
      return null;
    }

    return this.createEffect(spriteConfig, effectConfig);
  }

  /**
   * Створює ефект на юніті
   * @param {GameObject} targetUnit - Юніт для прив'язки
   * @param {Object|string} spriteConfigOrType - Конфігурація спрайту або назва типу ефекту
   * @param {Object} options - Додаткові опції
   * @returns {Effect|Promise<Effect>} Створений ефект
   */
  createEffectOnUnit(targetUnit, spriteConfigOrType, options = {}) {
    const effectConfig = {
      targetUnit: targetUnit,
      attachmentPoint: options.attachmentPoint || "center",
      zMode: options.zMode || "over",
      zOffset: options.zOffset || 0,
      offsetX: options.offsetX || 0,
      offsetY: options.offsetY || 0,
      loop: options.loop || false,
      autoRemove: options.autoRemove !== undefined ? options.autoRemove : true,
      duration: options.duration || null,
      animationName: options.animationName || null,
    };

    // Якщо передано рядок - завантажуємо з конфігу
    if (typeof spriteConfigOrType === "string") {
      return this.createEffectFromConfig(spriteConfigOrType, effectConfig);
    }

    // Інакше використовуємо як готовий конфіг
    return this.createEffect(spriteConfigOrType, effectConfig);
  }

  /**
   * Створює ефект на абсолютній позиції
   * @param {number} x - X координата
   * @param {number} y - Y координата
   * @param {Object|string} spriteConfigOrType - Конфігурація спрайту або назва типу ефекту
   * @param {Object} options - Додаткові опції
   * @returns {Effect|Promise<Effect>} Створений ефект
   */
  createEffectAtPosition(x, y, spriteConfigOrType, options = {}) {
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

    // Якщо передано рядок - завантажуємо з конфігу
    if (typeof spriteConfigOrType === "string") {
      return this.createEffectFromConfig(spriteConfigOrType, effectConfig);
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
