<?php
// Database configuration
define('DB_HOST', 'localhost');
define('DB_USER', 'herostri_admin');
define('DB_PASS', 'Peder1488!');
define('DB_NAME', 'herostri_users');

// Set error reporting for development
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Set timezone
date_default_timezone_set('Europe/Kiev');

// Session configuration
session_start();
