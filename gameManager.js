const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

class GameManager {
  constructor() {
    this.lastTime = 0;
    this.deltaTime = 0;
    this.fixedTimeStep = 1000 / 60; // 60 FPS
    this.accumulator = 0;
    this.start();
  }

  start() {
    requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  loop(timestamp) {
    if (this.lastTime === 0) this.lastTime = timestamp;

    this.deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.accumulator += this.deltaTime;

    while (this.accumulator >= this.fixedTimeStep) {
      this.update(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
    }

    this.render();
    requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  update(dt) {
    // Логіка гри
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Малювання
  }
}

new GameManager();
