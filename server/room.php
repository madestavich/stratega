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
        case 'pause_round_timer':
            pauseRoundTimer($input);
            break;
        case 'resume_round_timer':
            resumeRoundTimer($input);
            break;
        case 'increment_round':
            incrementRound($input);
            break;
        case 'get_room_players':
            getRoomPlayers($input);
            break;
        case 'get_player_money':
            getPlayerMoney($input);
            break;
        case 'save_player_money':
            savePlayerMoney($input);
            break;
        case 'get_player_unit_limit':
            getPlayerUnitLimit($input);
            break;
        case 'save_player_unit_limit':
            savePlayerUnitLimit($input);
            break;
        case 'get_max_unit_limit':
            getMaxUnitLimit($input);
            break;
        case 'save_max_unit_limit':
            saveMaxUnitLimit($input);
            break;
        case 'get_round_income':
            getRoundIncome($input);
            break;
        case 'set_battle_state':
            setBattleState($input);
            break;
        case 'get_battle_state':
            getBattleState($input);
            break;
        case 'check_battle_completion':
            checkBattleCompletion($input);
            break;
        case 'clear_winner':
            clearWinner($input);
            break;
        case 'heartbeat':
            heartbeat($input);
            break;
        case 'check_players_online':
            checkPlayersOnline($input);
            break;
        case 'detect_battle_deadlock':
            detectBattleDeadlock($input);
            break;
        // New lobby endpoints
        case 'update_room_settings':
            updateRoomSettings($input);
            break;
        case 'select_race':
            selectRace($input);
            break;
        case 'toggle_ready_lobby':
            toggleReadyLobby($input);
            break;
        case 'start_game_from_lobby':
            startGameFromLobby($input);
            break;
        case 'get_lobby_state':
            getLobbyState($input);
            break;
        case 'leave_room':
            leaveRoom($input);
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
    
    // Fixed default values - all settings will be configured in lobby
    $round_time = 45; // 45 seconds
    $starting_money = 1000; // 1000 gold
    $round_income = 200; // 200 gold per round
    $max_unit_limit = 40; // 40 units max
    $game_mode = 'all_races'; // All races available by default
    
    $game_status = 'waiting';
    
    // Debug logging
    error_log("Creating room with defaults: creator_id=$creator_id, room_type=$room_type, round_time=$round_time, starting_money=$starting_money, round_income=$round_income, max_unit_limit=$max_unit_limit, game_mode=$game_mode");
    
    $stmt = $conn->prepare("INSERT INTO game_rooms (creator_id, created_at, room_type, password, game_status, round_time, player1_money, player2_money, player1_unit_limit, player2_unit_limit, max_unit_limit, round_income, game_mode, host_ready, guest_ready) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 0, 0)");
    
    if (!$stmt) {
        error_log("MySQL prepare error: " . $conn->error);
        throw new Exception('Помилка підготовки SQL запиту: ' . $conn->error);
    }
    
    // Types: i=integer, s=string
    // Параметри: creator_id(i), room_type(s), password(s), game_status(s), round_time(i), player1_money(i), player2_money(i), max_unit_limit(i), round_income(i), game_mode(s)
    $stmt->bind_param("isssiiiiis", $creator_id, $room_type, $password, $game_status, $round_time, $starting_money, $starting_money, $max_unit_limit, $round_income, $game_mode);
    
    if ($stmt->execute()) {
        $room_id = $conn->insert_id;
        echo json_encode([
            'success' => true,
            'room_id' => $room_id,
            'message' => 'Кімнату створено успішно',
            'redirect' => '/lobby/lobby.html?room_id=' . $room_id
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
    
    // Приєднуємо гравця до кімнати (статус залишається 'waiting' для лоббі)
    $stmt = $conn->prepare("UPDATE game_rooms SET second_player_id = ? WHERE id = ?");
    $stmt->bind_param("ii", $user_id, $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Успішно приєдналися до кімнати',
            'redirect' => '/lobby/lobby.html?room_id=' . $room_id
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
    $is_paused = false;
    
    if ($room['round_paused_time']) {
        // Таймер на паузі - повертаємо збережений час
        $time_left = $room['round_paused_time'];
        $round_active = true;
        $is_paused = true;
    } elseif ($room['round_start_time']) {
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
        'is_paused' => $is_paused,
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
    
    // Reset both players ready status and clear round timer, also reset battle state
    // DO NOT clear winner_id here - it's needed for modal after reload
    $stmt = $conn->prepare("UPDATE game_rooms SET player1_ready = 0, player2_ready = 0, round_start_time = NULL, battle_started = 0, player1_in_battle = 0, player2_in_battle = 0 WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
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
    $stmt = $conn->prepare("SELECT round_start_time, round_time, round_paused_time FROM game_rooms WHERE id = ?");
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
        SET round_start_time = NOW(), round_paused_time = NULL
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

function pauseRoundTimer($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $room_id = $data['room_id'] ?? 0;
    
    // Зберігаємо поточний залишковий час
    $stmt = $conn->prepare("SELECT round_start_time, round_time, round_paused_time FROM game_rooms WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room['round_start_time'] || $room['round_paused_time']) {
        // Таймер не активний або вже на паузі
        echo json_encode([
            'success' => true,
            'message' => 'Таймер вже на паузі або не активний',
            'already_paused' => true
        ]);
        return;
    }
    
    // Рахуємо скільки часу минуло
    $start_time = new DateTime($room['round_start_time']);
    $current_time = new DateTime();
    $elapsed = $current_time->getTimestamp() - $start_time->getTimestamp();
    $time_left = max(0, $room['round_time'] - $elapsed);
    
    error_log("Pausing timer - elapsed: $elapsed, round_time: {$room['round_time']}, time_left: $time_left");
    
    // Зберігаємо залишковий час
    $stmt = $conn->prepare("
        UPDATE game_rooms 
        SET round_paused_time = ?, round_start_time = NULL
        WHERE id = ?
    ");
    $stmt->bind_param("ii", $time_left, $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Таймер раунду призупинено',
            'time_left' => $time_left
        ]);
    } else {
        throw new Exception('Помилка паузи таймера раунду');
    }
}

function resumeRoundTimer($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $room_id = $data['room_id'] ?? 0;
    
    // Отримуємо збережений час
    $stmt = $conn->prepare("SELECT round_paused_time, round_time FROM game_rooms WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room['round_paused_time']) {
        // Таймер не на паузі
        echo json_encode([
            'success' => true,
            'message' => 'Таймер не на паузі',
            'not_paused' => true
        ]);
        return;
    }
    
    // Відновлюємо таймер зі збереженим часом
    // Встановлюємо новий round_start_time так, щоб залишок часу був як збережений
    $time_left = $room['round_paused_time'];
    $elapsed_before_pause = $room['round_time'] - $time_left;
    $new_start_time = time() - $elapsed_before_pause;
    $new_start_datetime = date('Y-m-d H:i:s', $new_start_time);
    
    error_log("Resuming timer - time_left: $time_left, round_time: {$room['round_time']}, elapsed_before_pause: $elapsed_before_pause, new_start_time: $new_start_datetime");
    
    $stmt = $conn->prepare("
        UPDATE game_rooms 
        SET round_start_time = ?, round_paused_time = NULL
        WHERE id = ?
    ");
    $stmt->bind_param("si", $new_start_datetime, $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Таймер раунду відновлено',
            'time_left' => $time_left
        ]);
    } else {
        throw new Exception('Помилка відновлення таймера раунду');
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
    
    error_log("=== INCREMENT ROUND START === room_id: $room_id, winner_id: " . ($winner_id ?? 'NULL') . ", user_id: $user_id");
    
    // Get current state BEFORE increment for logging and response
    $stmt = $conn->prepare("SELECT current_round, battle_started, winner_id FROM game_rooms WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $current_room = $result->fetch_assoc();
    $current_round_before = $current_room['current_round'];
    $battle_started_before = $current_room['battle_started'];
    $winner_before = $current_room['winner_id'];
    
    error_log("State BEFORE: round=$current_round_before, battle_started=$battle_started_before, winner=" . ($winner_before ?? 'NULL'));
    
    // ATOMIC UPDATE: Increment round ONLY if battle is still started (not already finished)
    // This prevents race condition - only the first player will successfully update
    if ($winner_id !== null) {
        $stmt = $conn->prepare("UPDATE game_rooms SET current_round = current_round + 1, winner_id = ?, battle_started = 0, player1_in_battle = 0, player2_in_battle = 0 WHERE id = ? AND (creator_id = ? OR second_player_id = ?) AND current_round = ? AND battle_started = 1");
        $stmt->bind_param("iiiii", $winner_id, $room_id, $user_id, $user_id, $current_round_before);
    } else {
        $stmt = $conn->prepare("UPDATE game_rooms SET current_round = current_round + 1, winner_id = NULL, battle_started = 0, player1_in_battle = 0, player2_in_battle = 0 WHERE id = ? AND (creator_id = ? OR second_player_id = ?) AND current_round = ? AND battle_started = 1");
        $stmt->bind_param("iiii", $room_id, $user_id, $user_id, $current_round_before);
    }
    
    $stmt->execute();
    $affected = $stmt->affected_rows;
    
    error_log("UPDATE affected_rows: $affected");
    $stmt->execute();
    $affected = $stmt->affected_rows;
    
    error_log("UPDATE affected_rows: $affected");
    
    if ($affected > 0) {
        // Successfully incremented (we were first)
        $new_round = $current_round_before + 1;
        error_log("SUCCESS: Round incremented to $new_round, winner_id set to: " . ($winner_id ?? 'NULL'));
        echo json_encode([
            'success' => true,
            'message' => 'Round incremented',
            'new_round' => $new_round,
            'was_first' => true
        ]);
    } else {
        // Round was already incremented by other player - get current state
        $stmt = $conn->prepare("SELECT current_round, winner_id FROM game_rooms WHERE id = ?");
        $stmt->bind_param("i", $room_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $room = $result->fetch_assoc();
        
        error_log("ALREADY INCREMENTED: current_round=" . $room['current_round'] . ", winner_id=" . ($room['winner_id'] ?? 'NULL'));
        
        echo json_encode([
            'success' => true,
            'message' => 'Round already incremented by other player',
            'new_round' => $room['current_round'],
            'was_first' => false
        ]);
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

// Get player money
function getPlayerMoney($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    // Get room and determine player number
    $stmt = $conn->prepare("SELECT creator_id, player1_money, player2_money FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена або немає доступу');
    }
    
    // Determine which player's money to return
    $money = ($room['creator_id'] == $user_id) ? $room['player1_money'] : $room['player2_money'];
    
    echo json_encode([
        'success' => true,
        'money' => $money ?? 0
    ]);
}

// Save player money
function savePlayerMoney($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    $money = $data['money'] ?? 0;
    
    // Get room and determine player number
    $stmt = $conn->prepare("SELECT creator_id FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена або немає доступу');
    }
    
    // Determine which player field to update
    $money_field = ($room['creator_id'] == $user_id) ? 'player1_money' : 'player2_money';
    
    // Update player money
    $stmt = $conn->prepare("UPDATE game_rooms SET $money_field = ? WHERE id = ?");
    $stmt->bind_param("ii", $money, $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Гроші збережено успішно',
            'money' => $money
        ]);
    } else {
        throw new Exception('Помилка збереження грошей');
    }
}

// Get player unit limit
function getPlayerUnitLimit($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    // Get room and determine player number
    $stmt = $conn->prepare("SELECT creator_id, player1_unit_limit, player2_unit_limit FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена або немає доступу');
    }
    
    // Determine which player's unit limit to return
    $unit_limit = ($room['creator_id'] == $user_id) ? $room['player1_unit_limit'] : $room['player2_unit_limit'];
    
    echo json_encode([
        'success' => true,
        'unit_limit' => $unit_limit ?? 0
    ]);
}

// Save player unit limit
function savePlayerUnitLimit($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    $unit_limit = $data['unit_limit'] ?? 0;
    
    // Get room and determine player number
    $stmt = $conn->prepare("SELECT creator_id FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена або немає доступу');
    }
    
    // Determine which player field to update
    $limit_field = ($room['creator_id'] == $user_id) ? 'player1_unit_limit' : 'player2_unit_limit';
    
    // Update player unit limit
    $stmt = $conn->prepare("UPDATE game_rooms SET $limit_field = ? WHERE id = ?");
    $stmt->bind_param("ii", $unit_limit, $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Ліміт юнітів збережено успішно',
            'unit_limit' => $unit_limit
        ]);
    } else {
        throw new Exception('Помилка збереження ліміту юнітів');
    }
}

// Get max unit limit
function getMaxUnitLimit($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    // Get room max unit limit
    $stmt = $conn->prepare("SELECT max_unit_limit FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена або немає доступу');
    }
    
    echo json_encode([
        'success' => true,
        'max_unit_limit' => $room['max_unit_limit'] ?? 0
    ]);
}

// Save max unit limit (only creator can set this)
function saveMaxUnitLimit($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    $max_unit_limit = $data['max_unit_limit'] ?? 0;
    
    // Verify that user is the room creator
    $stmt = $conn->prepare("SELECT creator_id FROM game_rooms WHERE id = ? AND creator_id = ?");
    $stmt->bind_param("ii", $room_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Тільки створювач кімнати може встановлювати максимальний ліміт юнітів');
    }
    
    // Update max unit limit
    $stmt = $conn->prepare("UPDATE game_rooms SET max_unit_limit = ? WHERE id = ?");
    $stmt->bind_param("ii", $max_unit_limit, $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Максимальний ліміт юнітів збережено успішно',
            'max_unit_limit' => $max_unit_limit
        ]);
    } else {
        throw new Exception('Помилка збереження максимального ліміту юнітів');
    }
}

// Get round income
function getRoundIncome($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    // Get room round income
    $stmt = $conn->prepare("SELECT round_income FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена або немає доступу');
    }
    
    echo json_encode([
        'success' => true,
        'round_income' => $room['round_income'] ?? 0
    ]);
}

// ========== NEW LOBBY FUNCTIONS ==========

// Update room settings (only host can update)
function updateRoomSettings($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    error_log("updateRoomSettings called: user_id=$user_id, room_id=$room_id, data=" . json_encode($data));
    
    // Check if user is the host
    $stmt = $conn->prepare("SELECT * FROM game_rooms WHERE id = ? AND creator_id = ?");
    $stmt->bind_param("ii", $room_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        error_log("updateRoomSettings failed: User $user_id is not host of room $room_id");
        throw new Exception('Тільки хост може змінювати налаштування');
    }
    
    // Check if game already started
    if ($room['game_status'] === 'in_progress' || $room['game_status'] === 'finished') {
        throw new Exception('Не можна змінювати налаштування після запуску гри');
    }
    
    // Update settings
    $game_mode = $data['game_mode'] ?? $room['game_mode'];
    $round_time = $data['round_time'] ?? $room['round_time'];
    $starting_money = $data['starting_money'] ?? $room['player1_money'];
    $round_income = $data['round_income'] ?? $room['round_income'];
    $max_unit_limit = $data['max_unit_limit'] ?? $room['max_unit_limit'];
    
    error_log("updateRoomSettings values: game_mode=$game_mode, round_time=$round_time, starting_money=$starting_money, round_income=$round_income, max_unit_limit=$max_unit_limit");
    
    $stmt = $conn->prepare("UPDATE game_rooms SET game_mode = ?, round_time = ?, player1_money = ?, player2_money = ?, round_income = ?, max_unit_limit = ? WHERE id = ?");
    $stmt->bind_param("siiiiii", $game_mode, $round_time, $starting_money, $starting_money, $round_income, $max_unit_limit, $room_id);
    
    if ($stmt->execute()) {
        error_log("updateRoomSettings success: Room $room_id updated");
        echo json_encode([
            'success' => true,
            'message' => 'Налаштування оновлено'
        ]);
    } else {
        error_log("updateRoomSettings SQL error: " . $stmt->error);
        throw new Exception('Помилка оновлення налаштувань');
    }
}

// Select race for player
function selectRace($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    $race = $data['race'] ?? null;
    
    // Get room and determine player role
    $stmt = $conn->prepare("SELECT * FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена');
    }
    
    // Check if game already started
    if ($room['game_status'] === 'in_progress' || $room['game_status'] === 'finished') {
        throw new Exception('Не можна змінювати расу після запуску гри');
    }
    
    // Check if game mode allows race selection
    if ($room['game_mode'] === 'all_races') {
        throw new Exception('В режимі "Всі раси" вибір раси недоступний');
    }
    
    // Determine which player field to update
    $race_field = ($room['creator_id'] == $user_id) ? 'player1_race' : 'player2_race';
    
    // Update race
    $stmt = $conn->prepare("UPDATE game_rooms SET $race_field = ? WHERE id = ?");
    $stmt->bind_param("si", $race, $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Расу обрано'
        ]);
    } else {
        throw new Exception('Помилка вибору раси');
    }
}

// Toggle ready status in lobby
function toggleReadyLobby($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    $ready = $data['ready'] ?? false;
    
    // Get room and determine player role
    $stmt = $conn->prepare("SELECT * FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена');
    }
    
    // Check if game already started
    if ($room['game_status'] === 'in_progress' || $room['game_status'] === 'finished') {
        throw new Exception('Гра вже запущена');
    }
    
    // Check race selection if classic mode
    if ($room['game_mode'] === 'classic') {
        $race_field = ($room['creator_id'] == $user_id) ? 'player1_race' : 'player2_race';
        if (empty($room[$race_field]) && $ready) {
            throw new Exception('Спочатку оберіть расу');
        }
    }
    
    // Determine which ready field to update
    $ready_field = ($room['creator_id'] == $user_id) ? 'host_ready' : 'guest_ready';
    $ready_value = $ready ? 1 : 0;
    
    // Update ready status
    $stmt = $conn->prepare("UPDATE game_rooms SET $ready_field = ? WHERE id = ?");
    $stmt->bind_param("ii", $ready_value, $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'ready' => $ready
        ]);
    } else {
        throw new Exception('Помилка зміни статусу готовності');
    }
}

