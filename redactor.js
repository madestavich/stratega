document.addEventListener("DOMContentLoaded", () => {
  class Editor {
    constructor() {
      this.spritesheets = {};
      this.currentSpritesheetKey = null;
      this.currentAnimation = null;
      this.imageLoader = document.getElementById("imageLoader");
      this.addSpritesheetBtn = document.getElementById("addSpritesheet");
      this.sheetSelect = document.getElementById("spritesheets");
      this.removeSpritesheetBtn = document.getElementById("removeSpritesheet");
      this.newAnimationBtn = document.getElementById("newAnimation");
      this.animationsSelect = document.getElementById("animations");
      this.deleteAnimationBtn = document.getElementById("deleteAnimation");
      this.newFrameBtn = document.getElementById("newFrame");
      this.deleteFrameBtn = document.getElementById("deleteFrame");
      this.frameSlider = document.getElementById("frameSlider");
      this.frameX = document.getElementById("frameX");
      this.frameY = document.getElementById("frameY");
      this.frameWidth = document.getElementById("frameWidth");
      this.frameHeight = document.getElementById("frameHeight");
      this.centerX = document.getElementById("centerX");
      this.centerY = document.getElementById("centerY");
      this.saveConfigBtn = document.getElementById("saveConfig");
      this.logConfigBtn = document.getElementById("logConfig");
      this.frameSelectionToggle = document.getElementById(
        "frameSelectionToggle"
      );
      this.canvasRenderer = new CanvasRenderer(
        document.getElementById("canvas")
      );
    }

    updateUIState() {
      this.drawSelectedImage();
      const hasSpritesheet = this.currentSpritesheetKey !== null;
      const hasAnimation = this.currentAnimation !== null;
      const selectedSpritesheet = this.spritesheets[
        this.currentSpritesheetKey
      ] || { animations: {} };
      const selectedAnimation = hasAnimation
        ? selectedSpritesheet.animations[this.currentAnimation]
        : null;
      const hasFrames =
        selectedAnimation && selectedAnimation.frames.length > 0;
      const multipleFrames =
        selectedAnimation && selectedAnimation.frames.length > 1;

      this.removeSpritesheetBtn.disabled = !hasSpritesheet;
      this.newAnimationBtn.disabled = !hasSpritesheet;
      this.animationsSelect.disabled =
        !selectedSpritesheet ||
        Object.keys(selectedSpritesheet.animations).length === 0;
      this.deleteAnimationBtn.disabled = !hasAnimation;
      this.newFrameBtn.disabled = !hasAnimation;
      this.deleteFrameBtn.disabled = !hasFrames;
      this.frameSlider.disabled = !multipleFrames;

      const frameInputs = [
        this.frameX,
        this.frameY,
        this.frameWidth,
        this.frameHeight,
        this.centerX,
        this.centerY,
      ];
      frameInputs.forEach((input) => (input.disabled = !hasFrames));
    }

    setupEventListeners() {
      this.frameSelectionToggle.addEventListener("change", (e) => {
        this.canvasRenderer.enableFrameSelection(e.target.checked);
      });
      this.sheetSelect.addEventListener("change", () => {
        this.currentSpritesheetKey = this.sheetSelect.value;
        this.updateAnimationSelect();
        this.updateUIState();
      });

      this.addSpritesheetBtn.addEventListener("click", () =>
        this.addSpritesheet()
      );
      this.removeSpritesheetBtn.addEventListener("click", () =>
        this.removeSpritesheet()
      );
      this.newAnimationBtn.addEventListener("click", () => this.newAnimation());
      this.deleteAnimationBtn.addEventListener("click", () =>
        this.deleteAnimation()
      );

      this.newFrameBtn.addEventListener("click", () => this.newFrame());
      this.deleteFrameBtn.addEventListener("click", () => this.deleteFrame());
      this.saveConfigBtn.addEventListener("click", () => this.saveConfig());
      this.logConfigBtn.addEventListener("click", () => this.logConfig());

      this.frameSlider.addEventListener("input", () => {
        if (!this.currentSpritesheetKey || !this.currentAnimation) return;

        const selectedSpritesheet =
          this.spritesheets[this.currentSpritesheetKey];
        const selectedAnimation =
          selectedSpritesheet.animations[this.currentAnimation];

        const frameIndex = parseInt(this.frameSlider.value, 10);
        const frame = selectedAnimation.frames[frameIndex];

        this.frameX.value = frame.x;
        this.frameY.value = frame.y;
        this.frameWidth.value = frame.width;
        this.frameHeight.value = frame.height;
        this.centerX.value = frame.frameCenter.x;
        this.centerY.value = frame.frameCenter.y;
        this.drawSelectedFrame();
      });

      [
        this.frameX,
        this.frameY,
        this.frameWidth,
        this.frameHeight,
        this.centerX,
        this.centerY,
      ].forEach((input) => {
        input.addEventListener("change", () => {
          if (!this.currentSpritesheetKey || !this.currentAnimation) return;

          const selectedSpritesheet =
            this.spritesheets[this.currentSpritesheetKey];
          const selectedAnimation =
            selectedSpritesheet.animations[this.currentAnimation];
          const frameIndex = parseInt(this.frameSlider.value, 10);
          const frame = selectedAnimation.frames[frameIndex];

          frame.x = parseInt(this.frameX.value) || 0;
          frame.y = parseInt(this.frameY.value) || 0;
          frame.width = parseInt(this.frameWidth.value) || 0;
          frame.height = parseInt(this.frameHeight.value) || 0;
          frame.frameCenter.x = parseInt(this.centerX.value) || 0;
          frame.frameCenter.y = parseInt(this.centerY.value) || 0;

          this.drawSelectedFrame(); // Оновлюємо відображення фрейму
        });
      });

      this.animationsSelect.addEventListener("change", () => {
        this.currentAnimation = this.animationsSelect.value;
        this.updateFrameSelection();
        this.updateUIState();
        this.drawSelectedFrame(); // Оновлюємо фрейм при зміні анімації
      });
    }

    addSpritesheet() {
      const fileInput = this.imageLoader;
      if (!fileInput.files.length) return;

      const name = prompt("Enter spritesheet name:");
      if (!name || this.spritesheets[name])
        return alert("Invalid or duplicate name");

      const file = fileInput.files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        const image = new Image();
        image.src = e.target.result;

        image.onload = () => {
          // Store relative path instead of full data URL
          const relativePath = file.name;

          this.spritesheets[name] = new Spritesheet(name, {
            link: relativePath,
            width: image.width,
            height: image.height,
          });
          this.currentSpritesheetKey = name;
          this.updateUIState();
          this.updateSheetSelect();
        };
      };

      reader.readAsDataURL(file);
    }

    updateSheetSelect() {
      this.sheetSelect.innerHTML = "";
      Object.keys(this.spritesheets).forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = key;
        this.sheetSelect.appendChild(option);
      });

      this.currentSpritesheetKey = Object.keys(this.spritesheets)[0] || null;
      if (this.currentSpritesheetKey) {
        this.sheetSelect.value = this.currentSpritesheetKey;
      }
    }

    removeSpritesheet() {
      const selectedKey = this.sheetSelect.value;
      if (!selectedKey || !this.spritesheets[selectedKey]) return;

      delete this.spritesheets[selectedKey];

      const keys = Object.keys(this.spritesheets);
      this.currentSpritesheetKey = keys.length > 0 ? keys[0] : null;

      this.updateSheetSelect();
      this.updateAnimationSelect();
      this.updateUIState();
    }

    logConfig() {
      console.log(this);
    }

    newAnimation() {
      if (!this.currentSpritesheetKey) return;

      const animationName = prompt("Enter animation name:");
      if (!animationName) return alert("Invalid animation name");

      const selectedSpritesheet = this.spritesheets[this.currentSpritesheetKey];
      if (selectedSpritesheet.animations[animationName]) {
        return alert("Animation with this name already exists");
      }

      selectedSpritesheet.animations[animationName] = new Animation(
        animationName
      );
      this.currentAnimation = animationName;
      this.updateUIState();
      this.updateAnimationSelect();
    }

    updateAnimationSelect() {
      this.animationsSelect.innerHTML = "";
      if (!this.currentSpritesheetKey) return;

      const selectedSpritesheet = this.spritesheets[this.currentSpritesheetKey];
      Object.keys(selectedSpritesheet.animations).forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = key;
        this.animationsSelect.appendChild(option);
      });

      this.currentAnimation =
        Object.keys(selectedSpritesheet.animations)[0] || null;
      if (this.currentAnimation) {
        this.animationsSelect.value = this.currentAnimation;
      }
    }

    deleteAnimation() {
      if (!this.currentSpritesheetKey || !this.animationsSelect.value) return;

      const selectedSpritesheet = this.spritesheets[this.currentSpritesheetKey];
      const selectedAnimation = this.animationsSelect.value;

      delete selectedSpritesheet.animations[selectedAnimation];

      const animationKeys = Object.keys(selectedSpritesheet.animations);
      this.currentAnimation =
        animationKeys.length > 0 ? animationKeys[0] : null;

      this.updateAnimationSelect();
      this.updateUIState();
    }

    newFrame() {
      if (!this.currentSpritesheetKey || !this.currentAnimation) return;

      const selectedSpritesheet = this.spritesheets[this.currentSpritesheetKey];
      const selectedAnimation =
        selectedSpritesheet.animations[this.currentAnimation];

      const frame = new Frame(0, 0, 0, 0, 0, 0);
      selectedAnimation.frames.push(frame);

      this.frameSlider.max = selectedAnimation.frames.length - 1;
      this.frameSlider.value = selectedAnimation.frames.length - 1;

      this.drawSelectedFrame();
      this.updateFrameInputs(frame);
      this.updateUIState();
    }

    updateFrameSelection() {
      if (!this.currentSpritesheetKey || !this.currentAnimation) return;

      const selectedSpritesheet = this.spritesheets[this.currentSpritesheetKey];
      const selectedAnimation =
        selectedSpritesheet.animations[this.currentAnimation];

      if (selectedAnimation.frames.length > 0) {
        this.frameSlider.max = selectedAnimation.frames.length - 1;
        this.frameSlider.value = 0;
        const frame = selectedAnimation.frames[0];

        this.frameX.value = frame.x;
        this.frameY.value = frame.y;
        this.frameWidth.value = frame.width;
        this.frameHeight.value = frame.height;
        this.centerX.value = frame.frameCenter.x;
        this.centerY.value = frame.frameCenter.y;
      } else {
        this.frameSlider.max = 0;
        this.frameSlider.value = 0;
        this.frameX.value = "";
        this.frameY.value = "";
        this.frameWidth.value = "";
        this.frameHeight.value = "";
        this.centerX.value = "";
        this.centerY.value = "";
      }
    }

    deleteFrame() {
      if (!this.currentSpritesheetKey || !this.currentAnimation) return;

      const selectedSpritesheet = this.spritesheets[this.currentSpritesheetKey];
      const selectedAnimation =
        selectedSpritesheet.animations[this.currentAnimation];

      const frameIndex = parseInt(this.frameSlider.value, 10);
      if (
        isNaN(frameIndex) ||
        frameIndex < 0 ||
        frameIndex >= selectedAnimation.frames.length
      )
        return;

      selectedAnimation.frames.splice(frameIndex, 1);

      this.frameSlider.max = Math.max(selectedAnimation.frames.length - 1, 0);
      this.frameSlider.value = 0;

      this.updateFrameSelection();
      this.updateUIState();
    }

    saveConfig() {
      if (!Object.keys(this.spritesheets).length)
        return alert("Немає даних для збереження");

      const fileName = prompt("Введіть назву файлу:", "config");
      if (!fileName) return;

      const dataStr = JSON.stringify(this.spritesheets, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    drawSelectedImage() {
      if (!this.currentSpritesheetKey) return;

      const selectedSpritesheet = this.spritesheets[this.currentSpritesheetKey];
      this.canvasRenderer.setImage(selectedSpritesheet.sourceImage.link);
    }

    drawSelectedFrame() {
      if (!this.currentSpritesheetKey || !this.currentAnimation) return;

      const selectedSpritesheet = this.spritesheets[this.currentSpritesheetKey];
      const selectedAnimation =
        selectedSpritesheet.animations[this.currentAnimation];

      const frameIndex = parseInt(this.frameSlider.value, 10);
      const selectedFrame = selectedAnimation.frames[frameIndex] || null;

      this.canvasRenderer.setFrame(selectedFrame);
    }

    applyFrameSelection(frame) {
      if (!this.currentSpritesheetKey || !this.currentAnimation) return;

      const selectedSpritesheet = this.spritesheets[this.currentSpritesheetKey];
      const selectedAnimation =
        selectedSpritesheet.animations[this.currentAnimation];

      const frameIndex = parseInt(this.frameSlider.value, 10);
      if (
        isNaN(frameIndex) ||
        frameIndex < 0 ||
        frameIndex >= selectedAnimation.frames.length
      )
        return;

      selectedAnimation.frames[frameIndex] = frame;

      this.updateFrameInputs(frame);
      this.updateUIState();
    }

    updateFrameInputs(frame) {
      this.frameX.value = frame.x;
      this.frameY.value = frame.y;
      this.frameWidth.value = frame.width;
      this.frameHeight.value = frame.height;
      this.centerX.value = frame.frameCenter.x;
      this.centerY.value = frame.frameCenter.y;
    }
  }

  class Spritesheet {
    constructor(name, sourceImage) {
      this.name = name;
      this.sourceImage = sourceImage;
      this.animations = {};
    }
  }

  class Animation {
    constructor(name) {
      this.name = name;
      this.frames = [];
    }
  }

  class Frame {
    constructor(x, y, width, height, centerX, centerY) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.frameCenter = { x: centerX, y: centerY };
    }
  }

  class CanvasRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.image = null;
      this.imageOffsetX = 0;
      this.imageOffsetY = 0;
      this.isDragging = false;
      this.currentFrame = null;
      this.lastSpritesheet = null; // Зберігає останній спрайтшит
      this.lastOffsetX = 0;
      this.lastOffsetY = 0;

      this.initCanvasEvents();
    }

    setImage(imageSrc) {
      const isSameSpritesheet = this.lastSpritesheet === imageSrc;
      const image = new Image();
      image.src = imageSrc;

      image.onload = () => {
        this.image = image;

        // Якщо спрайтшит той самий, залишаємо стару позицію
        if (isSameSpritesheet) {
          this.imageOffsetX = this.lastOffsetX;
          this.imageOffsetY = this.lastOffsetY;
        } else {
          // Якщо новий спрайтшит – центруємо
          this.imageOffsetX = (this.canvas.width - this.image.width) / 2;
          this.imageOffsetY = (this.canvas.height - this.image.height) / 2;
        }

        this.lastSpritesheet = imageSrc; // Оновлюємо збережений спрайтшит
        this.redrawCanvas();
      };
    }

    setFrame(frame) {
      this.currentFrame = frame;
      this.redrawCanvas();
    }

    redrawCanvas() {
      if (!this.image) return;

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.image, this.imageOffsetX, this.imageOffsetY);

      if (this.currentFrame) {
        this.drawFrame(this.currentFrame);
      }
    }

    drawFrame(frame) {
      this.ctx.strokeStyle = "red";
      this.ctx.lineWidth = 2;
      this.ctx.fillStyle = "blue";

      this.ctx.strokeRect(
        this.imageOffsetX + frame.x,
        this.imageOffsetY + frame.y,
        frame.width,
        frame.height
      );

      this.ctx.beginPath();
      this.ctx.arc(
        this.imageOffsetX + frame.frameCenter.x,
        this.imageOffsetY + frame.frameCenter.y,
        4,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    }

    enableFrameSelection(enable) {
      this.isFrameSelectionMode = enable;
    }

    initCanvasEvents() {
      this.canvas.addEventListener("mousedown", (e) => {
        if (this.isFrameSelectionMode) {
          if (!editor.currentSpritesheetKey || !editor.currentAnimation) return;

          this.isSelectingFrame = true;
          this.startFrameX = e.offsetX - this.imageOffsetX;
          this.startFrameY = e.offsetY - this.imageOffsetY;
          this.currentFrame = new Frame(
            this.startFrameX,
            this.startFrameY,
            0,
            0,
            0,
            0
          );
          return;
        }

        this.isDragging = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
      });

      this.canvas.addEventListener("mousemove", (e) => {
        if (this.isSelectingFrame) {
          const currentX = e.offsetX - this.imageOffsetX;
          const currentY = e.offsetY - this.imageOffsetY;

          // Нормалізуємо координати
          const x = Math.min(this.startFrameX, currentX);
          const y = Math.min(this.startFrameY, currentY);
          const width = Math.abs(currentX - this.startFrameX);
          const height = Math.abs(currentY - this.startFrameY);

          this.currentFrame.x = x;
          this.currentFrame.y = y;
          this.currentFrame.width = width;
          this.currentFrame.height = height;

          // Оновлюємо центр фрейму
          this.currentFrame.frameCenter.x = x + width / 2;
          this.currentFrame.frameCenter.y = y + height / 2;

          this.redrawCanvas();
          return;
        }

        if (!this.isDragging || !this.image) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        this.imageOffsetX += dx;
        this.imageOffsetY += dy;

        this.startX = e.clientX;
        this.startY = e.clientY;

        this.redrawCanvas();
      });

      this.canvas.addEventListener("mouseup", () => {
        if (this.isSelectingFrame) {
          this.isSelectingFrame = false;

          if (this.currentFrame) {
            editor.applyFrameSelection(this.currentFrame);
          }
          return;
        }

        this.isDragging = false;
        this.lastOffsetX = this.imageOffsetX;
        this.lastOffsetY = this.imageOffsetY;
      });
    }
  }

  //!-----------------------------------------------------------------------------------

  const editor = new Editor();
  editor.setupEventListeners();
  editor.updateUIState();
});
