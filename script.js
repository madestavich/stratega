document.addEventListener("DOMContentLoaded", function () {
  // Modal elements
  const registerModal = document.getElementById("registerModal");
  const loginModal = document.getElementById("loginModal");
  const registerBtn = document.getElementById("register-btn");
  const loginBtn = document.getElementById("login-btn");
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

    // You can also update other UI elements to show the logged-in user
    console.log("Logged in as:", user.username);
  }

  function updateUIAfterLogout() {
    // Show register button
    registerBtn.style.display = "inline-block";

    // Change logout button back to login
    loginBtn.textContent = "Вхід";
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
        }
      })
      .catch((error) => {
        console.error("Error checking login status:", error);
      });
  }

  // Game room buttons
  const joinButtons = document.querySelectorAll(".join-button:not([disabled])");
  joinButtons.forEach((button) => {
    button.addEventListener("click", function () {
      if (this.textContent === "Створити гру") {
        alert("Створення нової гри...");
      } else {
        alert("Приєднання до гри...");
      }
    });
  });
});

//! --------------- rooms -----------------

document.addEventListener("DOMContentLoaded", function () {
  // Game room buttons
  const joinButtons = document.querySelectorAll(".join-button:not([disabled])");
  joinButtons.forEach((button) => {
    button.addEventListener("click", function () {
      if (this.textContent === "Створити гру") {
        createRoom();
      } else {
        const roomId = this.getAttribute("data-room-id");
        joinRoom(roomId);
      }
    });
  });

  // Load rooms on page load
  loadRooms();
});

// Function to create a new room
function createRoom() {
  // For closed rooms, you might want to show a modal to enter password
  const roomType = "open"; // or "closed"
  const password = ""; // Only needed for closed rooms

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
        // Redirect to game page or show success message
        window.location.href = `/game.html?room=${data.room_id}`;
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
        window.location.href = `/game.html?room=${data.room_id}`;
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

// Function to display rooms in the UI
function displayRooms(rooms) {
  const roomsContainer = document.querySelector(".right-column");

  // Clear existing rooms except the header
  const header = roomsContainer.querySelector("h2");
  roomsContainer.innerHTML = "";
  roomsContainer.appendChild(header);

  // Add "Create Room" button
  const createRoomDiv = document.createElement("div");
  createRoomDiv.className = "game-room";
  createRoomDiv.innerHTML = `
    <div class="players">
      <div class="player">Створити нову кімнату</div>
    </div>
    <div class="game-status status-preparing">Нова гра</div>
    <button class="join-button">Створити гру</button>
  `;
  roomsContainer.appendChild(createRoomDiv);

  // Add event listener to the create button
  const createButton = createRoomDiv.querySelector(".join-button");
  createButton.addEventListener("click", createRoom);

  // Add existing rooms
  rooms.forEach((room) => {
    const roomDiv = document.createElement("div");
    roomDiv.className = "game-room";
    roomDiv.setAttribute("data-room-id", room.id);
    roomDiv.setAttribute("data-room-type", room.room_type);

    const statusClass =
      room.status === "preparing" ? "status-preparing" : "status-in-progress";
    const statusText = room.status === "preparing" ? "Підготовка" : "Гра йде";
    const canJoin = room.status === "preparing";

    roomDiv.innerHTML = `
      <div class="players">
        <div class="player">Гравець 1: ${room.creator_name}</div>
        <div class="player">Гравець 2: ${room.second_player_name || "-"}</div>
      </div>
      <div class="game-status ${statusClass}">${statusText}</div>
      <button class="join-button" ${canJoin ? "" : "disabled"} data-room-id="${
      room.id
    }">
        ${canJoin ? "Приєднатися" : "Приєднатися"}
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

// Function to update game state
function updateGameState(roomId, gameState, currentRound) {
  const formData = new FormData();
  formData.append("action", "update");
  formData.append("room_id", roomId);
  formData.append("game_state", JSON.stringify(gameState));
  formData.append("current_round", currentRound);

  return fetch("/server/room.php", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.status !== "success") {
        console.error("Error updating game state:", data.message);
      }
      return data;
    })
    .catch((error) => {
      console.error("Error updating game state:", error);
      throw error;
    });
}

// Function to get room details
function getRoomDetails(roomId) {
  return fetch(`/server/room.php?action=get&room_id=${roomId}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.status === "success") {
        return data.room;
      } else {
        console.error("Error getting room details:", data.message);
        throw new Error(data.message);
      }
    })
    .catch((error) => {
      console.error("Error getting room details:", error);
      throw error;
    });
}

// Function to periodically refresh room data in game
function startGameStatePolling(roomId, callback, interval = 5000) {
  // Initial load
  getRoomDetails(roomId)
    .then((room) => {
      if (callback) callback(room);
    })
    .catch((error) => console.error("Error in initial room load:", error));

  // Set up polling
  const pollId = setInterval(() => {
    getRoomDetails(roomId)
      .then((room) => {
        if (callback) callback(room);
      })
      .catch((error) => {
        console.error("Error polling room data:", error);
        // Optionally stop polling on persistent errors
        // clearInterval(pollId);
      });
  }, interval);

  // Return the interval ID so it can be cleared later
  return pollId;
}
