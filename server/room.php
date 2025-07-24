<?php
session_start();
require_once 'auth/config.php';

// Database connection
try {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    $conn->set_charset("utf8");
    
    // Create game_rooms table if it doesn't exist
    $createTableSQL = "
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
    )";
    $conn->query($createTableSQL);
    
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
    
    $stmt = $conn->prepare("INSERT INTO game_rooms (creator_id, room_type, password, game_status, created_at, current_round, player1_ready, player2_ready) VALUES (?, ?, ?, 'waiting', NOW(), 0, 0, 0)");
    $stmt->bind_param("iss", $creator_id, $room_type, $password);
    
    if ($stmt->execute()) {
        $room_id = $conn->insert_id;
        echo json_encode([
            'success' => true,
            'room_id' => $room_id,
            'message' => 'Кімнату створено успішно'
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
            'message' => 'Успішно приєдналися до кімнати'
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
?>
