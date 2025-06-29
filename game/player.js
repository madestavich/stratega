export class Player {
  constructor(config) {
    this.nickname = config.nickname;
    this.race = config.race;
    this.team = config.team;
    this.coins = config.coins || 100;
  }
}
