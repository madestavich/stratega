import { Animator } from "../import.js";
import { Renderer } from "../import.js";

export class GameObject {
  constructor(ctx, spriteConfig, objectConfig, gridCol, gridRow, gridManager) {
    this.ctx = ctx;
    this.spriteConfig = spriteConfig;
    this.gridCol = gridCol;
    this.gridRow = gridRow;
    this.gridManager = gridManager;
    this.x = undefined;
    this.y = undefined;
    this.z = undefined;
    this.objectType = objectConfig.objectType || "default"; // Тип об'єкта
    this.actionPriorities = objectConfig.actionPriorities || []; // Масив типів дій у порядку пріоритету
    this.canAct = true; // Чи може об'єкт виконувати дії
    this.isMoving = false; // Чи об'єкт рухається
    this.moveDirection = null; // Напрямок руху
    this.moveTarget = null; // Ціль для руху
    this.lookDirection = null; // Напрямок огляду
    this.moveSpeed = objectConfig.moveSpeed || 1; // Швидкість руху
    this.availableActions = objectConfig.availableActions || []; // Доступні дії
    this.team = objectConfig.team || 1; // Команда об'єкта
    this.isAttacking = false; // Чи об'єкт атакує
    this.attackTarget = null; // Ціль для атаки
    this.attackRange = objectConfig.attackRange || 1; // Діапазон атаки
    this.attackDamage = objectConfig.attackDamage || 1; // Шкода атаки
    this.attackSpeed = objectConfig.attackSpeed || 1; // Швидкість атаки
    this.attackCooldown = 0; // Затримка між атаками
    this.health = objectConfig.health || 100; // Здоров'я об'єкта
    this.isDead = false; // Чи об'єкт мертвий
    this.isRanged = objectConfig.isRanged || false;
    this.isRangedAttack = false; // Чи об'єкт атакує здалеку
    this.minRangeDistance = objectConfig.minRangeDistance || null;
    this.maxRangeDistance = objectConfig.maxRangeDistance || null;
    this.bulletConfig = objectConfig.bulletConfig || null; // Конфігурація кулі

    if (this.isRanged) {
      // Store the bulletPoint from the animation frame
      const lastFrame =
        spriteConfig[objectConfig.objectType].animations.range_attack.frames[
          spriteConfig[objectConfig.objectType].animations.range_attack.frames
            .length - 1
        ];
      this.bulletPoint = lastFrame.bulletPoint || { x: 0, y: 0 };
    }

    // Extract size and expansion parameters from objectConfig
    this.gridWidth = objectConfig.gridWidth || 1;
    this.gridHeight = objectConfig.gridHeight || 1;
    this.expansionDirection = objectConfig.expansionDirection || "bottomRight";

    const defaultSpritesheetId = Object.keys(spriteConfig)[0];

    this.animator = new Animator(spriteConfig);
    this.animator.setSpritesheet(defaultSpritesheetId);

    const defaultAnim = Object.keys(
      spriteConfig[defaultSpritesheetId].animations
    )[0];
    this.animator.setAnimation(defaultAnim);

    this.renderer = new Renderer(ctx, this.animator);
    this.updatePositionFromGrid();

    // Встановлюємо початковий напрямок при створенні
    this.setLookDirectionByTeam();
  }

  update() {
    if (!this.animator.hasFinished) {
      this.animator.nextFrame();
    }
    this.updateZCoordinate();
  }

  render() {
    // Retrieve the current frame's dimensions and center offsets
    const currentFrame = this.animator.activeFrame;
    const offsetX = currentFrame.frameCenter.x - currentFrame.x;
    const offsetY = currentFrame.frameCenter.y - currentFrame.y;

    // Adjust the drawing position by the calculated offsets
    if (this.moveDirection) {
      console.log('Using moveDirection:', this.moveDirection, 'team:', this.team);
      this.renderer.draw(
        this.x - offsetX,
        this.y - offsetY,
        this.moveDirection
      );
    } else {
      console.log('Using lookDirection:', this.lookDirection, 'team:', this.team);
      this.renderer.draw(
        this.x - offsetX,
        this.y - offsetY,
        this.lookDirection
      );
    }
  }

  // Only method needed for direct position control
  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.updateZCoordinate();
  }

  updatePositionFromGrid() {
    const { cellWidth, cellHeight } = this.gridManager;

    // Calculate anchor position based on expansion direction
    let anchorCol = this.gridCol;
    let anchorRow = this.gridRow;

    switch (this.expansionDirection) {
      case "topLeft":
        // Base cell is at bottom-right
        anchorCol = this.gridCol - (this.gridWidth - 1);
        anchorRow = this.gridRow - (this.gridHeight - 1);
        break;
      case "topRight":
        // Base cell is at bottom-left
        anchorRow = this.gridRow - (this.gridHeight - 1);
        break;
      case "bottomLeft":
        // Base cell is at top-right
        anchorCol = this.gridCol - (this.gridWidth - 1);
        break;
      case "bottomRight":
      default:
        // Base cell is at top-left (default)
        break;
    }

    // Calculate center point of the entire object
    this.x = (anchorCol + this.gridWidth / 2) * cellWidth;
    this.y = (anchorRow + this.gridHeight / 2) * cellHeight;
    this.updateZCoordinate();
  }

  updateZCoordinate() {
    // Make z always equal to y
    if (this.isDead) {
      this.z = this.y - this.y / 70;
    } else {
      this.z = this.y;
    }

    return this.z;
  }

  // Встановлює напрямок погляду на основі команди та того, хто дивиться
  setLookDirectionByTeam() {
    console.log('BEFORE setLookDirectionByTeam - team:', this.team, 'moveDirection:', this.moveDirection, 'lookDirection:', this.lookDirection);
    
    // Скидаємо moveDirection щоб використовувався lookDirection
    this.moveDirection = null;
    
    const gameManager = window.gameManager;
    const isRoomCreator = gameManager ? gameManager.isRoomCreator : true;

    if (isRoomCreator) {
      if (this.team === 1) {
        this.lookDirection = { dx: 1, dy: 0 };
      } else if (this.team === 2) {
        this.lookDirection = { dx: -1, dy: 0 };
      }
    } else {
      if (this.team === 1) {
        this.lookDirection = { dx: -1, dy: 0 };
      } else if (this.team === 2) {
        this.lookDirection = { dx: 1, dy: 0 };
      }
    }
    
    console.log('AFTER setLookDirectionByTeam - team:', this.team, 'moveDirection:', this.moveDirection, 'lookDirection:', this.lookDirection);
  }
}
