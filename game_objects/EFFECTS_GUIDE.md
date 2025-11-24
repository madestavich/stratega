# Система ефектів - Оновлена документація

## Формат конфігурації

Конфіги ефектів тепер мають **той самий формат що й юніти**, тому їх можна створювати в редакторі!

### Структура конфігу ефекту

```json
{
  "effect_name": {
    "name": "effect_name",
    "sourceImage": {
      "link": "../sprites/effects/my_effect.png",
      "width": 256,
      "height": 64
    },
    "animations": {
      "animation_name": {
        "name": "animation_name",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 64,
            "height": 64,
            "frameCenter": { "x": 32, "y": 32 }
          }
        ]
      }
    }
  }
}
```

**Розташування:** `game_configs/effects/effect_name.json`

## Створення ефектів в редакторі

1. Підготуйте спрайт-лист ефекту (PNG файл з кадрами анімації)
2. Відкрийте `redactor/unit_stats_redactor.html`
3. Завантажте спрайт ефекту
4. Виділіть кадри анімації
5. Зберіжіть JSON конфіг в `game_configs/effects/`

**Формат точно такий самий як у юнітів!**

## Використання з конфігів

### Метод 1: Завантаження з назви файлу (рекомендовано)

```javascript
// Автоматично завантажує з game_configs/effects/hit_effect.json
this.objectManager.effectManager.createEffectOnUnit(
  target,
  "hit_effect", // назва без .json
  {
    attachmentPoint: "center",
    zMode: "over",
    autoRemove: true,
  }
);
```

### Метод 2: З готового конфігу

```javascript
const spriteConfig = this.configLoader.getConfig("hit_effect");

this.objectManager.effectManager.createEffectOnUnit(target, spriteConfig, {
  attachmentPoint: "center",
  zMode: "over",
});
```

## Приклади використання

### 1. Ефект попадання

```javascript
// В attackAction.js -> dealDamage()
dealDamage(attacker, target, damageMultiplier = 1) {
  // ... код нанесення шкоди ...

  // Ефект попадання
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
```

### 2. Ефект початку атаки

```javascript
// В attackAction.js -> execute()
if (!gameObject.isAttacking && gameObject.attackTarget) {
  gameObject.isAttacking = true;

  // Свічення навколо атакуючого
  this.objectManager.effectManager.createEffectOnUnit(
    gameObject,
    "attack_glow",
    {
      attachmentPoint: "center",
      zMode: "under",
      autoRemove: true,
      animationName: "glow", // можна вказати конкретну анімацію
    }
  );
}
```

### 3. Ефект вибуху на позиції

```javascript
// Вибух в точці на карті
this.objectManager.effectManager.createEffectAtPosition(
  500, // x
  300, // y
  "explosion",
  {
    zMode: "top",
    autoRemove: true,
    animationName: "explode",
  }
);
```

### 4. Ефект зцілення

```javascript
// Heal sparkles над юнітом
this.objectManager.effectManager.createEffectOnUnit(
  healedUnit,
  "heal_sparkles",
  {
    attachmentPoint: "top",
    zMode: "over",
    offsetY: -20,
    autoRemove: true,
  }
);
```

### 5. Постійна аура (loop)

```javascript
// Магічне коло під юнітом
const auraEffect = this.objectManager.effectManager.createEffectOnUnit(
  mageUnit,
  "magic_circle",
  {
    attachmentPoint: "bottom",
    zMode: "under",
    loop: true,
    autoRemove: false, // НЕ видаляти автоматично
  }
);

// Видалити пізніше:
// this.objectManager.effectManager.removeEffectsForUnit(mageUnit);
```

## Параметри ефектів

### Основні параметри

```javascript
{
  // Точка прив'язки на спрайті юніта
  attachmentPoint: 'center' | 'bottom' | 'top',

  // Z-layer позиціонування
  zMode: 'under' | 'over' | 'top',
  zOffset: 0, // тонке налаштування z

  // Офсети від точки прив'язки
  offsetX: 0,
  offsetY: 0,

  // Lifecycle
  autoRemove: true, // автовидалення після завершення
  loop: false,      // циклічна анімація
  duration: null,   // макс час життя в мс (null = необмежено)

  // Анімація (якщо в конфігу декілька)
  animationName: 'hit' // null = перша доступна
}
```

### Z-index режими

- **`under`** - під юнітом (z = unit.z - 1)
  - Тіні, магічні кола, індикатори на землі
- **`over`** - над юнітом (z = unit.z + 1)
  - Ефекти попадання, спалахи, іскри
- **`top`** - топ-рівень (z = 999999)
  - UI-ефекти, важливі індикатори

### Точки прив'язки

- **`center`** - центр спрайта юніта (x, y)
- **`bottom`** - низ спрайта (автоадаптація до розміру кадру)
- **`top`** - верх спрайта (автоадаптація до розміру кадру)

## Готові конфіги ефектів

В `game_configs/effects/` є приклади:

- `hit_effect.json` - ефект попадання
- `attack_glow.json` - свічення атаки
- `explosion.json` - вибух
- `heal_sparkles.json` - зцілення

Можете створювати свої за тим самим форматом!

## API EffectManager

```javascript
// Створити з конфігу (автозавантаження)
createEffectOnUnit(targetUnit, "effect_name", options);
createEffectAtPosition(x, y, "effect_name", options);

// Створити з готового конфігу
createEffect(spriteConfig, effectConfig);

// Завантажити та створити
await createEffectFromConfig("effect_name", effectConfig);

// Управління
updateAll(deltaTime); // автоматично
renderAll(); // автоматично
clearAll();
removeEffectsForUnit(unit);
getAllEffects();
```

## Debug режим

Натисніть `` ` `` для debug-режиму:

- 🟣 Фіолетова рамка навколо ефекту
- 🟡 Жовта точка в центрі
- 📏 Лінія до target юніта
- 📊 Інформація про z та режим

## Створення нового ефекту

1. **Підготуйте спрайт** (PNG з кадрами анімації)
2. **Відкрийте редактор** `redactor/unit_stats_redactor.html`
3. **Завантажте спрайт**
4. **Виділіть кадри** анімації
5. **Експортуйте JSON**
6. **Збережіть** в `game_configs/effects/my_effect.json`
7. **Використовуйте**:
   ```javascript
   this.objectManager.effectManager.createEffectOnUnit(unit, "my_effect", {
     /* options */
   });
   ```

**Все працює так само як з юнітами!** 🎉
