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
      this.loadConfigBtn = document.getElementById("loadConfig");
      this.bulletPointX = document.getElementById("bulletPointX");
      this.bulletPointY = document.getElementById("bulletPointY");
      this.previewCanvas = document.getElementById("previewCanvas");
      this.previewRenderer = new AnimationPreviewRenderer(this.previewCanvas);
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
      if (hasAnimation && hasFrames) {
        this.previewRenderer.startPreview(
          selectedSpritesheet.sourceImage.link,
          selectedAnimation.frames
        );
      } else {
        this.previewRenderer.stopPreview();
      }
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
        this.previewRenderer.updateFrames(selectedAnimation.frames);
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
      this.loadConfigBtn.addEventListener("click", () => this.loadConfig());
      // Додаємо обробники для bulletPoint інпутів
      if (this.bulletPointX && this.bulletPointY) {
        [this.bulletPointX, this.bulletPointY].forEach((input) => {
          input.addEventListener("change", () => {
            if (!this.currentSpritesheetKey || !this.currentAnimation) return;

            const selectedSpritesheet =
              this.spritesheets[this.currentSpritesheetKey];
            const selectedAnimation =
              selectedSpritesheet.animations[this.currentAnimation];
            const frameIndex = parseInt(this.frameSlider.value, 10);
            const frame = selectedAnimation.frames[frameIndex];

            // Створюємо bulletPoint, якщо його немає
            if (!frame.bulletPoint) {
              frame.bulletPoint = { x: 0, y: 0 };
            }

            frame.bulletPoint.x = parseInt(this.bulletPointX.value) || 0;
            frame.bulletPoint.y = parseInt(this.bulletPointY.value) || 0;

            this.canvasRenderer.redrawCanvas();
          });
        });
      }
    }

    addSpritesheet() {
      const fileInput = this.imageLoader;
      if (!fileInput.files.length) return;

      const name = prompt("Enter spritesheet name:");
      if (!name || this.spritesheets[name])
        return alert("Invalid or duplicate name");

      const file = fileInput.files[0];
      const fileName = file.name;
      const relativeToEditor = "../sprites/" + fileName;

      const image = new Image();
      image.src = relativeToEditor;

      image.onload = () => {
        this.spritesheets[name] = new Spritesheet(name, {
          link: relativeToEditor,
          width: image.width,
          height: image.height,
        });
        this.currentSpritesheetKey = name;
        this.updateUIState();
        this.updateSheetSelect();
      };
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
      console.log(this.spritesheets);
    }

    loadConfig() {
      // Create a file input element
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json";

      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const config = JSON.parse(event.target.result);

            // Clear existing spritesheets
            this.spritesheets = {};

            // Load each spritesheet from the config
            Object.entries(config).forEach(([key, spritesheet]) => {
              // Create a new Spritesheet object
              this.spritesheets[key] = new Spritesheet(
                spritesheet.name,
                spritesheet.sourceImage
              );

              // Load animations
              Object.entries(spritesheet.animations).forEach(
                ([animKey, anim]) => {
                  this.spritesheets[key].animations[animKey] = new Animation(
                    anim.name
                  );

                  // Load frames
                  anim.frames.forEach((frameData) => {
                    const bulletPointX = frameData.bulletPoint
                      ? frameData.bulletPoint.x
                      : null;
                    const bulletPointY = frameData.bulletPoint
                      ? frameData.bulletPoint.y
                      : null;

                    const frame = new Frame(
                      frameData.x,
                      frameData.y,
                      frameData.width,
                      frameData.height,
                      frameData.frameCenter.x,
                      frameData.frameCenter.y,
                      bulletPointX,
                      bulletPointY
                    );
                    this.spritesheets[key].animations[animKey].frames.push(
                      frame
                    );
                  });
                }
              );
            });

            // Update UI
            this.updateSheetSelect();
            this.updateAnimationSelect();
            this.updateUIState();

            alert("Configuration loaded successfully!");
          } catch (error) {
            console.error("Error loading config:", error);
            alert(
              "Failed to load configuration file. Check console for details."
            );
          }
        };

        reader.readAsText(file);
      });

      // Trigger the file input click
      fileInput.click();
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

      // Оновлюємо поля bulletPoint, якщо вони існують
      if (this.bulletPointX && this.bulletPointY) {
        if (frame.bulletPoint) {
          this.bulletPointX.value = frame.bulletPoint.x;
          this.bulletPointY.value = frame.bulletPoint.y;
        } else {
          this.bulletPointX.value = "";
          this.bulletPointY.value = "";
        }
      }
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
    constructor(
      x,
      y,
      width,
      height,
      centerX,
      centerY,
      bulletPointX = null,
      bulletPointY = null
    ) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.frameCenter = { x: centerX, y: centerY };
      this.bulletPoint =
        bulletPointX !== null && bulletPointY !== null
          ? { x: bulletPointX, y: bulletPointY }
          : null;
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

      // Draw frame rectangle
      this.ctx.strokeRect(
        this.imageOffsetX + frame.x,
        this.imageOffsetY + frame.y,
        frame.width,
        frame.height
      );

      // Draw frame center point
      this.ctx.fillStyle = "blue";
      this.ctx.beginPath();
      this.ctx.arc(
        this.imageOffsetX + frame.frameCenter.x,
        this.imageOffsetY + frame.frameCenter.y,
        4,
        0,
        Math.PI * 2
      );
      this.ctx.fill();

      // Draw bullet point if exists
      if (frame.bulletPoint) {
        this.ctx.fillStyle = "green";
        this.ctx.beginPath();
        this.ctx.arc(
          this.imageOffsetX + frame.bulletPoint.x,
          this.imageOffsetY + frame.bulletPoint.y,
          4,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
      }
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

        // Ctrl+клік для зміни центральної точки
        if (e.ctrlKey && this.currentFrame) {
          const clickX = e.offsetX - this.imageOffsetX;
          const clickY = e.offsetY - this.imageOffsetY;

          this.currentFrame.frameCenter.x = clickX;
          this.currentFrame.frameCenter.y = clickY;

          // Оновлюємо інпути для центральної точки
          editor.centerX.value = clickX;
          editor.centerY.value = clickY;

          // Застосовуємо зміни до поточного кадру
          editor.applyFrameSelection(this.currentFrame);
          this.redrawCanvas();
          return;
        }

        // Shift+клік для додавання/зміни bulletPoint
        if (e.shiftKey && this.currentFrame) {
          const clickX = e.offsetX - this.imageOffsetX;
          const clickY = e.offsetY - this.imageOffsetY;

          if (!this.currentFrame.bulletPoint) {
            this.currentFrame.bulletPoint = { x: clickX, y: clickY };
          } else {
            this.currentFrame.bulletPoint.x = clickX;
            this.currentFrame.bulletPoint.y = clickY;
          }

          // Оновлюємо інпути для bulletPoint (потрібно додати їх в HTML)
          if (editor.bulletPointX && editor.bulletPointY) {
            editor.bulletPointX.value = clickX;
            editor.bulletPointY.value = clickY;
          }

          // Застосовуємо зміни до поточного кадру
          editor.applyFrameSelection(this.currentFrame);
          this.redrawCanvas();
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
          this.currentFrame.frameCenter.y = y + height;

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

  class AnimationPreviewRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.image = null;
      this.frames = [];
      this.currentFrameIndex = 0;
      this.animationInterval = null;
      this.frameDelay = 150; // milliseconds between frames
      this.scale = 2.0; // Add scaling factor
    }

    startPreview(imageSrc, frames) {
      // Stop any existing preview
      this.stopPreview();

      // Load the image
      this.image = new Image();
      this.image.src = imageSrc;
      this.frames = frames;

      this.image.onload = () => {
        // Start animation loop once image is loaded
        this.currentFrameIndex = 0;
        this.animationInterval = setInterval(
          () => this.renderNextFrame(),
          this.frameDelay
        );
      };
    }

    stopPreview() {
      if (this.animationInterval) {
        clearInterval(this.animationInterval);
        this.animationInterval = null;
      }
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    updateFrames(frames) {
      this.frames = frames;
    }

    renderNextFrame() {
      if (!this.image || this.frames.length === 0) return;

      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Get current frame
      const frame = this.frames[this.currentFrameIndex];

      // Calculate center position in preview canvas
      const centerX = this.canvas.width / 2;
      const centerY = this.canvas.height / 2;

      // Calculate drawing position with scaling
      const offsetX = frame.frameCenter.x - frame.x;
      const offsetY = frame.frameCenter.y - frame.y;
      const drawX = centerX - offsetX * this.scale;
      const drawY = centerY - offsetY * this.scale;

      // Draw the frame with scaling
      this.ctx.drawImage(
        this.image,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        drawX,
        drawY,
        frame.width * this.scale,
        frame.height * this.scale
      );

      // Move to next frame
      this.currentFrameIndex =
        (this.currentFrameIndex + 1) % this.frames.length;
    }
  }

  //!-----------------------------------------------------------------------------------

  const editor = new Editor();
  editor.setupEventListeners();
  editor.updateUIState();
});
