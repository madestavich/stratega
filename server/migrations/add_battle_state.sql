-- Додаємо поля для відстеження стану бою
ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS battle_started TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS player1_in_battle TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS player2_in_battle TINYINT(1) DEFAULT 0;
