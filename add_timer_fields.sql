-- Додавання поля для серверного таймера в існуючу таблицю game_rooms  
ALTER TABLE game_rooms 
ADD COLUMN round_start_time DATETIME NULL;
