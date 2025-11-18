# AGENT.md - Stratega Game Project

## Project Overview

Stratega - це багатокористувацька тактична гра у стилі Heroes of Might and Magic, розроблена на JavaScript/PHP. Гра включає систему аутентифікації, управління кімнатами, розстановку юнітів, покрокові бої та систему раундів з таймерами.

## Build/Test Commands

```bash
# Development server deployment (Node.js required for deploy script)
npm run deploy  # Deploys to cPanel hosting via git

# No formal build system - vanilla HTML/JS/PHP project
# Files are served directly from web server
```

## Architecture

- **Frontend**: Vanilla HTML/CSS/JS з модульною ES6 структурою
- **Backend**: PHP з MySQL базою даних для аутентифікації та ігрової логіки
- **Database**: MySQL (`herostri_db`) з таблицями користувачів та ігрових кімнат
- **Game Engine**: Canvas-базований з ES6 модулями через централізований `import.js`
- **Real-time Sync**: HTTP polling для синхронізації стану між гравцями
- **Deployment**: cPanel hosting з git hooks для автоматичного деплою

## Project Structure

```
/                           # Головна сторінка з аутентифікацією та списком кімнат
├── index.html             # Головна сторінка з логіном/реєстрацією
├── script.js              # Логіка аутентифікації та управління кімнатами
├── style.css              # Стилі головної сторінки
├── import.js              # Централізований експорт всіх ES6 модулів
├── deploy.js              # Скрипт автоматичного деплою
├── package.json           # Node.js конфігурація для деплою
├── .cpanel.yml            # Конфігурація cPanel deployment

/game/                     # Основний ігровий інтерфейс
├── game.html              # Ігрова сторінка з canvas та UI
├── gameManager.js         # Основний ігровий менеджер (цикл гри, раунди, таймери)
├── player.js              # Клас гравця з характеристиками
└── style.css              # Стилі ігрового інтерфейсу

/server/                   # Backend API
├── room.php               # API для управління кімнатами та ігровою логікою
└── auth/                  # Система аутентифікації
    ├── config.php         # Конфігурація бази даних
    ├── example.config.php # Приклад конфігурації
    ├── register.php       # Реєстрація користувачів
    ├── login.php          # Вхід користувачів
    ├── logout.php         # Вихід користувачів
    └── check_login.php    # Перевірка статусу авторизації

/game_objects/             # Ігрові об'єкти та менеджери
├── gameObject.js          # Базовий клас ігрових об'єктів (юнітів)
├── objectManager.js       # Менеджер всіх ігрових об'єктів
├── actionManager.js       # Менеджер дій (атак, переміщень)
├── animator.js            # Система анімацій для спрайтів
├── renderer.js            # Система рендерингу об'єктів на canvas
├── particle.js            # Система частинок для ефектів
└── actions/               # Конкретні дії
    ├── moveAction.js      # Логіка переміщення юнітів
    └── attackAction.js    # Логіка атак юнітів

/game_map/                 # Система карти та навігації
├── gridManager.js         # Управління ігровою сіткою
├── mapRender.js           # Рендеринг фонової карти
└── pathfinder.js          # Пошук шляху з уникненням перешкод

/input/                    # Система введення
├── inputManager.js        # Обробка кліків миші та клавіатури
└── interfaceManager.js    # Управління ігровим інтерфейсом

/lobby/                    # Лобі для вибору кімнат
├── lobby.html             # Сторінка лобі
├── lobby.js               # Логіка лобі
└── lobby.css              # Стилі лобі

/game_configs/             # Конфігурації гри
├── configLoader.js        # Завантажувач конфігурацій
├── spriteLoader.js        # Завантажувач спрайтів
├── races.json             # Конфігурація рас та юнітів
└── units/                 # JSON файли з анімаціями юнітів
    ├── archer.json        # Конфігурація лучника
    ├── firebird.json      # Конфігурація жар-птиці
    ├── vampire.json       # Конфігурація вампіра
    └── [... інші юніти]   # Конфігурації всіх юнітів

/redactor/                 # Інструменти розробки
├── redactor.html          # Редактор анімацій спрайтів
├── redactor.js            # Логіка редактора анімацій
├── unit_stats_redactor.html  # Редактор характеристик юнітів
└── unit_stats_redactor.js    # Логіка редактора характеристик

/sprites/                  # Спрайти юнітів (PNG файли)
/textures/                 # Текстури інтерфейсу
/background/maps/          # Фонові карти
└── icons/                 # Іконки інтерфейсу
```

## Key Features

- **Multiplayer Rooms**: Створення публічних/приватних кімнат з паролями
- **Unit Placement**: Покроковий етап розстановки юнітів з таймером
- **Turn-based Combat**: Автоматизовані бої з анімаціями та ефектами
- **Race System**: Різні раси з унікальними юнітами (Castle, Conflux, Dungeon, Necropolis, Rampart)
- **Real-time Sync**: Синхронізація стану гри між гравцями через HTTP polling
- **Animation System**: Повноцінна система анімацій з спрайтами та частинками
- **Grid-based Movement**: Сітчаста система з прямими шляхами та уникненням перешкод
- **Debug Mode**: Візуалізація сітки та шляхів (клавіша `)

## Database Schema

```sql
-- Основні таблиці
users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(255),
  password_hash VARCHAR(255),
  created_at DATETIME
)

