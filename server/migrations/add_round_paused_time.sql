-- Add round_paused_time column to support timer pause/resume
ALTER TABLE game_rooms ADD COLUMN round_paused_time INT DEFAULT NULL;