// Start game from lobby (only host)
function startGameFromLobby($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    // Check if user is the host
    $stmt = $conn->prepare("SELECT * FROM game_rooms WHERE id = ? AND creator_id = ?");
    $stmt->bind_param("ii", $room_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Тільки хост може запустити гру');
    }
    
    // Check if both players are ready
    if ($room['host_ready'] != 1 || $room['guest_ready'] != 1) {
        throw new Exception('Обидва гравці повинні бути готові');
    }
    
    // Check if second player joined
    if (!$room['second_player_id']) {
        throw new Exception('Очікується другий гравець');
    }
    
    // Change status to 'in_progress'
    $stmt = $conn->prepare("UPDATE game_rooms SET game_status = 'in_progress' WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Гру запущено'
        ]);
    } else {
        throw new Exception('Помилка запуску гри');
    }
}

// Get lobby state (for polling)
function getLobbyState($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    // Get full room info with player usernames
    $stmt = $conn->prepare("
        SELECT 
            gr.*,
            u1.username as host_username,
            u2.username as guest_username
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
        throw new Exception('Кімната не знайдена');
    }
    
    // Build response
    $response = [
        'success' => true,
        'game_status' => $room['game_status'],
        'current_round' => $room['current_round'],
        'winner_id' => $room['winner_id'],
        'players' => [
            'host' => [
                'id' => $room['creator_id'],
                'username' => $room['host_username'],
                'ready' => (bool)$room['host_ready'],
                'race' => $room['player1_race']
            ],
            'guest' => $room['second_player_id'] ? [
                'id' => $room['second_player_id'],
                'username' => $room['guest_username'],
                'ready' => (bool)$room['guest_ready'],
                'race' => $room['player2_race']
            ] : null
        ],
        'settings' => [
            'game_mode' => $room['game_mode'],
            'room_type' => $room['room_type'],
            'round_time' => $room['round_time'],
            'starting_money' => $room['player1_money'],
            'round_income' => $room['round_income'],
            'max_unit_limit' => $room['max_unit_limit']
        ]
    ];
    
    echo json_encode($response);
}

