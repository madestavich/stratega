<?php
// Include database configuration
require_once '../config.php';

// Set response header to JSON
header('Content-Type: application/json');

// Initialize response array
$response = [
    'success' => false,
    'message' => '',
    'errors' => []
];

// Check if the request method is POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get form data
    $email = filter_input(INPUT_POST, 'email', FILTER_SANITIZE_EMAIL);
    $username = filter_input(INPUT_POST, 'username', FILTER_SANITIZE_STRING);
    $password = $_POST['password'] ?? '';
    
    // Validate email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $response['errors']['email'] = 'Некоректна електронна пошта';
    }
    
    // Validate username
    if (strlen($username) < 3) {
        $response['errors']['username'] = 'Нікнейм повинен містити щонайменше 3 символи';
    }
    
    // Validate password
    if (strlen($password) < 6) {
        $response['errors']['password'] = 'Пароль повинен містити щонайменше 6 символів';
    }
    
    // If no validation errors, proceed with registration
    if (empty($response['errors'])) {
        try {
            // Create database connection
            $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
            
            // Check connection
            if ($conn->connect_error) {
                throw new Exception("Connection failed: " . $conn->connect_error);
            }
            
            // Check if email already exists
            $stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->bind_param("s", $email);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows > 0) {
                $response['errors']['email'] = 'Ця електронна пошта вже зареєстрована';
                echo json_encode($response);
                exit;
            }
            
            // Check if username already exists
            $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
            $stmt->bind_param("s", $username);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows > 0) {
                $response['errors']['username'] = 'Цей нікнейм вже зайнятий';
                echo json_encode($response);
                exit;
            }
            
            // Hash password
            $hashed_password = password_hash($password, PASSWORD_DEFAULT);
            
            // Insert new user
            $stmt = $conn->prepare("INSERT INTO users (email, username, password, created_at) VALUES (?, ?, ?, NOW())");
            $stmt->bind_param("sss", $email, $username, $hashed_password);
            
            if ($stmt->execute()) {
                $response['success'] = true;
                $response['message'] = 'Реєстрація успішна';
            } else {
                throw new Exception("Error: " . $stmt->error);
            }
            
            // Close connection
            $stmt->close();
            $conn->close();
            
        } catch (Exception $e) {
            $response['message'] = 'Помилка сервера: ' . $e->getMessage();
        }
    }
}

// Return JSON response
echo json_encode($response);