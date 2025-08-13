<?php
session_start();
require_once 'auth/config.php';

// Database connection
try {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    $conn->set_charset("utf8");
    
    // Drop and recreate game_rooms table to ensure correct structure
    // $conn->query("DROP TABLE IF EXISTS game_rooms");
    
    // $createTableSQL = "
    // CREATE TABLE game_rooms (
    //     id INT AUTO_INCREMENT PRIMARY KEY,
    //     creator_id INT NOT NULL,
    //     second_player_id INT NULL,
    //     created_at DATETIME NOT NULL,
    //     current_round INT NOT NULL DEFAULT 0,
    //     room_type VARCHAR(10) NOT NULL DEFAULT 'public',
    //     password VARCHAR(255) NULL,
    //     game_status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    //     winner_id INT NULL,
    //     round_state VARCHAR(20) NULL,
    //     round_time INT NULL,
    //     player1_objects TEXT NULL,
    //     player2_objects TEXT NULL,
    //     player1_ready TINYINT(1) NOT NULL DEFAULT 0,
    //     player2_ready TINYINT(1) NOT NULL DEFAULT 0,
    //     FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    //     FOREIGN KEY (second_player_id) REFERENCES users(id) ON DELETE CASCADE,
    //     FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
    // )";
    // $conn->query($createTableSQL);
    
} catch (mysqli_sql_exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $_GET['action'] ?? $input['action'] ?? '';

    switch ($action) {
        case 'create_room':
            createRoom($input);
            break;
        case 'join_room':
            joinRoom($input);
            break;
        case 'get_rooms':
            getRooms();
            break;
        case 'get_room_info':
            getRoomInfo($input);
            break;
        case 'save_objects':
            saveObjects($input);
            break;
        case 'load_objects':
            loadObjects($input);
            break;
        case 'get_current_room':
            getCurrentRoom();
            break;
        case 'set_ready':
            setPlayerReady($input);
            break;
        case 'check_round_status':
            checkRoundStatus($input);
            break;
        case 'reset_ready_status':
            resetReadyStatus($input);
            break;
        case 'start_round_timer':
            startRoundTimer($input);
            break;
        case 'increment_round':
            incrementRound($input);
            break;
        case 'get_winner_info':
            getWinnerInfo($input);
            break;
        case 'get_room_players':
            getRoomPlayers($input);
            break;
        default:
            throw new Exception('Невідома дія');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}

function createRoom($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $creator_id = $_SESSION['user_id'];
    
    // Check if user is already in an active room
    $checkStmt = $conn->prepare("SELECT id FROM game_rooms WHERE (creator_id = ? OR second_player_id = ?) AND game_status IN ('waiting', 'in_progress')");
    $checkStmt->bind_param("ii", $creator_id, $creator_id);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    
    if ($result->num_rows > 0) {
        throw new Exception('Ви вже берете участь в активній кімнаті');
    }
    
    $room_type = $data['room_type'] ?? 'public';
    $password = isset($data['password']) ? password_hash($data['password'], PASSWORD_DEFAULT) : null;
    $round_time = $data['round_time'] ?? 45; // Default 45 seconds
    
    $game_status = 'waiting';
    
    // Debug logging
    error_log("Creating room with: creator_id=$creator_id, room_type=$room_type, round_time=$round_time, game_status=$game_status");
    
    $stmt = $conn->prepare("INSERT INTO game_rooms (creator_id, created_at, room_type, password, game_status, round_time) VALUES (?, NOW(), ?, ?, ?, ?)");
    $stmt->bind_param("isssi", $creator_id, $room_type, $password, $game_status, $round_time);
    
    if ($stmt->execute()) {
        $room_id = $conn->insert_id;
        echo json_encode([
            'success' => true,
            'room_id' => $room_id,
            'message' => 'Кімнату створено успішно',
            'redirect' => 'game/game.html'
        ]);
    } else {
        throw new Exception('Помилка створення кімнати');
    }
}

function joinRoom($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    $password = $data['password'] ?? '';
    
    // Check if user is already in an active room
    $checkStmt = $conn->prepare("SELECT id FROM game_rooms WHERE (creator_id = ? OR second_player_id = ?) AND game_status IN ('waiting', 'in_progress')");
    $checkStmt->bind_param("ii", $user_id, $user_id);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    
    if ($result->num_rows > 0) {
        throw new Exception('Ви вже берете участь в активній кімнаті');
    }
    
    // Перевіряємо чи існує кімната
    $stmt = $conn->prepare("SELECT * FROM game_rooms WHERE id = ? AND game_status = 'waiting'");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена або вже зайнята');
    }
    
    if ($room['creator_id'] == $user_id) {
        throw new Exception('Ви не можете приєднатися до власної кімнати');
    }
    
    // Перевіряємо пароль якщо кімната приватна
    if ($room['room_type'] === 'private' && !password_verify($password, $room['password'])) {
        throw new Exception('Невірний пароль');
    }
    
    // Приєднуємо гравця до кімнати
    $stmt = $conn->prepare("UPDATE game_rooms SET second_player_id = ?, game_status = 'in_progress' WHERE id = ?");
    $stmt->bind_param("ii", $user_id, $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Успішно приєдналися до кімнати',
            'redirect' => 'game/game.html'
        ]);
    } else {
        throw new Exception('Помилка приєднання до кімнати');
    }
}