// Leave room
function leaveRoom($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    // Get room
    $stmt = $conn->prepare("SELECT * FROM game_rooms WHERE id = ? AND (creator_id = ? OR second_player_id = ?)");
    $stmt->bind_param("iii", $room_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена');
    }
    
    // If user is host, delete the room
    if ($room['creator_id'] == $user_id) {
        $stmt = $conn->prepare("DELETE FROM game_rooms WHERE id = ?");
        $stmt->bind_param("i", $room_id);
        $stmt->execute();
        
        echo json_encode([
            'success' => true,
            'message' => 'Кімнату видалено'
        ]);
    } else {
        // If user is guest, just remove them from room
        $stmt = $conn->prepare("UPDATE game_rooms SET second_player_id = NULL, guest_ready = 0, player2_race = NULL WHERE id = ?");
        $stmt->bind_param("i", $room_id);
        $stmt->execute();
        
        echo json_encode([
            'success' => true,
            'message' => 'Ви покинули кімнату'
        ]);
    }
}

// Battle state management functions

// Set battle state (mark player as in battle)
function setBattleState($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    $in_battle = $data['in_battle'] ?? false;
    
    // Get room info
    $stmt = $conn->prepare("SELECT creator_id, second_player_id FROM game_rooms WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена');
    }
    
    // Determine which player field to update
    if ($room['creator_id'] == $user_id) {
        $field = 'player1_in_battle';
    } else if ($room['second_player_id'] == $user_id) {
        $field = 'player2_in_battle';
    } else {
        throw new Exception('Ви не є учасником цієї кімнати');
    }
    
    // Update battle state
    $stmt = $conn->prepare("UPDATE game_rooms SET $field = ?, battle_started = 1 WHERE id = ?");
    $in_battle_int = $in_battle ? 1 : 0;
    $stmt->bind_param("ii", $in_battle_int, $room_id);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'in_battle' => $in_battle
    ]);
}

