export class MapRenderer {
  constructor(mapName) {
    this.mapName = mapName;
    this.mapImage = null;
    this.isLoaded = false;
    this.loadMap();
  }

  /**
   * Загружает изображение карты
   */
  loadMap() {
    this.mapImage = new Image();
    this.mapImage.onload = () => {
      this.isLoaded = true;
    };
    this.mapImage.onerror = () => {
      console.error(`Failed to load map: ${this.mapName}`);
    };
    this.mapImage.src = `../background/maps/${this.mapName}`;
  }

  /**
   * Отрисовывает карту как фон на канвасе
   * @param {CanvasRenderingContext2D} ctx - контекст канваса
   * @param {number} canvasWidth - ширина канваса
   * @param {number} canvasHeight - высота канваса
   */
  renderBackground(ctx, canvasWidth, canvasHeight) {
    if (!this.isLoaded || !this.mapImage) {
      return;
    }

    // Сохраняем текущее состояние контекста
    ctx.save();

    // Отрисовываем изображение на весь канвас
    ctx.drawImage(this.mapImage, 0, 0, canvasWidth, canvasHeight);

    // Восстанавливаем состояние контекста
    ctx.restore();
  }

  /**
   * Проверяет, загружена ли карта
   * @returns {boolean}
   */
  isMapLoaded() {
    return this.isLoaded;
  }

  /**
   * Меняет карту
   * @param {string} newMapName - название новой карты
   */
  changeMap(newMapName) {
    this.mapName = newMapName;
    this.isLoaded = false;
    this.loadMap();
  }

  /**
   * Получает размеры оригинального изображения карты
   * @returns {Object|null} - объект с width и height или null
   */
  getMapDimensions() {
    if (!this.isLoaded || !this.mapImage) {
      return null;
    }
    return {
      width: this.mapImage.width,
      height: this.mapImage.height,
    };
  }
}
