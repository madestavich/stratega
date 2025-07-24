-- Create game_rooms table for Stratega game
CREATE TABLE IF NOT EXISTS game_rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    creator_id INT NOT NULL,
    second_player_id INT NULL,
    room_type VARCHAR(10) NOT NULL DEFAULT 'public',
    password VARCHAR(255) NULL,
    game_status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    created_at DATETIME NOT NULL,
    current_round INT NOT NULL DEFAULT 0,
    player1_ready TINYINT(1) NOT NULL DEFAULT 0,
    player2_ready TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (second_player_id) REFERENCES users(id) ON DELETE CASCADE
);
