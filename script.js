document.addEventListener("DOMContentLoaded", function () {
  // Modal elements
  const registerModal = document.getElementById("registerModal");
  const loginModal = document.getElementById("loginModal");
  const createRoomModal = document.getElementById("createRoomModal");
  const registerBtn = document.getElementById("register-btn");
  const loginBtn = document.getElementById("login-btn");
  const createRoomBtn = document.getElementById("create-room-btn");
  const closeButtons = document.querySelectorAll(".close-button");
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const createRoomForm = document.getElementById("createRoomForm");

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

  // Load rooms list
  loadRooms();

  // Periodically refresh rooms list every 10 seconds
  setInterval(loadRooms, 10000);

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
      createRoomModal.style.display = "none";
      resetRegisterForm();
      resetLoginForm();
      resetCreateRoomForm();
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
    if (
      event.target === createRoomModal &&
      mouseDownTarget === createRoomModal
    ) {
      createRoomModal.style.display = "none";
      resetCreateRoomForm();
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
            loadRooms(); // Refresh rooms list after login
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

  // Create room button click handler - now opens modal
  createRoomBtn.addEventListener("click", function () {
    createRoomModal.style.display = "flex";
  });

  // Room type change handler - show/hide password field
  const roomTypeSelect = document.getElementById("room-type");
  const passwordGroup = document.getElementById("password-group");

  roomTypeSelect.addEventListener("change", function () {
    if (this.value === "private") {
      passwordGroup.style.display = "block";
      document.getElementById("room-password").required = true;
    } else {
      passwordGroup.style.display = "none";
      document.getElementById("room-password").required = false;
    }
  });

  // Unit limit slider handler - update displayed value
  const unitLimitSlider = document.getElementById("max-unit-limit");
  const unitLimitValue = document.getElementById("unit-limit-value");

  if (unitLimitSlider && unitLimitValue) {
    unitLimitSlider.addEventListener("input", function () {
      unitLimitValue.textContent = this.value;
    });
  }

  // Create room form submission
  createRoomForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const roomType = document.getElementById("room-type").value;
    const roomPassword = document.getElementById("room-password").value;

    // Validate password for private room
    if (roomType === "private" && !roomPassword.trim()) {
      document.getElementById("room-password-error").textContent =
        "Пароль обов'язковий для приватної кімнати";
      document.getElementById("room-password-error").style.display = "block";
      return;
    }

    createRoom(roomType, roomPassword);
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

  function resetCreateRoomForm() {
    createRoomForm.reset();
    passwordGroup.style.display = "none";
    document.getElementById("room-password").required = false;
    document.getElementById("room-password-error").style.display = "none";
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
          loadRooms(); // Load rooms if user is already logged in
        } else {
          // Ensure user info is cleared if not logged in
          window.currentUser = null;
        }
      })
      .catch((error) => {
        console.error("Error checking login status:", error);
      });
  }

  function createRoom(roomType, roomPassword) {
    // Clear any previous errors
    document.getElementById("room-password-error").style.display = "none";

    // First check if user is already in a room
    fetch("server/room.php?action=get_rooms")
      .then((response) => response.json())
      .then((data) => {
        if (data.rooms && window.currentUser) {
          // Check if current user is already in any room
          const userInRoom = data.rooms.find(
            (room) =>
              room.creator_id === window.currentUser.id ||
              room.second_player_id === window.currentUser.id
          );

          if (userInRoom) {
            alert("Ви вже берете участь в іншій кімнаті");
            return;
          }
        }

        // Create room with only type and password (all other settings will be defaults)
        const roomData = {
          action: "create_room",
          room_type: roomType,
        };

        // Add password if room is private
        if (roomType === "private" && roomPassword) {
          roomData.password = roomPassword;
        }

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
              createRoomModal.style.display = "none";
              resetCreateRoomForm();

              // Redirect to game if redirect URL is provided
              if (data.redirect) {
                window.location.href = data.redirect;
              } else {
                loadRooms(); // Refresh room list
              }
            } else {
              alert(
                "Помилка створення кімнати: " +
                  (data.error || "Невідома помилка")
              );
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

  function loadRooms() {
    fetch("server/room.php?action=get_rooms")
      .then((response) => response.json())
      .then((data) => {
        const roomsList = document.getElementById("rooms-list");

        if (data.rooms && data.rooms.length > 0) {
          let roomsHTML = "";

          data.rooms.forEach((room) => {
            const roomTypeText =
              room.room_type === "private" ? "🔒 Приватна" : "🌐 Публічна";

            // Оновлена логіка статусу
            let statusText = "";
            if (room.game_status === "waiting") {
              statusText = "Очікування";
            } else if (room.game_status === "in_progress") {
              statusText = "В грі";
            } else if (room.game_status === "finished") {
              statusText = "Завершено";
            }

            const playerCount = room.second_player_name ? "2/2" : "1/2";

            roomsHTML += `
              <div class="room-item" data-room-id="${room.id}">
                <div class="room-info">
                  <div class="room-title">
                    <span class="room-type">${roomTypeText}</span>
                    <span class="room-players">${playerCount}</span>
                  </div>
                  <div class="room-details">
                    <span class="room-creator">Створив: ${
                      room.creator_name
                    }</span>
                    <span class="room-status">${statusText}</span>
                  </div>
                </div>
                ${
                  room.game_status === "waiting" &&
                  (!window.currentUser ||
                    window.currentUser.id !== room.creator_id)
                    ? `<button class="join-room-btn" onclick="joinRoom(${room.id}, '${room.room_type}')">Приєднатися</button>`
                    : ""
                }
              </div>
            `;
          });

          roomsList.innerHTML = roomsHTML;
        } else {
          roomsList.innerHTML =
            '<div class="no-rooms-message">Немає активних кімнат</div>';
        }
      })
      .catch((error) => {
        console.error("Error loading rooms:", error);
        document.getElementById("rooms-list").innerHTML =
          '<div class="error-message">Помилка завантаження кімнат</div>';
      });
  }

  window.joinRoom = function (roomId, roomType) {
    if (!window.currentUser) {
      alert("Спочатку увійдіть в систему");
      return;
    }

    let password = "";
    if (roomType === "private") {
      password = prompt("Введіть пароль для приватної кімнати:");
      if (!password) return;
    }

    const joinData = {
      action: "join_room",
      room_id: roomId,
      password: password,
    };

    fetch("server/room.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(joinData),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          alert("Успішно приєдналися до кімнати!");

          // Redirect to game if redirect URL is provided
          if (data.redirect) {
            window.location.href = data.redirect;
          } else {
            loadRooms(); // Refresh room list
          }
        } else {
          alert("Помилка приєднання: " + (data.error || "Невідома помилка"));
        }
      })
      .catch((error) => {
        console.error("Error joining room:", error);
        alert("Сталася помилка при приєднанні до кімнати");
      });
  };
});
