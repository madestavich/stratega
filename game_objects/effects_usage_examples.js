/**
 * ПРИКЛАДИ ВИКОРИСТАННЯ СИСТЕМИ ЕФЕКТІВ
 *
 * Цей файл містить готові приклади створення різних ефектів.
 * Скопіюйте потрібний код в свої екшени (attackAction, moveAction тощо).
 */

// ============================================
// 1. ЕФЕКТ ПОПАДАННЯ (Hit Effect)
// ============================================

function createHitEffect(objectManager, target) {
  // Приклад конфігурації ефекту попадання
  const hitEffectConfig = {
    hit_effect: {
      imagePath: "sprites/effects/hit_spark.png",
      animations: {
        hit: {
          frames: [
            {
              x: 0,
              y: 0,
              width: 64,
              height: 64,
              frameCenter: { x: 32, y: 32 },
            },
            {
              x: 64,
              y: 0,
              width: 64,
              height: 64,
              frameCenter: { x: 32, y: 32 },
            },
            {
              x: 128,
              y: 0,
              width: 64,
              height: 64,
              frameCenter: { x: 32, y: 32 },
            },
            {
              x: 192,
              y: 0,
              width: 64,
              height: 64,
              frameCenter: { x: 32, y: 32 },
            },
          ],
        },
      },
    },
  };

  objectManager.effectManager.createEffectOnUnit(target, hitEffectConfig, {
    attachmentPoint: "center",
    zMode: "over",
    autoRemove: true,
    loop: false,
  });
}

// ============================================
// 2. ЕФЕКТ ПОЧАТКУ АТАКИ (Attack Start Effect)
// ============================================

function createAttackStartEffect(objectManager, attacker) {
  const attackGlowConfig = {
    attack_glow: {
      imagePath: "sprites/effects/weapon_glow.png",
      animations: {
        glow: {
          frames: [
            {
              x: 0,
              y: 0,
              width: 96,
              height: 96,
              frameCenter: { x: 48, y: 48 },
            },
            {
              x: 96,
              y: 0,
              width: 96,
              height: 96,
              frameCenter: { x: 48, y: 48 },
            },
            {
              x: 192,
              y: 0,
              width: 96,
              height: 96,
              frameCenter: { x: 48, y: 48 },
            },
          ],
        },
      },
    },
  };

  objectManager.effectManager.createEffectOnUnit(attacker, attackGlowConfig, {
    attachmentPoint: "center",
    zMode: "over",
    offsetY: -20, // трохи вище центру
    autoRemove: true,
    loop: false,
  });
}

// ============================================
// 3. МАГІЧНЕ КОЛО ПІД ЮНІТОМ (Magic Circle)
// ============================================