function getRooms() {
    global $conn;
    
    $stmt = $conn->prepare("
        SELECT 
            gr.id, 
            gr.creator_id,
            gr.second_player_id,
            gr.room_type, 
            gr.game_status, 
            gr.created_at,
            u1.username as creator_name,
            u2.username as second_player_name
        FROM game_rooms gr 
        LEFT JOIN users u1 ON gr.creator_id = u1.id 
        LEFT JOIN users u2 ON gr.second_player_id = u2.id 
        WHERE gr.game_status IN ('waiting', 'in_progress') 
        ORDER BY gr.created_at DESC
    ");
    $stmt->execute();
    $result = $stmt->get_result();
    
    $rooms = [];
    while ($row = $result->fetch_assoc()) {
        $rooms[] = $row;
    }
    
    echo json_encode(['rooms' => $rooms]);
}

function getRoomInfo($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $room_id = $data['room_id'] ?? 0;
    $user_id = $_SESSION['user_id'];
    
    $stmt = $conn->prepare("
        SELECT 
            gr.*,
            u1.username as creator_name,
            u2.username as second_player_name
        FROM game_rooms gr 
        LEFT JOIN users u1 ON gr.creator_id = u1.id 
        LEFT JOIN users u2 ON gr.second_player_id = u2.id 
        WHERE gr.id = ? AND (gr.creator_id = ? OR gr.second_player_id = ?)
    ");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена або немає доступу');
    }
    
    echo json_encode(['room' => $room]);
}

function saveObjects($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    $objects = $data['objects'] ?? [];
    
    // Find user's active room and their role
    $stmt = $conn->prepare("SELECT * FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена або немає доступу');
    }
    
    // Determine which player field to update
    $player_field = ($room['creator_id'] == $user_id) ? 'player1_objects' : 'player2_objects';
    
    // Serialize objects to JSON
    $objects_json = json_encode($objects);
    
    // Update the appropriate player objects field
    $stmt = $conn->prepare("UPDATE game_rooms SET $player_field = ? WHERE id = ?");
    $stmt->bind_param("si", $objects_json, $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Об\'єкти збережено успішно'
        ]);
    } else {
        throw new Exception('Помилка збереження об\'єктів');
    }
}

function loadObjects($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    // Find user's active room
    $stmt = $conn->prepare("SELECT * FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена або немає доступу');
    }
    
    // Determine player and enemy objects
    $player_objects = [];
    $enemy_objects = [];
    
    if ($room['creator_id'] == $user_id) {
        // User is player 1 (creator)
        $player_objects = $room['player1_objects'] ? json_decode($room['player1_objects'], true) : [];
        $enemy_objects = $room['player2_objects'] ? json_decode($room['player2_objects'], true) : [];
    } else {
        // User is player 2
        $player_objects = $room['player2_objects'] ? json_decode($room['player2_objects'], true) : [];
        $enemy_objects = $room['player1_objects'] ? json_decode($room['player1_objects'], true) : [];
    }
    
    echo json_encode([
        'success' => true,
        'player_objects' => $player_objects,
        'enemy_objects' => $enemy_objects
    ]);
}

function getCurrentRoom() {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    
    // Find user's active room
    $stmt = $conn->prepare("SELECT id, creator_id, second_player_id FROM game_rooms WHERE (creator_id = ? OR second_player_id = ?) AND game_status IN ('waiting', 'in_progress') LIMIT 1");
    $stmt->bind_param("ii", $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if ($room) {
        echo json_encode([
            'success' => true,
            'room_id' => $room['id'],
            'is_creator' => ($room['creator_id'] == $user_id)
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Користувач не знаходиться в активній кімнаті'
        ]);
    }
}

function setPlayerReady($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    // Find user's active room and their role
    $stmt = $conn->prepare("SELECT * FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена або немає доступу');
    }
    
    // Determine which player ready field to update
    $ready_field = ($room['creator_id'] == $user_id) ? 'player1_ready' : 'player2_ready';
    
    // Set player as ready
    $stmt = $conn->prepare("UPDATE game_rooms SET $ready_field = 1 WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Гравець готовий'
        ]);
    } else {
        throw new Exception('Помилка оновлення статусу готовності');
    }
}

