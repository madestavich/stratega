<?php
session_start();
header('Content-Type: application/json');

// Include database configuration
require_once './config.php';

try {
    $pdo = new PDO("mysql:host={$db_config['host']};dbname={$db_config['dbname']}", $db_config['username'], $db_config['password']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die(json_encode([
        'success' => false,
        'message' => 'Database connection failed: ' . $e->getMessage()
    ]));
}

// Check if the request is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid request method'
    ]);
    exit;
}

// Get login credentials
$login = trim($_POST['login'] ?? '');
$password = $_POST['password'] ?? '';

// Validate input
$errors = [];

if (empty($login)) {
    $errors['login'] = 'Логін або email обов\'язковий';
}

if (empty($password)) {
    $errors['password'] = 'Пароль обов\'язковий';
}

if (!empty($errors)) {
    echo json_encode([
        'success' => false,
        'errors' => $errors
    ]);
    exit;
}

// Check if login is email or username
$isEmail = filter_var($login, FILTER_VALIDATE_EMAIL);
$field = $isEmail ? 'email' : 'username';

// Query to find the user
$stmt = $pdo->prepare("SELECT * FROM users WHERE $field = :login LIMIT 1");
$stmt->execute(['login' => $login]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

// Verify user exists and password is correct
if (!$user || !password_verify($password, $user['password'])) {
    echo json_encode([
        'success' => false,
        'message' => 'Невірний логін або пароль'
    ]);
    exit;
}

// Set session variables
$_SESSION['user_id'] = $user['id'];
$_SESSION['username'] = $user['username'];
$_SESSION['email'] = $user['email'];
$_SESSION['logged_in'] = true;

// Return success response
echo json_encode([
    'success' => true,
    'message' => 'Авторизація успішна',
    'user' => [
        'username' => $user['username'],
        'email' => $user['email']
    ]
]);
exit;
?>
