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
    default:
        echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
        break;
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
            (creator_id, second_player_id, created_at, current_round, room_type, password, game_state) 
            VALUES (?, NULL, NOW(), 0, ?, ?, ?)
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
        
        // Update room with second player
        $updateStmt = $conn->prepare("UPDATE game_rooms SET second_player_id = ? WHERE id = ?");
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
        // Get all rooms that are not full
        $query = "
            SELECT r.id, r.creator_id, r.second_player_id, r.created_at, 
                   r.current_round, r.room_type, 
                   u1.username as creator_name, u2.username as second_player_name
            FROM game_rooms r
            LEFT JOIN users u1 ON r.creator_id = u1.id
            LEFT JOIN users u2 ON r.second_player_id = u2.id
            ORDER BY r.created_at DESC
        ";
        
        $result = $conn->query($query);
        
        $rooms = [];
        while ($row = $result->fetch_assoc()) {
            // Don't send password or full game state to client
            unset($row['password']);
            unset($row['game_state']);
            
            // Add status field
            $row['status'] = $row['second_player_id'] ? 'in_progress' : 'preparing';
            
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
                   r.current_round, r.room_type, r.game_state,
                   u1.username as creator_name, u2.username as second_player_name
            FROM game_rooms r
            LEFT JOIN users u1 ON r.creator_id = u1.id
            LEFT JOIN users u2 ON r.second_player_id = u2.id
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
        $room['status'] = $room['second_player_id'] ? 'in_progress' : 'preparing';
        
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
