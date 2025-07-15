# AGENT.md - Stratega Game Project

## Build/Test Commands
No build system or test framework currently configured - vanilla HTML/JS/PHP project

## Architecture
- **Frontend**: Vanilla HTML/CSS/JS with modular ES6 structure
- **Backend**: PHP with MySQL database for user authentication
- **Database**: MySQL (`herostri_db`) with user authentication tables
- **Game Engine**: Canvas-based with ES6 modules via `import.js`

## Project Structure
- `/` - Main entry point (`index.html`, `script.js`)
- `/server/auth/` - PHP authentication API (register, login, logout, check_login)
- `/game/` - Core game files (GameManager, Player)
- `/game_objects/` - Game entities and managers (ObjectManager, ActionManager)
- `/game_map/` - Map and pathfinding logic
- `/input/` - Input handling (InputManager, InterfaceManager)
- `/game_configs/` - JSON configuration files for units/races
- `/sprites/`, `/textures/` - Game assets

## Code Style
- **Language**: Ukrainian for UI text, English for code
- **Modules**: ES6 imports/exports via central `import.js` file
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Error Handling**: Try-catch for API calls with user-friendly alerts
- **PHP**: Standard PHP with prepared statements for database queries
