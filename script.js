document.addEventListener("DOMContentLoaded", function () {
  // Modal elements
  const registerModal = document.getElementById("registerModal");
  const registerBtn = document.getElementById("register-btn");
  const closeButton = document.querySelector(".close-button");
  const registerForm = document.getElementById("registerForm");

  // Form fields
  const emailInput = document.getElementById("email");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirm-password");

  // Error messages
  const emailError = document.getElementById("email-error");
  const usernameError = document.getElementById("username-error");
  const passwordError = document.getElementById("password-error");
  const confirmPasswordError = document.getElementById(
    "confirm-password-error"
  );
  let mouseDownTarget = null;

  // Open modal when register button is clicked
  registerBtn.addEventListener("click", function () {
    registerModal.style.display = "flex";
  });

  // Close modal when close button is clicked
  closeButton.addEventListener("click", function () {
    registerModal.style.display = "none";
    resetForm();
  });

  // Track where the mouse down event occurs
  window.addEventListener("mousedown", function (event) {
    mouseDownTarget = event.target;
  });

  // Only close if both mousedown and mouseup happened on the modal background
  window.addEventListener("mouseup", function (event) {
    if (event.target === registerModal && mouseDownTarget === registerModal) {
      registerModal.style.display = "none";
      resetForm();
    }
    mouseDownTarget = null;
  });

  // Form submission
  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();

    // Reset error messages
    resetErrors();

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

      fetch("auth/register.php", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            alert("Реєстрація успішна! Тепер ви можете увійти в систему.");
            registerModal.style.display = "none";
            resetForm();
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

  // Helper functions
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function showError(element, message) {
    element.textContent = message;
    element.style.display = "block";
  }

  function resetErrors() {
    emailError.style.display = "none";
    usernameError.style.display = "none";
    passwordError.style.display = "none";
    confirmPasswordError.style.display = "none";
  }

  function resetForm() {
    registerForm.reset();
    resetErrors();
  }

  // Login button functionality (placeholder)
  document.getElementById("login-btn").addEventListener("click", function () {
    alert("Функція входу буде доступна незабаром");
  });

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
