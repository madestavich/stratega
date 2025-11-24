/**
 * ПРИКЛАДИ ВИКОРИСТАННЯ СИСТЕМИ ЕФЕКТІВ (ОНОВЛЕНО)
 *
 * Тепер ефекти завантажуються з конфігів (як юніти)!
 * Конфіги в форматі юнітів: game_configs/effects/*.json
 */

// ============================================
// 1. ЕФЕКТ ПОПАДАННЯ (Hit Effect)
// ============================================

function createHitEffect(objectManager, target) {
  // Завантажується з game_configs/effects/hit_effect.json
  objectManager.effectManager.createEffectOnUnit(
    target,
    "hit_effect", // назва файлу без .json
    {
      attachmentPoint: "center",
      zMode: "over",
      autoRemove: true,
      loop: false,
    }
  );
}

// ============================================
// 2. ЕФЕКТ ПОЧАТКУ АТАКИ (Attack Start Effect)
// ============================================

function createAttackStartEffect(objectManager, attacker) {
  // Завантажується з game_configs/effects/attack_glow.json
  objectManager.effectManager.createEffectOnUnit(attacker, "attack_glow", {
    attachmentPoint: "center",
    zMode: "over",
    offsetY: -20,
    autoRemove: true,
    loop: false,
    animationName: "glow", // можна вказати конкретну анімацію
  });
}

// ============================================
// 3. ЕФЕКТ ВИБУХУ (Explosion)
// ============================================

function createExplosionEffect(objectManager, x, y) {
  // Завантажується з game_configs/effects/explosion.json
  objectManager.effectManager.createEffectAtPosition(x, y, "explosion", {
    zMode: "top",
    autoRemove: true,
    loop: false,
    animationName: "explode",
  });
}

// ============================================
// 4. HEAL ЕФЕКТ (Healing Effect)
// ============================================

function createHealEffect(objectManager, unit) {
  // Завантажується з game_configs/effects/heal_sparkles.json
  objectManager.effectManager.createEffectOnUnit(unit, "heal_sparkles", {
    attachmentPoint: "center",
    zMode: "over",
    offsetY: -30,
    autoRemove: true,
    loop: false,
    animationName: "heal",
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
    this.objectManager.effectManager.createEffectOnUnit(
      target,
      'hit_effect',
      {
        attachmentPoint: 'center',
        zMode: 'over',
        autoRemove: true
      }
    );
  }
  
  // Якщо вампіризм - показуємо heal ефект
  if (attacker.vampirism && attacker.vampirismPercent > 0) {
    const healAmount = (damage * attacker.vampirismPercent) / 100;
    attacker.health = Math.min(attacker.health + healAmount, attacker.maxHealth);
    
    if (this.objectManager.effectManager) {
      this.objectManager.effectManager.createEffectOnUnit(
        attacker,
        'heal_sparkles',
        {
          attachmentPoint: 'top',
          zMode: 'over',
          offsetY: -20,
          autoRemove: true
        }
      );
    }
  }
  
  // Якщо юніт помер - показуємо death effect (якщо створено)
  if (target.health <= 0 && !target.isDead) {
    target.isDead = true;
    
    if (this.objectManager.effectManager) {
      this.objectManager.effectManager.createEffectOnUnit(
        target,
        'death_smoke', // потрібно створити конфіг
        {
          attachmentPoint: 'bottom',
          zMode: 'over',
          autoRemove: true
        }
      );
    }
  }
}

// В методі execute при початку атаки:
execute(gameObject) {
  if (!gameObject.isAttacking && gameObject.attackTarget) {
    gameObject.isAttacking = true;
    
    // Створюємо ефект початку атаки
    if (this.objectManager.effectManager) {
      this.objectManager.effectManager.createEffectOnUnit(
        gameObject,
        'attack_glow',
        {
          attachmentPoint: 'center',
          zMode: 'under',
          autoRemove: true
        }
      );
    }
    
    // ... решта коду ...
  }
}
*/

// ============================================
// ЕКСПОРТ
// ============================================

export {
  createHitEffect,
  createAttackStartEffect,
  createExplosionEffect,
  createHealEffect,
};
