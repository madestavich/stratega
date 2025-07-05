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
  const createRoomContainer = document.getElementById("create-room-container");

  // For registration form
  const emailInput = document.getElementById("email");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirm-password");

  // For login form
  const loginInput = document.getElementById("login");
  const loginPasswordInput = document.getElementById("login-password");

  // Room creation form elements
  const roomTypeSelect = document.getElementById("room-type");
  const passwordGroup = document.getElementById("password-group");
  const roomPasswordInput = document.getElementById("room-password");
  const roomPasswordError = document.getElementById("room-password-error");

  let mouseDownTarget = null;

  // Check if user is logged in and can create rooms
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

  // Open create room modal when create room button is clicked
  if (createRoomBtn) {
    createRoomBtn.addEventListener("click", function () {
      createRoomModal.style.display = "flex";
    });
  }

  // Show/hide password field based on room type selection
  if (roomTypeSelect) {
    roomTypeSelect.addEventListener("change", function () {
      if (this.value === "closed") {
        passwordGroup.style.display = "block";
      } else {
        passwordGroup.style.display = "none";
        roomPasswordInput.value = "";
      }
    });
  }

  // Close modals when close button is clicked
  closeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      registerModal.style.display = "none";
      loginModal.style.display = "none";
      if (createRoomModal) createRoomModal.style.display = "none";
      resetRegisterForm();
      resetLoginForm();
      if (createRoomForm) resetCreateRoomForm();
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
      createRoomModal &&
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

  // Create Room form submission
  if (createRoomForm) {
    createRoomForm.addEventListener("submit", function (event) {
      event.preventDefault();

      // Reset error messages
      resetCreateRoomErrors();

      // Get form values
      const roomType = roomTypeSelect.value;
      const password = roomPasswordInput.value.trim();

      // Validate form
      let isValid = true;

      // Password validation for closed rooms
      if (roomType === "closed" && password.length < 4) {
        showError(
          roomPasswordError,
          "Пароль повинен містити щонайменше 4 символи"
        );
        isValid = false;
      }

      // If form is valid, submit it
      if (isValid) {
        createRoom(roomType, password);
      }
    });
  }

  // Function to create a room
  function createRoom(roomType, password = "") {
    const formData = new FormData();
    formData.append("action", "create");
    formData.append("room_type", roomType);

    if (roomType === "closed") {
      formData.append("password", password);
    }

    fetch("/server/room.php", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "success") {
          // Close the modal
          createRoomModal.style.display = "none";
          resetCreateRoomForm();

          // Redirect to game page or show success message
          window.location.href = `/game/game.html?room=${data.room_id}`;
        } else {
          alert(`Error: ${data.message}`);
        }
      })
      .catch((error) => {
        console.error("Error creating room:", error);
        alert("Failed to create room. Please try again.");
      });
  }

  // Function to join an existing room
  function joinRoom(roomId) {
    const formData = new FormData();
    formData.append("action", "join");
    formData.append("room_id", roomId);

    // For closed rooms, you might need to prompt for password
    const roomElement = document.querySelector(
      `.game-room[data-room-id="${roomId}"]`
    );
    const isClosedRoom =
      roomElement && roomElement.getAttribute("data-room-type") === "closed";

    if (isClosedRoom) {
      const password = prompt(
        "Ця кімната захищена паролем. Будь ласка, введіть пароль:"
      );
      if (password === null) return; // User cancelled
      formData.append("password", password);
    }

    fetch("/server/room.php", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "success") {
          // Redirect to game page
          window.location.href = `/game/game.html?room=${data.room_id}`;
        } else {
          alert(`Error: ${data.message}`);
        }
      })
      .catch((error) => {
        console.error("Error joining room:", error);
        alert("Failed to join room. Please try again.");
      });
  }

  // Function to load and display available rooms
  function loadRooms() {
    fetch("/server/room.php?action=list")
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "success") {
          displayRooms(data.rooms);
        } else {
          console.error("Error loading rooms:", data.message);
        }
      })
      .catch((error) => {
        console.error("Error loading rooms:", error);
      });
  }

  function displayRooms(rooms) {
    const roomsContainer = document.querySelector(".right-column");
    const header = roomsContainer.querySelector("h2");
    const createRoomContainer = document.getElementById(
      "create-room-container"
    );

    // Clear existing rooms except the header and create room button
    const elements = Array.from(roomsContainer.children);
    elements.forEach((element) => {
      if (element !== header && element !== createRoomContainer) {
        element.remove();
      }
    });

    // Filter out completed rooms
    const activeRooms = rooms.filter((room) => room.status !== "completed");

    // Add existing rooms
    if (activeRooms.length === 0) {
      const noRoomsMessage = document.createElement("p");
      noRoomsMessage.className = "no-rooms-message";
      noRoomsMessage.textContent =
        "Наразі немає доступних кімнат. Створіть нову!";
      roomsContainer.appendChild(noRoomsMessage);
    } else {
      activeRooms.forEach((room) => {
        const roomDiv = document.createElement("div");
        roomDiv.className = "game-room";
        roomDiv.setAttribute("data-room-id", room.id);
        roomDiv.setAttribute("data-room-type", room.room_type);

        const statusClass =
          room.status === "preparing"
            ? "status-preparing"
            : room.status === "in_progress"
            ? "status-in-progress"
            : "status-completed";
        const statusText =
          room.status === "preparing"
            ? "Підготовка"
            : room.status === "in_progress"
            ? "Гра йде"
            : "Завершена";
        const canJoin = room.status === "preparing";

        roomDiv.innerHTML = `
          <div class="room-header">
            <span class="room-id">Кімната #${room.id}</span>
            <span class="room-type">${
              room.room_type === "closed" ? "🔒 Закрита" : "🔓 Відкрита"
            }</span>
          </div>
          <div class="players">
            <div class="player">Гравець 1: ${room.creator_name}</div>
            <div class="player">Гравець 2: ${
              room.second_player_name || "-"
            }</div>
          </div>
          <div class="game-status ${statusClass}">${statusText}</div>
          <button class="join-button" ${canJoin ? "" : "disabled"}>
            ${canJoin ? "Приєднатися" : "Недоступно"}
          </button>
        `;

        roomsContainer.appendChild(roomDiv);

        // Add event listener to join button if it's not disabled
        if (canJoin) {
          const joinButton = roomDiv.querySelector(".join-button");
          joinButton.addEventListener("click", function () {
            joinRoom(room.id);
          });
        }
      });
    }
  }

  // Function to check login status and update UI accordingly
  function checkLoginStatus() {
    fetch("/server/auth/check_login.php")
      .then((response) => response.json())
      .then((data) => {
        if (data.logged_in) {
          updateUIAfterLogin(data.user);
          checkCanCreateRoom(data.user.id);
        } else {
          updateUIAfterLogout();
        }

        // Load rooms regardless of login status
        loadRooms();
      })
      .catch((error) => {
        console.error("Error checking login status:", error);
        // Load rooms anyway
        loadRooms();
      });
  }

  // Function to check if user can create a room
  function checkCanCreateRoom(userId) {
    fetch(`/server/room.php?action=check_can_create&user_id=${userId}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "success" && data.can_create) {
          // Show create room button
          createRoomContainer.style.display = "block";
        } else {
          // Hide create room button
          createRoomContainer.style.display = "none";
        }
      })
      .catch((error) => {
        console.error("Error checking if user can create room:", error);
        // Hide button on error
        createRoomContainer.style.display = "none";
      });
  }

  // Function to update UI after login
  function updateUIAfterLogin(user) {
    // Update login button to logout
    loginBtn.textContent = "Вихід";

    // Hide register button
    registerBtn.style.display = "none";

    // Check if username display already exists
    let usernameDisplay = document.getElementById("username-display");

    // If it doesn't exist, create it
    if (!usernameDisplay) {
      usernameDisplay = document.createElement("span");
      usernameDisplay.id = "username-display";
      usernameDisplay.className = "username-display";
      // Insert username before logout button
      loginBtn.parentNode.insertBefore(usernameDisplay, loginBtn);
    }

    // Update the username text
    usernameDisplay.textContent = user.username;

    // Check if user can create a room
    checkCanCreateRoom(user.id);
  }

  // Function to update UI after logout
  function updateUIAfterLogout() {
    // Update logout button to login
    loginBtn.textContent = "Вхід";

    // Show register button
    registerBtn.style.display = "inline-block";

    // Remove username display
    const usernameDisplay = document.getElementById("username-display");
    if (usernameDisplay) {
      usernameDisplay.remove();
    }

    // Hide create room button
    createRoomContainer.style.display = "none";
  }

  // Function to logout
  function logout() {
    fetch("/server/auth/logout.php")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          updateUIAfterLogout();
          // Reload rooms to update UI
          loadRooms();
        } else {
          alert("Помилка виходу: " + (data.message || "Невідома помилка"));
        }
      })
      .catch((error) => {
        console.error("Error logging out:", error);
        alert("Сталася помилка при виході. Спробуйте пізніше.");
      });
  }

  // Helper functions for form validation
  function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function showError(element, message) {
    element.textContent = message;
    element.style.display = "block";
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
    if (createRoomForm) {
      createRoomForm.reset();
      resetCreateRoomErrors();
      passwordGroup.style.display = "none";
    }
  }

  function resetRegisterErrors() {
    document
      .querySelectorAll("#registerForm .error-message")
      .forEach((element) => {
        element.textContent = "";
        element.style.display = "none";
      });
  }

  function resetLoginErrors() {
    document
      .querySelectorAll("#loginForm .error-message")
      .forEach((element) => {
        element.textContent = "";
        element.style.display = "none";
      });
  }

  function resetCreateRoomErrors() {
    if (roomPasswordError) {
      roomPasswordError.textContent = "";
      roomPasswordError.style.display = "none";
    }
  }

  // Game room buttons
  const joinButtons = document.querySelectorAll(".join-button:not([disabled])");
  joinButtons.forEach((button) => {
    button.addEventListener("click", function () {
      if (this.textContent === "Створити гру") {
        createRoomModal.style.display = "flex";
      } else {
        const roomId = this.closest(".game-room").getAttribute("data-room-id");
        joinRoom(roomId);
      }
    });
  });

  // Start by checking login status and loading rooms
  checkLoginStatus();
});