game_rooms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  creator_id INT,
  second_player_id INT,
  created_at DATETIME,
  current_round INT DEFAULT 0,
  room_type VARCHAR(10) DEFAULT 'public',
  password VARCHAR(255),
  game_status VARCHAR(20) DEFAULT 'waiting',
  winner_id INT,
  round_state VARCHAR(20),
  round_time INT,
  round_start_time DATETIME,
  player1_objects TEXT,
  player2_objects TEXT,
  player1_ready TINYINT(1) DEFAULT 0,
  player2_ready TINYINT(1) DEFAULT 0,
  player1_money INT,
  player2_money INT,
  player1_unit_limit INT DEFAULT 0,
  player2_unit_limit INT DEFAULT 0,
  max_unit_limit INT,
  round_income INT,
  game_mode VARCHAR(20),
  host_ready TINYINT(1) DEFAULT 0,
  guest_ready TINYINT(1) DEFAULT 0,
  battle_started TINYINT(1) DEFAULT 0,
  player1_in_battle TINYINT(1) DEFAULT 0,
  player2_in_battle TINYINT(1) DEFAULT 0
)
```

## Game Flow

1. **Authentication**: Реєстрація/логін через PHP сесії
2. **Room Creation**: Створення або приєднання до ігрової кімнати
3. **Unit Placement**: Розстановка юнітів за 30-45 секунд з таймером
4. **Battle Phase**: Автоматичний бій до знищення всіх юнітів однієї сторони
5. **Round Completion**: Підрахунок переможця та переход до нового раунду

## Code Style

- **Language**: Українська для UI тексту, англійська для коду
- **Modules**: ES6 imports/exports через централізований `import.js`
- **Naming**: camelCase для змінних/функцій, PascalCase для класів
- **Error Handling**: Try-catch для API викликів з user-friendly alerts
- **PHP**: Стандартний PHP з prepared statements для запитів до БД
- **Comments**: Українські коментарі для бізнес-логіки, англійські для технічних деталей

## Development Tools

- **Animation Editor**: `redactor/redactor.html` - візуальний редактор анімацій спрайтів
- **Stats Editor**: `redactor/unit_stats_redactor.html` - редактор характеристик юнітів
- **Debug Mode**: Клавіша ` для включення режиму налагодження з візуалізацією сітки
- **Auto-deployment**: `deploy.js` script для автоматичного деплою на cPanel

## Unit Connection System (Підключення нових юнітів)

Для додавання нового юніта в гру потрібно виконати 3 кроки:

### 1. Створити конфігурацію анімацій (`/game_configs/units/unit_name.json`)

Файл містить структуру анімацій спрайта:

```json
{
  "unit_name": {
    "name": "unit_name",
    "sourceImage": {
      "link": "../sprites/unit_name.png",
      "width": 730,
      "height": 895
    },
    "animations": {
      "idle": { "name": "idle", "frames": [...] },
      "move": { "name": "move", "frames": [...] },
      "attack": { "name": "attack", "frames": [...] },
      "range_attack": { "name": "range_attack", "frames": [...] },  // Для ranged units
      "death": { "name": "death", "frames": [...] },
      "bullet": { "name": "bullet", "frames": [...] },  // Для ranged units
      "icon": { "name": "icon", "frames": [...] }
    }
  }
}
```

**Структура frame:**

- `x, y` - координати на спрайт-шиті
- `width, height` - розміри фрейму
- `frameCenter` - центр фрейму для позиціювання

**Інструменти:**

- Використовуйте `redactor/redactor.html` для візуального створення анімацій
- Спрайт PNG має бути в `/sprites/unit_name.png`

### 2. Додати параметри юніта в races.json (`/game_configs/races.json`)

Вказати расу, тір та характеристики:

```json
"fortress": {
  "units": {
    "tier_one": {
      "gnoll_marauder": {
        "gridWidth": 1,              // Ширина на сітці
        "gridHeight": 1,             // Висота на сітці
        "objectType": "gnoll_marauder",
        "actionPriorities": ["attack", "move"],
        "moveSpeed": 14,             // Швидкість руху
        "availableActions": ["move", "attack"],
        "attackDamage": 18,          // Шкода атаки
        "attackSpeed": 1.1,          // Швидкість атаки
        "health": 60,                // Здоров'я
        "cost": 95,                  // Вартість юніта
        "isRanged": false            // Опціонально: дистанційна атака
      }
    }
  }
}
```

**Параметри для ranged units:**

```json
"isRanged": true,
"maxShots": 10,
"minRangeDistance": 6,
"maxRangeDistance": 25,
"bulletConfig": {
  "bulletType": "bullet",
  "moveSpeed": 40,
  "bulletDamage": 25
}
```

**Інструменти:**

- Використовуйте `redactor/unit_stats_redactor.html` для редагування характеристик

### 3. Зареєструвати спрайт у spriteLoader.js (`/game_configs/spriteLoader.js`)

Додати маппінг у `spriteConfigMap`:

```javascript
this.spriteConfigMap = {
  // ... інші юніти
  //! fortress
  gnoll: "/game_configs/units/gnoll.json",
  gnoll_marauder: "/game_configs/units/gnoll_marauder.json",
  basilisk: "/game_configs/units/basilisk.json",
};
```

**Важливо:** Ключ у spriteConfigMap має збігатися з `objectType` у races.json

### Повний чеклист для нового юніта:

- [ ] PNG спрайт у `/sprites/unit_name.png`
- [ ] JSON анімацій у `/game_configs/units/unit_name.json`
- [ ] Параметри у `/game_configs/races.json` (правильна раса + тір)
- [ ] Реєстрація у `/game_configs/spriteLoader.js`
- [ ] Перевірка: `objectType` однаковий у всіх місцях

### Приклад: Додавання gnoll_marauder

```javascript
// 1. Створено game_configs/units/gnoll_marauder.json з анімаціями
// 2. Додано в races.json:
"fortress": {
  "units": {
    "tier_one": {
      "gnoll_marauder": { /* параметри */ }
    }
  }
}
// 3. Зареєстровано в spriteLoader.js:
gnoll_marauder: "/game_configs/units/gnoll_marauder.json"
```