// Get battle state
function getBattleState($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    $stmt = $conn->prepare("
        SELECT 
            battle_started,
            player1_in_battle,
            player2_in_battle,
            winner_id,
            creator_id,
            second_player_id,
            current_round
        FROM game_rooms 
        WHERE id = ?
    ");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена');
    }
    
    // Check if current user is in battle
    $is_current_user_in_battle = false;
    if ($room['creator_id'] == $user_id) {
        $is_current_user_in_battle = (bool)$room['player1_in_battle'];
    } else if ($room['second_player_id'] == $user_id) {
        $is_current_user_in_battle = (bool)$room['player2_in_battle'];
    }
    
    echo json_encode([
        'success' => true,
        'battle_started' => (bool)$room['battle_started'],
        'player1_in_battle' => (bool)$room['player1_in_battle'],
        'player2_in_battle' => (bool)$room['player2_in_battle'],
        'is_current_user_in_battle' => $is_current_user_in_battle,
        'winner_id' => $room['winner_id'], // Using existing winner_id field
        'current_round' => $room['current_round']
    ]);
}

// Check if battle is completed (called by waiting player)
function checkBattleCompletion($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $room_id = $data['room_id'] ?? 0;
    
    $stmt = $conn->prepare("
        SELECT 
            battle_started,
            player1_in_battle,
            player2_in_battle,
            winner_id,
            current_round
        FROM game_rooms 
        WHERE id = ?
    ");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена');
    }
    
    // Battle is completed when:
    // 1. Battle was started (or just finished) AND both players are not in battle
    // 2. OR battle_started is 0 (meaning it was completed and reset by incrementRound)
    $battle_completed = (!$room['player1_in_battle'] && !$room['player2_in_battle']) ||
                       (!$room['battle_started'] && $room['winner_id'] !== null);
    
    echo json_encode([
        'success' => true,
        'battle_completed' => $battle_completed,
        'winner_id' => $room['winner_id'], // Using existing winner_id field
        'current_round' => $room['current_round']
    ]);
}

