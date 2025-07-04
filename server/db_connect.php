<?php
// Include the config file from auth folder
require_once './auth/config.php';

// Create connection using credentials from config.php
// Using the constants defined in config.php
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Set charset to utf8mb4
$conn->set_charset("utf8mb4");
?>
