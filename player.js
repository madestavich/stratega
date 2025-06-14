export class Player {
  constructor(config) {
    this.nickname = config.nickname;
    this.race = config.race;
    this.team = config.team;
    this.coins = config.coins || 100;
    this.gameObjects = [];
  }

  addGameObject(gameObject) {
    // Set the object's team to match the player's team
    gameObject.team = this.team;
    this.gameObjects.push(gameObject);
    return gameObject;
  }

  removeGameObject(gameObject) {
    const index = this.gameObjects.indexOf(gameObject);
    if (index !== -1) {
      this.gameObjects.splice(index, 1);
      return true;
    }
    return false;
  }
}
