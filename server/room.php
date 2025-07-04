<?php
// Enable error reporting for development
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Database connection
require_once 'db_connect.php';

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Check if user is logged in
function isLoggedIn() {
    return isset($_SESSION['user_id']);
}

// Get current user ID
function getCurrentUserId() {
    return $_SESSION['user_id'] ?? null;
}

// Handle different room operations based on the action parameter
$action = $_POST['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'create':
        createRoom();
        break;
    case 'join':
        joinRoom();
        break;
    case 'list':
        listRooms();
        break;
    case 'update':
        updateRoomState();
        break;
    case 'get':
        getRoomDetails();
        break;
    case 'check_can_create':
        checkCanCreateRoom();
        break;
    case 'complete_game':
        completeGame();
        break;
    default:
        echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
        break;
}

/**
 * Check if a user can create a new room
 */
function checkCanCreateRoom() {
    global $conn;
    
    // Check if user is logged in
    if (!isLoggedIn()) {
        echo json_encode(['status' => 'error', 'message' => 'User not logged in', 'can_create' => false]);
        return;
    }
    
    $userId = getCurrentUserId();
    
    try {
        // Check if user already has an active room
        $stmt = $conn->prepare("
            SELECT COUNT(*) as active_rooms 
            FROM game_rooms 
            WHERE creator_id = ? AND game_status IN ('preparing', 'in_progress')
        ");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        
        $canCreate = ($row['active_rooms'] == 0);
        
        echo json_encode([
            'status' => 'success',
            'can_create' => $canCreate
        ]);
        
        $stmt->close();
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage(), 'can_create' => false]);
    }
}

/**
 * Create a new game room
 */
