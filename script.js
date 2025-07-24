document.addEventListener("DOMContentLoaded", function () {
  // Modal elements
  const registerModal = document.getElementById("registerModal");
  const loginModal = document.getElementById("loginModal");
  const registerBtn = document.getElementById("register-btn");
  const loginBtn = document.getElementById("login-btn");
  const createRoomBtn = document.getElementById("create-room-btn");
  const closeButtons = document.querySelectorAll(".close-button");
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");

  // Form fields - Register
  const emailInput = document.getElementById("email");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirm-password");

  // Form fields - Login
  const loginInput = document.getElementById("login");
  const loginPasswordInput = document.getElementById("login-password");

  // Error messages - Register
  const emailError = document.getElementById("email-error");
  const usernameError = document.getElementById("username-error");
  const passwordError = document.getElementById("password-error");
  const confirmPasswordError = document.getElementById(
    "confirm-password-error"
  );

  // Error messages - Login
  const loginError = document.getElementById("login-error");
  const loginPasswordError = document.getElementById("login-password-error");

  let mouseDownTarget = null;

  // Check if user is logged in
  checkLoginStatus();

  // Open register modal when register button is clicked
  registerBtn.addEventListener("click", function () {
    registerModal.style.display = "flex";
  });

  // Open login modal when login button is clicked
  loginBtn.addEventListener("click", function () {
    if (loginBtn.textContent === "Вихід") {
      // Handle logout
      logout();
    } else {
      loginModal.style.display = "flex";
    }
  });

  // Close modals when close button is clicked
  closeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      registerModal.style.display = "none";
      loginModal.style.display = "none";
      resetRegisterForm();
      resetLoginForm();
    });
  });

  // Track where the mouse down event occurs
  window.addEventListener("mousedown", function (event) {
    mouseDownTarget = event.target;
  });

  // Only close if both mousedown and mouseup happened on the modal background
  window.addEventListener("mouseup", function (event) {
    if (event.target === registerModal && mouseDownTarget === registerModal) {
      registerModal.style.display = "none";
      resetRegisterForm();
    }
    if (event.target === loginModal && mouseDownTarget === loginModal) {
      loginModal.style.display = "none";
      resetLoginForm();
    }
    mouseDownTarget = null;
  });

  // Register form submission
  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();

    // Reset error messages
    resetRegisterErrors();

    // Get form values
    const email = emailInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    // Validate form
    let isValid = true;

    // Email validation
    if (!isValidEmail(email)) {
      showError(emailError, "Будь ласка, введіть коректну електронну пошту");
      isValid = false;
    }

    // Username validation
    if (username.length < 3) {
      showError(usernameError, "Нікнейм повинен містити щонайменше 3 символи");
      isValid = false;
    }

    // Password validation
    if (password.length < 6) {
      showError(passwordError, "Пароль повинен містити щонайменше 6 символів");
      isValid = false;
    }

    // Confirm password validation
    if (password !== confirmPassword) {
      showError(confirmPasswordError, "Паролі не співпадають");
      isValid = false;
    }

    // If form is valid, submit it
    if (isValid) {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("username", username);
      formData.append("password", password);

      fetch("server/auth/register.php", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            alert("Реєстрація успішна! Тепер ви можете увійти в систему.");
            registerModal.style.display = "none";
            resetRegisterForm();
            loginModal.style.display = "flex"; // Show login modal after successful registration
          } else {
            // Show error message
            if (data.errors) {
              if (data.errors.email) {
                showError(emailError, data.errors.email);
              }
              if (data.errors.username) {
                showError(usernameError, data.errors.username);
              }
              if (data.errors.password) {
                showError(passwordError, data.errors.password);
              }
            } else {
              alert(
                "Помилка реєстрації: " + (data.message || "Невідома помилка")
              );
            }
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          alert("Сталася помилка при реєстрації. Спробуйте пізніше.");
        });
    }
  });

  // Login form submission
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    // Reset error messages
    resetLoginErrors();

    // Get form values
    const login = loginInput.value.trim();
    const password = loginPasswordInput.value.trim();

    // Validate form
    let isValid = true;

    // Login validation
    if (login.length === 0) {
      showError(loginError, "Будь ласка, введіть логін або email");
      isValid = false;
    }

    // Password validation
    if (password.length === 0) {
      showError(loginPasswordError, "Будь ласка, введіть пароль");
      isValid = false;
    }

    // If form is valid, submit it
    if (isValid) {
      const formData = new FormData();
      formData.append("login", login);
      formData.append("password", password);

      fetch("server/auth/auth.php", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            alert("Вхід успішний!");
            loginModal.style.display = "none";
            resetLoginForm();
            updateUIAfterLogin(data.user);
          } else {
            // Show error message
            if (data.errors) {
              if (data.errors.login) {
                showError(loginError, data.errors.login);
              }
              if (data.errors.password) {
                showError(loginPasswordError, data.errors.password);
              }
            } else {
              alert("Помилка входу: " + (data.message || "Невідома помилка"));
            }
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          alert("Сталася помилка при вході. Спробуйте пізніше.");
        });
    }
  });

  // Create room button click handler
  createRoomBtn.addEventListener("click", function () {
    createRoom();
  });

  // Helper functions
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function showError(element, message) {
    element.textContent = message;
    element.style.display = "block";
  }

  function resetRegisterErrors() {
    emailError.style.display = "none";
    usernameError.style.display = "none";
    passwordError.style.display = "none";
    confirmPasswordError.style.display = "none";
  }

  function resetLoginErrors() {
    loginError.style.display = "none";
    loginPasswordError.style.display = "none";
  }

  function resetRegisterForm() {
    registerForm.reset();
    resetRegisterErrors();
  }

  function resetLoginForm() {
    loginForm.reset();
    resetLoginErrors();
  }

  function updateUIAfterLogin(user) {
    // Hide register button
    registerBtn.style.display = "none";

    // Change login button to logout
    loginBtn.textContent = "Вихід";

    // Show create room button
    createRoomBtn.style.display = "inline-block";

    // Store current user info globally
    window.currentUser = user;

    // You can also update other UI elements to show the logged-in user
    console.log("Logged in as:", user.username);
  }

  function updateUIAfterLogout() {
    // Show register button
    registerBtn.style.display = "inline-block";

    // Change logout button back to login
    loginBtn.textContent = "Вхід";

    // Hide create room button
    createRoomBtn.style.display = "none";

    // Clear current user info
    window.currentUser = null;
  }

  function logout() {
    fetch("server/auth/logout.php")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          alert("Ви успішно вийшли з системи");
          updateUIAfterLogout();
        } else {
          alert("Помилка при виході з системи");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        alert("Сталася помилка при виході з системи");
      });
  }

  function checkLoginStatus() {
    fetch("server/auth/check_login.php")
      .then((response) => response.json())
      .then((data) => {
        if (data.logged_in) {
          updateUIAfterLogin(data.user);
        } else {
          // Ensure user info is cleared if not logged in
          window.currentUser = null;
        }
      })
      .catch((error) => {
        console.error("Error checking login status:", error);
      });
  }

  function createRoom() {
    // First check if user is already in a room
    fetch("server/room.php?action=get_rooms")
      .then((response) => response.json())
      .then((data) => {
        if (data.rooms && window.currentUser) {
          // Check if current user is already in any room
          const userInRoom = data.rooms.find(room => 
            room.creator_id === window.currentUser.id || 
            room.second_player_id === window.currentUser.id
          );
          
          if (userInRoom) {
            alert("Ви вже берете участь в іншій кімнаті");
            return;
          }
        }
        
        // Create room
        const roomData = {
          action: "create_room",
          room_type: "public" // Default to public room
        };
        
        fetch("server/room.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(roomData),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.success) {
              alert("Кімнату створено успішно! ID кімнати: " + data.room_id);
              // Optionally refresh the room list or redirect to game
            } else {
              alert("Помилка створення кімнати: " + (data.error || "Невідома помилка"));
            }
          })
          .catch((error) => {
            console.error("Error creating room:", error);
            alert("Сталася помилка при створенні кімнати");
          });
      })
      .catch((error) => {
        console.error("Error checking rooms:", error);
        alert("Сталася помилка при перевірці кімнат");
      });
  }

  function getCurrentUsername() {
    // This is a simplified version - you might want to store username in a global variable
    // when user logs in, or fetch it from session
    return window.currentUser ? window.currentUser.username : null;
  }

  function getCurrentUserId() {
    // Similar to username, store this when user logs in
    return window.currentUser ? window.currentUser.id : null;
  }
});