function createMagicCircleEffect(objectManager, unit) {
  const magicCircleConfig = {
    magic_circle: {
      imagePath: "sprites/effects/magic_circle.png",
      animations: {
        rotate: {
          frames: [
            {
              x: 0,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
            {
              x: 128,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
            {
              x: 256,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
            {
              x: 384,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
          ],
        },
      },
    },
  };

  objectManager.effectManager.createEffectOnUnit(unit, magicCircleConfig, {
    attachmentPoint: "bottom",
    zMode: "under",
    offsetY: 10, // трохи вище низу
    autoRemove: true,
    loop: true,
    duration: 3000, // 3 секунди
  });
}

// ============================================
// 4. ЕФЕКТ ВИБУХУ (Explosion)
// ============================================

function createExplosionEffect(objectManager, x, y) {
  const explosionConfig = {
    explosion: {
      imagePath: "sprites/effects/explosion.png",
      animations: {
        explode: {
          frames: [
            {
              x: 0,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
            {
              x: 128,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
            {
              x: 256,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
            {
              x: 384,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
            {
              x: 512,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
          ],
        },
      },
    },
  };

  objectManager.effectManager.createEffectAtPosition(x, y, explosionConfig, {
    zMode: "top", // поверх всього
    autoRemove: true,
    loop: false,
  });
}

// ============================================
// 5. АУРА (Постійний loop-ефект)
// ============================================

function createAuraEffect(objectManager, unit) {
  const auraConfig = {
    aura: {
      imagePath: "sprites/effects/aura.png",
      animations: {
        pulse: {
          frames: [
            {
              x: 0,
              y: 0,
              width: 96,
              height: 96,
              frameCenter: { x: 48, y: 48 },
            },
            {
              x: 96,
              y: 0,
              width: 96,
              height: 96,
              frameCenter: { x: 48, y: 48 },
            },
            {
              x: 192,
              y: 0,
              width: 96,
              height: 96,
              frameCenter: { x: 48, y: 48 },
            },
            {
              x: 288,
              y: 0,
              width: 96,
              height: 96,
              frameCenter: { x: 48, y: 48 },
            },
          ],
        },
      },
    },
  };

  objectManager.effectManager.createEffectOnUnit(unit, auraConfig, {
    attachmentPoint: "center",
    zMode: "under",
    autoRemove: false, // НЕ видаляти автоматично
    loop: true, // постійна анімація
  });

  // Щоб видалити аури пізніше:
  // objectManager.effectManager.removeEffectsForUnit(unit);
}

// ============================================
// 6. ЕФЕКТ СМЕРТІ (Death Effect)
// ============================================

function createDeathEffect(objectManager, unit) {
  const deathEffectConfig = {
    death_smoke: {
      imagePath: "sprites/effects/death_smoke.png",
      animations: {
        dissipate: {
          frames: [
            {
              x: 0,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
            {
              x: 128,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
            {
              x: 256,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
            {
              x: 384,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
            {
              x: 512,
              y: 0,
              width: 128,
              height: 128,
              frameCenter: { x: 64, y: 64 },
            },
          ],
        },
      },
    },
  };

  objectManager.effectManager.createEffectOnUnit(unit, deathEffectConfig, {
    attachmentPoint: "bottom",
    zMode: "over",
    autoRemove: true,
    loop: false,
  });
}

// ============================================
// 7. ІНДИКАТОР ЗОНИ АТАКИ (Area Attack Indicator)
// ============================================

function createAreaAttackIndicator(objectManager, targetCell) {
  const areaIndicatorConfig = {
    area_indicator: {
      imagePath: "sprites/effects/area_circle.png",
      animations: {
        pulse: {
          frames: [
            {
              x: 0,
              y: 0,
              width: 96,
              height: 96,
              frameCenter: { x: 48, y: 48 },
            },
            {
              x: 96,
              y: 0,
              width: 96,
              height: 96,
              frameCenter: { x: 48, y: 48 },
            },
            {
              x: 192,
              y: 0,
              width: 96,
              height: 96,
              frameCenter: { x: 48, y: 48 },
            },
          ],
        },
      },
    },
  };

  // Обчислюємо координати центру клітинки
  const cellWidth = objectManager.gridManager.cellWidth;
  const cellHeight = objectManager.gridManager.cellHeight;
  const x = (targetCell.col + 0.5) * cellWidth;
  const y = (targetCell.row + 0.5) * cellHeight;

  objectManager.effectManager.createEffectAtPosition(
    x,
    y,
    areaIndicatorConfig,
    {
      z: y,
      zMode: "under",
      autoRemove: true,
      loop: true,
      duration: 1500, // 1.5 секунди
    }
  );
}

// ============================================
// 8. HEAL ЕФЕКТ (Healing Effect)
// ============================================

function createHealEffect(objectManager, unit) {
  const healEffectConfig = {
    heal_sparkles: {
      imagePath: "sprites/effects/heal.png",
      animations: {
        heal: {
          frames: [
            {
              x: 0,
              y: 0,
              width: 64,
              height: 64,
              frameCenter: { x: 32, y: 32 },
            },
            {
              x: 64,
              y: 0,
              width: 64,
              height: 64,
              frameCenter: { x: 32, y: 32 },
            },
            {
              x: 128,
              y: 0,
              width: 64,
              height: 64,
              frameCenter: { x: 32, y: 32 },
            },
            {
              x: 192,
              y: 0,
              width: 64,
              height: 64,
              frameCenter: { x: 32, y: 32 },
            },
          ],
        },
      },
    },
  };

  objectManager.effectManager.createEffectOnUnit(unit, healEffectConfig, {
    attachmentPoint: "center",
    zMode: "over",
    offsetY: -30, // вище юніта
    autoRemove: true,
    loop: false,
  });
}

// ============================================
// ІНТЕГРАЦІЯ В ATTACK ACTION
// ============================================

// Додайте в attackAction.js:

/*
// В методі dealDamage після нанесення шкоди:
dealDamage(attacker, target, damageMultiplier = 1) {
  // ... існуючий код ...
  
  // Створюємо ефект попадання
  if (this.objectManager.effectManager) {
    createHitEffect(this.objectManager, target);
  }
  
  // Якщо вампіризм - показуємо heal ефект
  if (attacker.vampirism && attacker.vampirismPercent > 0) {
    const healAmount = (damage * attacker.vampirismPercent) / 100;
    attacker.health = Math.min(attacker.health + healAmount, attacker.maxHealth);
    
    if (this.objectManager.effectManager) {
      createHealEffect(this.objectManager, attacker);
    }
  }
  
  // Якщо юніт помер - показуємо death effect
  if (target.health <= 0 && !target.isDead) {
    target.isDead = true;
    
    if (this.objectManager.effectManager) {
      createDeathEffect(this.objectManager, target);
    }
  }
}

// В методі execute при початку атаки:
execute(gameObject) {
  if (!gameObject.isAttacking && gameObject.attackTarget) {
    gameObject.isAttacking = true;
    
    // Створюємо ефект початку атаки
    if (this.objectManager.effectManager) {
      createAttackStartEffect(this.objectManager, gameObject);
    }
    
    // ... решта коду ...
  }
}
*/

// ============================================
// ЕКСПОРТ (якщо потрібно використовувати як модуль)
// ============================================

export {
  createHitEffect,
  createAttackStartEffect,
  createMagicCircleEffect,
  createExplosionEffect,
  createAuraEffect,
  createDeathEffect,
  createAreaAttackIndicator,
  createHealEffect,
};