function createRoom() {
    global $conn;
    
    // Check if user is logged in
    if (!isLoggedIn()) {
        echo json_encode(['status' => 'error', 'message' => 'User not logged in']);
        return;
    }
    
    // Get parameters from request
    $userId = getCurrentUserId();
    $roomType = $_POST['room_type'] ?? 'open'; // 'open' or 'closed'
    $password = null;
    
    // Check if user already has an active room
    $stmt = $conn->prepare("
        SELECT COUNT(*) as active_rooms 
        FROM game_rooms 
        WHERE creator_id = ? AND game_status IN ('preparing', 'in_progress')
    ");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    
    if ($row['active_rooms'] > 0) {
        echo json_encode(['status' => 'error', 'message' => 'You already have an active game room']);
        $stmt->close();
        return;
    }
    $stmt->close();
    
    // If room is closed, get password
    if ($roomType === 'closed') {
        $password = $_POST['password'] ?? '';
        if (empty($password)) {
            echo json_encode(['status' => 'error', 'message' => 'Password required for closed rooms']);
            return;
        }
        // Hash the password for security
        $password = password_hash($password, PASSWORD_DEFAULT);
    }
    
    // Initial game state - empty JSON object
    $gameState = json_encode([
        'players' => [
            [
                'id' => $userId,
                'money' => 1000, // Starting money
                'objects' => [] // No objects initially
            ],
            [
                'id' => null, // Second player not joined yet
                'money' => 1000,
                'objects' => []
            ]
        ],
        'currentRound' => 0
    ]);
    
    try {
        // Prepare SQL statement
        $stmt = $conn->prepare("
            INSERT INTO game_rooms 
            (creator_id, second_player_id, created_at, current_round, room_type, password, game_state, game_status) 
            VALUES (?, NULL, NOW(), 0, ?, ?, ?, 'preparing')
        ");
        
        $stmt->bind_param("isss", $userId, $roomType, $password, $gameState);
        $stmt->execute();
        
        if ($stmt->affected_rows > 0) {
            $roomId = $conn->insert_id;
            echo json_encode([
                'status' => 'success', 
                'message' => 'Room created successfully',
                'room_id' => $roomId
            ]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Failed to create room']);
        }
        
        $stmt->close();
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
    }
}

/**
 * Join an existing game room
 */
function joinRoom() {
    global $conn;
    
    // Check if user is logged in
    if (!isLoggedIn()) {
        echo json_encode(['status' => 'error', 'message' => 'User not logged in']);
        return;
    }
    
    $userId = getCurrentUserId();
    $roomId = $_POST['room_id'] ?? 0;
    $password = $_POST['password'] ?? '';
    
    if (!$roomId) {
        echo json_encode(['status' => 'error', 'message' => 'Room ID is required']);
        return;
    }
    
    try {
        // Get room details
        $stmt = $conn->prepare("SELECT * FROM game_rooms WHERE id = ?");
        $stmt->bind_param("i", $roomId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            echo json_encode(['status' => 'error', 'message' => 'Room not found']);
            return;
        }
        
        $room = $result->fetch_assoc();
        
        // Check if room is in a joinable state
        if ($room['game_status'] !== 'preparing') {
            echo json_encode(['status' => 'error', 'message' => 'This room is not accepting new players']);
            return;
        }
        
        // Check if room is already full
        if ($room['second_player_id'] !== null) {
            echo json_encode(['status' => 'error', 'message' => 'Room is already full']);
            return;
        }
        
        // Check if user is trying to join their own room
        if ($room['creator_id'] == $userId) {
            echo json_encode(['status' => 'error', 'message' => 'Cannot join your own room']);
            return;
        }
        
        // Check password for closed rooms
        if ($room['room_type'] === 'closed') {
            if (empty($password) || !password_verify($password, $room['password'])) {
                echo json_encode(['status' => 'error', 'message' => 'Invalid password']);
                return;
            }
        }
        
        // Update room with second player and change status to in_progress
        $updateStmt = $conn->prepare("
            UPDATE game_rooms 
            SET second_player_id = ?, game_status = 'in_progress' 
            WHERE id = ?
        ");
        $updateStmt->bind_param("ii", $userId, $roomId);
        $updateStmt->execute();
        
        if ($updateStmt->affected_rows > 0) {
            // Update game state to include second player
            $gameState = json_decode($room['game_state'], true);
            $gameState['players'][1]['id'] = $userId;
            
            $gameStateJson = json_encode($gameState);
            
            $stateStmt = $conn->prepare("UPDATE game_rooms SET game_state = ? WHERE id = ?");
            $stateStmt->bind_param("si", $gameStateJson, $roomId);
            $stateStmt->execute();
            $stateStmt->close();
            
            echo json_encode([
                'status' => 'success', 
                'message' => 'Joined room successfully',
                'room_id' => $roomId
            ]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Failed to join room']);
        }
        
        $updateStmt->close();
        $stmt->close();
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
    }
}

/**
 * List available game rooms
 */
function listRooms() {
    global $conn;
    
    try {
        // Get all rooms, prioritizing active ones
        $query = "
            SELECT r.id, r.creator_id, r.second_player_id, r.created_at, 
                   r.current_round, r.room_type, r.game_status,
                   u1.username as creator_name, u2.username as second_player_name
            FROM game_rooms r
            LEFT JOIN users u1 ON r.creator_id = u1.id
            LEFT JOIN users u2 ON r.second_player_id = u2.id
            ORDER BY 
                CASE 
                    WHEN r.game_status = 'preparing' THEN 1
                    WHEN r.game_status = 'in_progress' THEN 2
                    ELSE 3
                END,
                r.created_at DESC
            LIMIT 20
        ";
        
        $result = $conn->query($query);
        
        $rooms = [];
        while ($row = $result->fetch_assoc()) {
            // Don't send password or full game state to client
            unset($row['password']);
            unset($row['game_state']);
            
            // Add status field
            $row['status'] = $row['game_status'];
            
            $rooms[] = $row;
        }
        
        echo json_encode([
            'status' => 'success',
            'rooms' => $rooms
        ]);
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
    }
}

/**
 * Update game state for a room
 */
function updateRoomState() {
    global $conn;
    
    // Check if user is logged in
    if (!isLoggedIn()) {
        echo json_encode(['status' => 'error', 'message' => 'User not logged in']);
        return;
    }
    
    $userId = getCurrentUserId();
    $roomId = $_POST['room_id'] ?? 0;
    $gameState = $_POST['game_state'] ?? '';
    $currentRound = $_POST['current_round'] ?? 0;
    
    if (!$roomId || empty($gameState)) {
        echo json_encode(['status' => 'error', 'message' => 'Room ID and game state are required']);
        return;
    }
    
    try {
        // Check if user is part of this room
        $stmt = $conn->prepare("
            SELECT * FROM game_rooms 
            WHERE id = ? AND (creator_id = ? OR second_player_id = ?)
        ");
        $stmt->bind_param("iii", $roomId, $userId, $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            echo json_encode(['status' => 'error', 'message' => 'Not authorized to update this room']);
            return;
        }
        
        $room = $result->fetch_assoc();
        
        // Check if game is still active
        if ($room['game_status'] === 'completed') {
            echo json_encode(['status' => 'error', 'message' => 'Game is already completed']);
            return;
        }
        
        // Update game state
        $updateStmt = $conn->prepare("
            UPDATE game_rooms 
            SET game_state = ?, current_round = ? 
            WHERE id = ?
        ");
        $updateStmt->bind_param("sii", $gameState, $currentRound, $roomId);
        $updateStmt->execute();
        
        if ($updateStmt->affected_rows > 0) {
            echo json_encode([
                'status' => 'success', 
                'message' => 'Game state updated successfully'
            ]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'No changes made to game state']);
        }
        
        $updateStmt->close();
        $stmt->close();
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
    }
}

/**
 * Mark a game as completed
 */
function completeGame() {
    global $conn;
    
    // Check if user is logged in
    if (!isLoggedIn()) {
        echo json_encode(['status' => 'error', 'message' => 'User not logged in']);
        return;
    }
    
    $userId = getCurrentUserId();
    $roomId = $_POST['room_id'] ?? 0;
    $winnerId = $_POST['winner_id'] ?? null;
    
    if (!$roomId) {
        echo json_encode(['status' => 'error', 'message' => 'Room ID is required']);
        return;
    }
    
    try {
        // Check if user is part of this room
        $stmt = $conn->prepare("
            SELECT * FROM game_rooms 
            WHERE id = ? AND (creator_id = ? OR second_player_id = ?)
        ");
        $stmt->bind_param("iii", $roomId, $userId, $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            echo json_encode(['status' => 'error', 'message' => 'Not authorized to complete this game']);
            return;
        }
        
        $room = $result->fetch_assoc();
        
        // Check if game is still active
        if ($room['game_status'] === 'completed') {
            echo json_encode(['status' => 'error', 'message' => 'Game is already completed']);
            return;
        }
        
        // Update game status to completed
        $updateStmt = $conn->prepare("
            UPDATE game_rooms 
            SET game_status = 'completed', winner_id = ? 
            WHERE id = ?
        ");
        $updateStmt->bind_param("ii", $winnerId, $roomId);
        $updateStmt->execute();
        
        if ($updateStmt->affected_rows > 0) {
            echo json_encode([
                'status' => 'success', 
                'message' => 'Game marked as completed'
            ]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Failed to complete game']);
        }
        
        $updateStmt->close();
        $stmt->close();
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
    }
}

/**
 * Get details for a specific room
 */
function getRoomDetails() {
    global $conn;
    
    $roomId = $_GET['room_id'] ?? 0;
    
    if (!$roomId) {
        echo json_encode(['status' => 'error', 'message' => 'Room ID is required']);
        return;
    }
    
    try {
        $stmt = $conn->prepare("
            SELECT r.id, r.creator_id, r.second_player_id, r.created_at, 
                   r.current_round, r.room_type, r.game_state, r.game_status, r.winner_id,
                   u1.username as creator_name, u2.username as second_player_name,
                   u3.username as winner_name
            FROM game_rooms r
            LEFT JOIN users u1 ON r.creator_id = u1.id
            LEFT JOIN users u2 ON r.second_player_id = u2.id
            LEFT JOIN users u3 ON r.winner_id = u3.id
            WHERE r.id = ?
        ");
        $stmt->bind_param("i", $roomId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            echo json_encode(['status' => 'error', 'message' => 'Room not found']);
            return;
        }
        
        $room = $result->fetch_assoc();
        
        // Don't send password to client
        unset($room['password']);
        
        // Add status field
        $room['status'] = $room['game_status'];
        
        echo json_encode([
            'status' => 'success',
            'room' => $room
        ]);
        
        $stmt->close();
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
    }
}
?>
