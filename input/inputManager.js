export class InputManager {
  constructor() {
    this.keys = [];
    this.mouse = {
      x: 0,
      y: 0,
      left: false,
      right: false,
      middle: false,
    };

    // Додаємо стан для кнопки плей/пауза
    this.playButton = document.querySelector(".start-button");
    this.playButtonCallback = null;

    // Ініціалізуємо обробник для кнопки
    if (this.playButton) {
      this.playButton.addEventListener("click", () => {
        if (this.playButtonCallback) {
          this.playButtonCallback();
        }
      });
    }
  }

  // Метод для встановлення колбеку для кнопки
  setPlayButtonCallback(callback) {
    this.playButtonCallback = callback;
  }

  // Метод для оновлення тексту кнопки
  updatePlayButtonText(isPaused) {
    if (this.playButton) {
      this.playButton.textContent = isPaused ? "START" : "PAUSE";
    }
  }
}
