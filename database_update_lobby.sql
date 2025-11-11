-- Скрипт для оновлення структури бази даних game_rooms
-- Додає нові поля для функціоналу лоббі

-- Додаємо поле game_mode (режим гри)
ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS game_mode VARCHAR(20) NOT NULL DEFAULT 'all_races' 
COMMENT 'Режим гри: classic (вибір раси) або all_races (всі раси доступні)';

-- Додаємо поля для рас гравців
ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS player1_race VARCHAR(50) NULL 
COMMENT 'Обрана раса гравця 1 (NULL якщо режим all_races)';

ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS player2_race VARCHAR(50) NULL 
COMMENT 'Обрана раса гравця 2 (NULL якщо режим all_races)';

-- Додаємо поля готовності для лоббі (замінюють player1_ready/player2_ready)
ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS host_ready TINYINT(1) NOT NULL DEFAULT 0 
COMMENT 'Готовність хоста в лоббі';

ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS guest_ready TINYINT(1) NOT NULL DEFAULT 0 
COMMENT 'Готовність гостя в лоббі';

-- ПРИМІТКА: Якщо у вас є старі поля player1_ready та player2_ready,
-- ви можете їх видалити або залишити для зворотної сумісності:
-- ALTER TABLE game_rooms DROP COLUMN IF EXISTS player1_ready;
-- ALTER TABLE game_rooms DROP COLUMN IF EXISTS player2_ready;

-- Перевірка структури таблиці
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT, 
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'stratega' -- Замініть на назву вашої БД
  AND TABLE_NAME = 'game_rooms'
ORDER BY ORDINAL_POSITION;