// Clear winner after modal is shown to prevent re-showing on reload
function clearWinner($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $room_id = $data['room_id'] ?? 0;
    
    // Clear winner_id to prevent modal re-showing on reload
    $stmt = $conn->prepare("UPDATE game_rooms SET winner_id = NULL WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Winner cleared'
        ]);
    } else {
        throw new Exception('Помилка очищення переможця');
    }
}

// Heartbeat - оновлює last_active timestamp гравця
function heartbeat($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $user_id = $_SESSION['user_id'];
    $room_id = $data['room_id'] ?? 0;
    
    // Get room info
    $stmt = $conn->prepare("SELECT creator_id, second_player_id FROM game_rooms WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена');
    }
    
    // Determine which player field to update
    if ($room['creator_id'] == $user_id) {
        $field = 'player1_last_active';
    } else if ($room['second_player_id'] == $user_id) {
        $field = 'player2_last_active';
    } else {
        throw new Exception('Ви не є учасником цієї кімнати');
    }
    
    // Update last_active timestamp
    $stmt = $conn->prepare("UPDATE game_rooms SET $field = NOW() WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}

// Перевірка чи гравці онлайн (вважається онлайн якщо last_active < 15 секунд тому)
function checkPlayersOnline($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $room_id = $data['room_id'] ?? 0;
    
    $stmt = $conn->prepare("
        SELECT 
            creator_id,
            second_player_id,
            player1_last_active,
            player2_last_active,
            TIMESTAMPDIFF(SECOND, player1_last_active, NOW()) as player1_seconds_ago,
            TIMESTAMPDIFF(SECOND, player2_last_active, NOW()) as player2_seconds_ago
        FROM game_rooms 
        WHERE id = ?
    ");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена');
    }
    
    // Гравець вважається онлайн якщо last_active був менше 15 секунд тому
    $timeout_seconds = 15;
    
    $player1_online = ($room['player1_last_active'] !== null && $room['player1_seconds_ago'] !== null && $room['player1_seconds_ago'] < $timeout_seconds);
    $player2_online = ($room['player2_last_active'] !== null && $room['player2_seconds_ago'] !== null && $room['player2_seconds_ago'] < $timeout_seconds);
    
    echo json_encode([
        'success' => true,
        'player1_online' => $player1_online,
        'player2_online' => $player2_online,
        'player1_last_active' => $room['player1_last_active'],
        'player2_last_active' => $room['player2_last_active'],
        'timeout_seconds' => $timeout_seconds
    ]);
}

// Детекція deadlock - коли обидва гравці офлайн під час бою
function detectBattleDeadlock($data) {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Користувач не авторизований');
    }
    
    $room_id = $data['room_id'] ?? 0;
    
    $stmt = $conn->prepare("
        SELECT 
            battle_started,
            player1_in_battle,
            player2_in_battle,
            player1_last_active,
            player2_last_active,
            TIMESTAMPDIFF(SECOND, player1_last_active, NOW()) as player1_seconds_ago,
            TIMESTAMPDIFF(SECOND, player2_last_active, NOW()) as player2_seconds_ago
        FROM game_rooms 
        WHERE id = ?
    ");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        throw new Exception('Кімната не знайдена');
    }
    
    // Deadlock якщо:
    // 1. Бій стартував (battle_started = 1)
    // 2. Обидва гравці НЕ в бою (in_battle = 0)
    // 3. Обидва офлайн більше 15 секунд
    
    $timeout_seconds = 15;
    $player1_online = ($room['player1_last_active'] !== null && $room['player1_seconds_ago'] !== null && $room['player1_seconds_ago'] < $timeout_seconds);
    $player2_online = ($room['player2_last_active'] !== null && $room['player2_seconds_ago'] !== null && $room['player2_seconds_ago'] < $timeout_seconds);
    
    $is_deadlock = (
        $room['battle_started'] == 1 &&
        $room['player1_in_battle'] == 0 &&
        $room['player2_in_battle'] == 0 &&
        !$player1_online &&
        !$player2_online
    );
    
    echo json_encode([
        'success' => true,
        'is_deadlock' => $is_deadlock,
        'battle_started' => (bool)$room['battle_started'],
        'player1_in_battle' => (bool)$room['player1_in_battle'],
        'player2_in_battle' => (bool)$room['player2_in_battle'],
        'player1_online' => $player1_online,
        'player2_online' => $player2_online
    ]);
}