function checkRoundStatus($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    // Get room status
    $stmt = $conn->prepare("SELECT * FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена або немає доступу');
    }
    
    $both_ready = ($room['player1_ready'] == 1 && $room['player2_ready'] == 1);
    $round_time = $room['round_time'];
    
    // Рахуємо залишковий час на основі серверного часу
    $time_left = 0;
    $round_active = false;
    
    if ($room['round_start_time']) {
        $start_time = new DateTime($room['round_start_time']);
        $current_time = new DateTime();
        $elapsed = $current_time->getTimestamp() - $start_time->getTimestamp();
        $time_left = max(0, $room['round_time'] - $elapsed);
        $round_active = ($time_left > 0);
        
        // Автоматичне завершення раунду якщо час вийшов
        if ($time_left <= 0 && !$both_ready) {
            // Встановлюємо обох гравців як готових
            $stmt = $conn->prepare("
                UPDATE game_rooms 
                SET player1_ready = 1, player2_ready = 1, round_start_time = NULL 
                WHERE id = ?
            ");
            $stmt->bind_param("i", $room_id);
            $stmt->execute();
            
            // Оновлюємо змінні
            $both_ready = true;
            $round_active = false;
            
            echo json_encode([
                'success' => true,
                'player1_ready' => true,
                'player2_ready' => true,
                'both_ready' => true,
                'round_time' => $round_time,
                'time_left' => 0,
                'round_active' => false,
                'should_start_game' => true,
                'auto_ended' => true
            ]);
            return;
        }
    }
    
    echo json_encode([
        'success' => true,
        'player1_ready' => (bool)$room['player1_ready'],
        'player2_ready' => (bool)$room['player2_ready'],
        'both_ready' => $both_ready,
        'round_time' => $round_time,
        'time_left' => $time_left,
        'round_active' => $round_active,
        'should_start_game' => $both_ready
    ]);
}

function resetReadyStatus($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    // Reset both players ready status and clear round timer
    $stmt = $conn->prepare("UPDATE game_rooms SET player1_ready = 0, player2_ready = 0, round_start_time = NULL WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Ready status reset'
        ]);
    } else {
        throw new Exception('Помилка скидання статусу готовності');
    }

}

function startRoundTimer($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $room_id = $data['room_id'] ?? 0;
    $duration = $data['duration'] ?? 45; // Тривалість раунду в секундах
    
    // Перевіряємо чи таймер вже активний
    $stmt = $conn->prepare("SELECT round_start_time, round_time FROM game_rooms WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if ($room['round_start_time']) {
        // Таймер вже активний - повертаємо поточний стан
        echo json_encode([
            'success' => true,
            'message' => 'Таймер раунду вже активний',
            'duration' => $room['round_time'],
            'already_active' => true
        ]);
        return;
    }
    
    // Встановлюємо час початку раунду
    $stmt = $conn->prepare("
        UPDATE game_rooms 
        SET round_start_time = NOW()
        WHERE id = ?
    ");
    $stmt->bind_param("i", $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Таймер раунду запущено',
            'duration' => $room['round_time']
        ]);
    } else {
        throw new Exception('Помилка запуску таймера раунду');
    }
}

function incrementRound($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    $winner_id = $data['winner_id'] ?? null;
    
    // Check if round is already incremented (race condition protection)
    $stmt = $conn->prepare("SELECT current_round FROM game_rooms WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $current_room = $result->fetch_assoc();
    $current_round_before = $current_room['current_round'];
    
    // Increment round number and set winner only if not already incremented
    $stmt = $conn->prepare("UPDATE game_rooms SET current_round = current_round + 1, winner_id = ? WHERE id = ? AND (creator_id = ? OR second_player_id = ?) AND current_round = ?");
    $stmt->bind_param("iiiii", $winner_id, $room_id, $user_id, $user_id, $current_round_before);
    
    if ($stmt->execute() && $stmt->affected_rows > 0) {
        // Successfully incremented (we were first)
        echo json_encode([
            'success' => true,
            'message' => 'Round incremented',
            'new_round' => $current_round_before + 1,
            'was_first' => true
        ]);
    } else {
        // Round was already incremented by other player
        $stmt = $conn->prepare("SELECT current_round FROM game_rooms WHERE id = ?");
        $stmt->bind_param("i", $room_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $room = $result->fetch_assoc();
        
        echo json_encode([
            'success' => true,
            'message' => 'Round already incremented by other player',
            'new_round' => $room['current_round'],
            'was_first' => false
        ]);
    }
}

function getWinnerInfo($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $room_id = $data['room_id'] ?? 0;
    
    // Get winner information
    $stmt = $conn->prepare("SELECT gr.current_round, gr.winner_id, u.username as winner_nickname FROM game_rooms gr LEFT JOIN users u ON gr.winner_id = u.id WHERE gr.id = ?");
    
    if (!$stmt) {
        throw new Exception('Помилка підготовки запиту: ' . $conn->error);
    }
    
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if ($room) {
        echo json_encode([
            'success' => true,
            'current_round' => $room['current_round'],
            'winner_id' => $room['winner_id'],
            'winner_nickname' => $room['winner_nickname']
        ]);
    } else {
        throw new Exception('Кімнату не знайдено');
    }
}

function getRoomPlayers($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    // Get room players information
    $stmt = $conn->prepare("SELECT creator_id, second_player_id FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    
    if (!$stmt) {
        throw new Exception('Помилка підготовки запиту: ' . $conn->error);
    }
    
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if ($room) {
        echo json_encode([
            'success' => true,
            'creator_id' => $room['creator_id'],
            'second_player_id' => $room['second_player_id'],
            'current_user_id' => $user_id
        ]);
    } else {
        throw new Exception('Кімнату не знайдено');
    }
}
?>
