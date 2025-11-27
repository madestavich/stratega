// Battle Logger - logs game state for debugging determinism issues

export class BattleLogger {
  constructor() {
    this.logs = [];
    this.isEnabled = true;
    this.tickCount = 0;
  }

  // Reset logs for new battle
  reset() {
    this.logs = [];
    this.tickCount = 0;
  }

  // Log a tick with all relevant state
  logTick(gameManager, isAnimationTick) {
    if (!this.isEnabled) return;

    const tick = {
      tick: this.tickCount,
      isAnimationTick,
      units: [],
      particles: [],
    };

    // Log all units state
    const allObjects = [
      ...gameManager.objectManager.objects,
      ...gameManager.objectManager.enemyObjects,
    ].sort((a, b) => a.id - b.id);

    for (const unit of allObjects) {
      tick.units.push({
        id: unit.id,
        name: unit.name,
        team: unit.team,
        gridCol: unit.gridCol,
        gridRow: unit.gridRow,
        x: Math.round(unit.x * 100) / 100,
        y: Math.round(unit.y * 100) / 100,
        health: Math.round(unit.health * 100) / 100,
        isDead: unit.isDead,
        isAttacking: unit.isAttacking,
        isMoving: unit.isMoving,
        attackTargetId: unit.attackTarget?.id ?? null,
        attackCooldown: Math.round((unit.attackCooldown || 0) * 100) / 100,
        attackDamageDealt: unit.attackDamageDealt || false,
        animFrame: unit.animator?.frameIndex ?? null,
        animName: unit.animator?.activeAnimation?.name ?? null,
      });
    }

    // Log particles
    for (let i = 0; i < gameManager.objectManager.particles.length; i++) {
      const p = gameManager.objectManager.particles[i];
      tick.particles.push({
        index: i,
        x: Math.round(p.x * 100) / 100,
        y: Math.round(p.y * 100) / 100,
        targetId: p.target?.id ?? null,
        progress: Math.round(p.progress * 1000) / 1000,
        hasReached: p.hasReachedTarget,
      });
    }

    this.logs.push(tick);
    this.tickCount++;
  }

  // Log damage event
  logDamage(attacker, target, damage, healthBefore, healthAfter) {
    if (!this.isEnabled) return;

    this.logs.push({
      event: "DAMAGE",
      tick: this.tickCount,
      attackerId: attacker.id,
      attackerName: attacker.name,
      targetId: target.id,
      targetName: target.name,
      damage: Math.round(damage * 100) / 100,
      healthBefore: Math.round(healthBefore * 100) / 100,
      healthAfter: Math.round(healthAfter * 100) / 100,
      targetDied: healthAfter <= 0,
    });
  }

  // Log attack start
  logAttackStart(attacker, target) {
    if (!this.isEnabled) return;

    this.logs.push({
      event: "ATTACK_START",
      tick: this.tickCount,
      attackerId: attacker.id,
      attackerName: attacker.name,
      targetId: target?.id ?? null,
      targetName: target?.name ?? null,
      isRanged: attacker.isRangedAttack,
    });
  }

  // Log death
  logDeath(unit, killedBy) {
    if (!this.isEnabled) return;

    this.logs.push({
      event: "DEATH",
      tick: this.tickCount,
      unitId: unit.id,
      unitName: unit.name,
      killedById: killedBy?.id ?? null,
      killedByName: killedBy?.name ?? null,
    });
  }

  // Download logs as JSON file
  downloadLogs(playerName = "player") {
    const data = {
      exportTime: new Date().toISOString(),
      playerName,
      totalTicks: this.tickCount,
      logs: this.logs,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `battle_log_${playerName}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Battle log downloaded: ${this.logs.length} entries`);
  }

  // Get summary for quick comparison
  getSummary() {
    const damageEvents = this.logs.filter((l) => l.event === "DAMAGE");
    const deathEvents = this.logs.filter((l) => l.event === "DEATH");

    return {
      totalTicks: this.tickCount,
      totalDamageEvents: damageEvents.length,
      totalDeaths: deathEvents.length,
      deaths: deathEvents.map(
        (d) => `${d.unitName}(${d.unitId}) at tick ${d.tick}`
      ),
      // Hash for quick comparison
      hash: this.calculateHash(),
    };
  }

  // Calculate simple hash of all events for quick comparison
  calculateHash() {
    const events = this.logs
      .filter((l) => l.event)
      .map(
        (l) =>
          `${l.event}:${l.tick}:${l.attackerId || l.unitId}:${l.targetId || ""}`
      )
      .join("|");

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < events.length; i++) {
      const char = events.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

// Global instance
export const battleLogger = new BattleLogger();
