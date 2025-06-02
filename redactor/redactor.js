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
      this.mirroredPreviewCanvas = document.getElementById(
        "mirroredPreviewCanvas"
      );
      this.mirroredPreviewRenderer = new AnimationPreviewRenderer(
        this.mirroredPreviewCanvas,
        true
      );
      this.zoomSlider = document.getElementById("zoomSlider");
      this.zoomValue = document.getElementById("zoomValue");
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
        this.bulletPointX, // Add bulletPointX here
        this.bulletPointY, // Add bulletPointY here
      ];
      frameInputs.forEach((input) => (input.disabled = !hasFrames));
      if (hasAnimation && hasFrames) {
        this.previewRenderer.startPreview(
          selectedSpritesheet.sourceImage.link,
          selectedAnimation.frames
        );
        this.mirroredPreviewRenderer.startPreview(
          selectedSpritesheet.sourceImage.link,
          selectedAnimation.frames
        );
      } else {
        this.previewRenderer.stopPreview();
        this.mirroredPreviewRenderer.stopPreview();
      }
    }

    setupEventListeners() {
      // this.frameSelectionToggle.addEventListener("change", (e) => {
      //   this.canvasRenderer.enableFrameSelection(e.target.checked);
      // });
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
      this.zoomSlider.addEventListener("input", () => {
        const zoomLevel = parseFloat(this.zoomSlider.value);
        this.zoomValue.textContent = `${Math.round(zoomLevel * 100)}%`;
        this.canvasRenderer.setZoom(zoomLevel);
      });
    }

    addSpritesheet() {
      const fileInput = this.imageLoader;
      if (!fileInput.files.length) return;

      const name = prompt("Enter spritesheet name:");
      if (!name || this.spritesheets[name])
        return alert("Invalid or duplicate name");

      const file = fileInput.files[0];

      // Create a URL for the uploaded file
      const objectURL = URL.createObjectURL(file);

      const image = new Image();
      image.src = objectURL;

      image.onload = () => {
        this.spritesheets[name] = new Spritesheet(name, {
          link: objectURL, // Use the object URL directly
          width: image.width,
          height: image.height,
          fileName: file.name, // Store the filename for reference
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
            if (this.currentSpritesheetKey && this.currentAnimation) {
              const selectedSpritesheet =
                this.spritesheets[this.currentSpritesheetKey];
              const selectedAnimation =
                selectedSpritesheet.animations[this.currentAnimation];
              if (selectedAnimation && selectedAnimation.frames.length > 0) {
                this.frameSlider.max = selectedAnimation.frames.length - 1;
                this.frameSlider.value = 0;
                this.updateFrameInputs(selectedAnimation.frames[0]);
              }
            }

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

      // Create a copy of the spritesheets for saving
      const configToSave = {};
      Object.entries(this.spritesheets).forEach(([key, spritesheet]) => {
        configToSave[key] = JSON.parse(JSON.stringify(spritesheet));

        // Replace the object URL with a placeholder that includes the original filename
        if (spritesheet.sourceImage.fileName) {
          configToSave[key].sourceImage.link =
            "../sprites/" + spritesheet.sourceImage.fileName;
        }

        // Remove temporary properties
        delete configToSave[key].sourceImage.fileName;
      });

      const dataStr = JSON.stringify(configToSave, null, 2);
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
      this.lastSpritesheet = null;
      this.lastOffsetX = 0;
      this.lastOffsetY = 0;
      this.zoomLevel = 1;

      // Додаємо змінні для вибору фрейму
      this.isFrameSelectionMode = false;
      this.isSelectingFrame = false;
      this.startFrameX = 0;
      this.startFrameY = 0;

      this.initCanvasEvents();
    }

    setFrame(frame) {
      this.currentFrame = frame;
      this.redrawCanvas();
    }

    // Add the missing enableFrameSelection method
    enableFrameSelection(enabled) {
      this.isFrameSelectionMode = enabled;
      this.canvas.style.cursor = enabled ? "crosshair" : "default";
    }

    // The setFrameSelectionMode method can be kept for backward compatibility
    setFrameSelectionMode(isEnabled) {
      this.enableFrameSelection(isEnabled);
    }

    // Метод для встановлення режиму вибору фрейму
    setFrameSelectionMode(isEnabled) {
      this.isFrameSelectionMode = isEnabled;
      this.canvas.style.cursor = isEnabled ? "crosshair" : "default";
    }

    // Метод для встановлення поточного фрейму
    setCurrentFrame(frame) {
      this.currentFrame = frame;
      this.redrawCanvas();
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
          this.imageOffsetX =
            (this.canvas.width - this.image.width * this.zoomLevel) / 2;
          this.imageOffsetY =
            (this.canvas.height - this.image.height * this.zoomLevel) / 2;
        }

        this.lastSpritesheet = imageSrc; // Оновлюємо збережений спрайтшит
        this.redrawCanvas();
      };
    }

    setZoom(zoomLevel) {
      // Store the center point of the view before zooming
      const centerX = this.canvas.width / 2;
      const centerY = this.canvas.height / 2;

      // Calculate the point in the image that was at the center
      const imageCenterX = (centerX - this.imageOffsetX) / this.zoomLevel;
      const imageCenterY = (centerY - this.imageOffsetY) / this.zoomLevel;

      // Update zoom level
      this.zoomLevel = zoomLevel;

      // Recalculate offset to keep the same point centered
      this.imageOffsetX = centerX - imageCenterX * this.zoomLevel;
      this.imageOffsetY = centerY - imageCenterY * this.zoomLevel;

      // Update last offsets
      this.lastOffsetX = this.imageOffsetX;
      this.lastOffsetY = this.imageOffsetY;

      // Redraw with new zoom
      this.redrawCanvas();
    }

    redrawCanvas() {
      if (!this.image) return;

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Draw the image with zoom
      this.ctx.save();
      this.ctx.drawImage(
        this.image,
        this.imageOffsetX,
        this.imageOffsetY,
        this.image.width * this.zoomLevel,
        this.image.height * this.zoomLevel
      );
      this.ctx.restore();

      if (this.currentFrame) {
        this.drawFrame(this.currentFrame);
      }
    }

    drawFrame(frame) {
      this.ctx.strokeStyle = "red";
      this.ctx.lineWidth = 2;

      // Draw frame rectangle with zoom
      this.ctx.strokeRect(
        this.imageOffsetX + frame.x * this.zoomLevel,
        this.imageOffsetY + frame.y * this.zoomLevel,
        frame.width * this.zoomLevel,
        frame.height * this.zoomLevel
      );

      // Draw frame center point with zoom
      this.ctx.fillStyle = "blue";
      this.ctx.beginPath();
      this.ctx.arc(
        this.imageOffsetX + frame.frameCenter.x * this.zoomLevel,
        this.imageOffsetY + frame.frameCenter.y * this.zoomLevel,
        4,
        0,
        Math.PI * 2
      );
      this.ctx.fill();

      // Draw bullet point if exists with zoom
      if (frame.bulletPoint) {
        this.ctx.fillStyle = "green";
        this.ctx.beginPath();
        this.ctx.arc(
          this.imageOffsetX + frame.bulletPoint.x * this.zoomLevel,
          this.imageOffsetY + frame.bulletPoint.y * this.zoomLevel,
          4,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
      }
    }

    initCanvasEvents() {
      this.canvas.addEventListener("mousedown", (e) => {
        if (this.isSpacePressed) {
          if (!editor.currentSpritesheetKey || !editor.currentAnimation) return;

          this.isSelectingFrame = true;
          // Adjust for zoom when starting frame selection
          this.startFrameX = (e.offsetX - this.imageOffsetX) / this.zoomLevel;
          this.startFrameY = (e.offsetY - this.imageOffsetY) / this.zoomLevel;
          this.currentFrame = {
            x: this.startFrameX,
            y: this.startFrameY,
            width: 0,
            height: 0,
            frameCenter: {
              x: this.startFrameX,
              y: this.startFrameY,
            },
          };
          return;
        }

        // Alt+click для переміщення існуючого фрейму
        if (this.isAltPressed && this.currentFrame) {
          const clickX = (e.offsetX - this.imageOffsetX) / this.zoomLevel;
          const clickY = (e.offsetY - this.imageOffsetY) / this.zoomLevel;

          // Перевіряємо, чи клік всередині поточного фрейму
          if (
            clickX >= this.currentFrame.x &&
            clickX <= this.currentFrame.x + this.currentFrame.width &&
            clickY >= this.currentFrame.y &&
            clickY <= this.currentFrame.y + this.currentFrame.height
          ) {
            this.isMovingFrame = true;
            this.moveStartX = clickX;
            this.moveStartY = clickY;
            return;
          }
        }

        // Ctrl+click for changing center point
        if (e.ctrlKey && this.currentFrame) {
          // Adjust for zoom when setting center point
          const clickX = (e.offsetX - this.imageOffsetX) / this.zoomLevel;
          const clickY = (e.offsetY - this.imageOffsetY) / this.zoomLevel;

          this.currentFrame.frameCenter.x = clickX;
          this.currentFrame.frameCenter.y = clickY;

          editor.centerX.value = Math.round(clickX);
          editor.centerY.value = Math.round(clickY);

          editor.applyFrameSelection(this.currentFrame);
          this.redrawCanvas();
          return;
        }

        // Shift+click for bullet point
        if (e.shiftKey && this.currentFrame) {
          // Adjust for zoom when setting bullet point
          const clickX = (e.offsetX - this.imageOffsetX) / this.zoomLevel;
          const clickY = (e.offsetY - this.imageOffsetY) / this.zoomLevel;

          if (!this.currentFrame.bulletPoint) {
            this.currentFrame.bulletPoint = { x: clickX, y: clickY };
          } else {
            this.currentFrame.bulletPoint.x = clickX;
            this.currentFrame.bulletPoint.y = clickY;
          }

          if (editor.bulletPointX && editor.bulletPointY) {
            editor.bulletPointX.value = Math.round(clickX);
            editor.bulletPointY.value = Math.round(clickY);
          }

          editor.applyFrameSelection(this.currentFrame);
          this.redrawCanvas();
          return;
        }

        this.isDragging = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
      });

      // Замінити існуючий обробник mousemove (приблизно рядок 518)
      this.canvas.addEventListener("mousemove", (e) => {
        if (this.isSelectingFrame) {
          // Adjust for zoom when selecting frame
          const currentX = (e.offsetX - this.imageOffsetX) / this.zoomLevel;
          const currentY = (e.offsetY - this.imageOffsetY) / this.zoomLevel;

          const x = Math.min(this.startFrameX, currentX);
          const y = Math.min(this.startFrameY, currentY);
          const width = Math.abs(currentX - this.startFrameX);
          const height = Math.abs(currentY - this.startFrameY);

          this.currentFrame.x = x;
          this.currentFrame.y = y;
          this.currentFrame.width = width;
          this.currentFrame.height = height;

          // Встановлюємо центр фрейму за замовчуванням
          this.currentFrame.frameCenter.x = x + width / 2;
          this.currentFrame.frameCenter.y = y + height;

          this.redrawCanvas();
          return;
        }

        // Обробка переміщення фрейму
        if (this.isMovingFrame && this.currentFrame) {
          const currentX = (e.offsetX - this.imageOffsetX) / this.zoomLevel;
          const currentY = (e.offsetY - this.imageOffsetY) / this.zoomLevel;

          const dx = currentX - this.moveStartX;
          const dy = currentY - this.moveStartY;

          // Оновлюємо позицію фрейму
          this.currentFrame.x += dx;
          this.currentFrame.y += dy;

          // Оновлюємо позицію центру фрейму
          this.currentFrame.frameCenter.x += dx;
          this.currentFrame.frameCenter.y += dy;

          // Оновлюємо позицію точки пострілу, якщо вона існує
          if (this.currentFrame.bulletPoint) {
            this.currentFrame.bulletPoint.x += dx;
            this.currentFrame.bulletPoint.y += dy;
          }

          // Оновлюємо початкову точку для наступного руху
          this.moveStartX = currentX;
          this.moveStartY = currentY;

          // Оновлюємо значення в полях вводу
          editor.frameX.value = Math.round(this.currentFrame.x);
          editor.frameY.value = Math.round(this.currentFrame.y);
          editor.centerX.value = Math.round(this.currentFrame.frameCenter.x);
          editor.centerY.value = Math.round(this.currentFrame.frameCenter.y);

          if (
            editor.bulletPointX &&
            editor.bulletPointY &&
            this.currentFrame.bulletPoint
          ) {
            editor.bulletPointX.value = Math.round(
              this.currentFrame.bulletPoint.x
            );
            editor.bulletPointY.value = Math.round(
              this.currentFrame.bulletPoint.y
            );
          }

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

      // Add mouse wheel zoom support
      this.canvas.addEventListener("wheel", (e) => {
        e.preventDefault();

        // Calculate zoom change based on wheel direction
        let zoomChange = e.deltaY > 0 ? -0.1 : 0.1;
        let newZoom = Math.max(0.5, Math.min(3, this.zoomLevel + zoomChange));

        // Get mouse position relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate the point in the image under the mouse
        const pointX = (mouseX - this.imageOffsetX) / this.zoomLevel;
        const pointY = (mouseY - this.imageOffsetY) / this.zoomLevel;

        // Update zoom level
        this.zoomLevel = newZoom;

        // Adjust offset to zoom toward mouse position
        this.imageOffsetX = mouseX - pointX * this.zoomLevel;
        this.imageOffsetY = mouseY - pointY * this.zoomLevel;

        // Update last offsets
        this.lastOffsetX = this.imageOffsetX;
        this.lastOffsetY = this.imageOffsetY;

        // Update the zoom slider value
        if (editor.zoomSlider) {
          editor.zoomSlider.value = newZoom;
          editor.zoomValue.textContent = `${Math.round(newZoom * 100)}%`;
        }

        this.redrawCanvas();
      });

      // Замінити існуючий обробник mouseup (приблизно рядок 580)
      this.canvas.addEventListener("mouseup", () => {
        if (this.isSelectingFrame) {
          this.isSelectingFrame = false;

          if (this.currentFrame) {
            // Округляємо значення для кращої точності
            this.currentFrame.x = Math.round(this.currentFrame.x);
            this.currentFrame.y = Math.round(this.currentFrame.y);
            this.currentFrame.width = Math.round(this.currentFrame.width);
            this.currentFrame.height = Math.round(this.currentFrame.height);
            this.currentFrame.frameCenter.x = Math.round(
              this.currentFrame.frameCenter.x
            );
            this.currentFrame.frameCenter.y = Math.round(
              this.currentFrame.frameCenter.y
            );

            editor.applyFrameSelection(this.currentFrame);
          }
          return;
        }

        if (this.isMovingFrame) {
          this.isMovingFrame = false;
          editor.applyFrameSelection(this.currentFrame);
          return;
        }

        this.isDragging = false;
        this.lastOffsetX = this.imageOffsetX;
        this.lastOffsetY = this.imageOffsetY;
      });
      document.addEventListener("keydown", (e) => {
        if (e.code === "Space") {
          e.preventDefault(); // Запобігаємо прокрутці сторінки
          this.isSpacePressed = true;
          this.canvas.style.cursor = "crosshair";
        }
        if (e.code === "AltLeft" || e.code === "AltRight") {
          e.preventDefault();
          this.isAltPressed = true;
          this.canvas.style.cursor = "move";
        }
      });

      document.addEventListener("keyup", (e) => {
        if (e.code === "Space") {
          this.isSpacePressed = false;
          this.canvas.style.cursor = "default";
        }
        if (e.code === "AltLeft" || e.code === "AltRight") {
          this.isAltPressed = false;
          this.canvas.style.cursor = "default";
        }
      });
    }
  }

  class AnimationPreviewRenderer {
    constructor(canvas, mirrored = false) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.image = null;
      this.frames = [];
      this.currentFrameIndex = 0;
      this.animationInterval = null;
      this.frameDelay = 150; // milliseconds between frames
      this.scale = 2.5; // scaling factor
      this.mirrored = mirrored; // Add mirrored flag
      this.isSpacePressed = false;
      this.isAltPressed = false;
      this.isMovingFrame = false;
      this.moveStartX = 0;
      this.moveStartY = 0;
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
      const centerY = this.canvas.height / 1.5;

      // Calculate drawing position with scaling
      const offsetX = frame.frameCenter.x - frame.x;
      const offsetY = frame.frameCenter.y - frame.y;

      if (this.mirrored) {
        // For mirrored view
        this.ctx.save();

        // Встановлюємо точку відліку в центр канвасу
        this.ctx.translate(centerX, 0);
        // Застосовуємо дзеркальне відображення по горизонталі
        this.ctx.scale(-1, 1);
        // Повертаємо точку відліку назад
        this.ctx.translate(-centerX, 0);

        // Використовуємо ті ж координати, що й для звичайного відображення
        const drawX = centerX - offsetX * this.scale;
        const drawY = centerY - offsetY * this.scale;

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

        this.ctx.restore();
      } else {
        // Original non-mirrored rendering
        const drawX = centerX - offsetX * this.scale;
        const drawY = centerY - offsetY * this.scale;

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
      }

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
