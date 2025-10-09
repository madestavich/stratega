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
└── pathfinder.js          # Алгоритм пошуку шляху (A*)

/input/                    # Система введення
├── inputManager.js        # Обробка кліків миші та клавіатури
└── interfaceManager.js    # Управління ігровим інтерфейсом

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
- **Grid-based Movement**: Гексагональна сітка з A\* pathfinding
- **Debug Mode**: Візуалізація сітки та шляхів (клавіша `)

## Database Schema

```sql
-- Основні таблиці
users (id, username, password_hash, created_at)
game_rooms (
  id, creator_id, second_player_id, created_at,
  current_round, room_type, password, game_status,
  winner_id, round_state, round_time, round_start_time,
  player1_objects, player2_objects,
  player1_ready, player2_ready
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
